import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'gemini-3.1-flash-lite';

type ProductCandidate = {
  name?: string;
  sku?: string;
  description?: string;
  category?: 'cosmetics' | 'food' | 'textiles' | 'agriculture' | 'electronics';
  ingredients?: string;
  brand?: string;
  classification?: string;
  manufactured?: 'NG' | 'GH' | 'KE';
};

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidate: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: ['string', 'null'] },
        sku: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        category: { type: ['string', 'null'], enum: ['cosmetics', 'food', 'textiles', 'agriculture', 'electronics'] },
        ingredients: { type: ['string', 'null'] },
        brand: { type: ['string', 'null'] },
        classification: { type: ['string', 'null'] },
        manufactured: { type: ['string', 'null'], enum: ['NG', 'GH', 'KE'] },
      },
      required: ['name', 'sku', 'description', 'category', 'ingredients', 'brand', 'classification', 'manufactured'],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string' },
    requiresConfirmation: { type: 'boolean', enum: [true] },
  },
  required: ['candidate', 'confidence', 'reason', 'requiresConfirmation'],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new Error('Authentication required');
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Session expired');
  return client;
}

async function gemini(parts: unknown[], responseSchema?: unknown) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to Supabase Edge Function secrets.');

  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
  };
  if (responseSchema) generationConfig.responseSchema = responseSchema;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Gemini request failed');
  }

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.find((part: any) => typeof part.text === 'string')?.text;
  if (!text) {
    const reason = candidate?.finishReason || data?.promptFeedback?.blockReason;
    const ratings = candidate?.safetyRatings?.filter((r: any) => r?.blocked || r?.probability === 'HIGH').map((r: any) => r.category).join(', ');
    throw new Error(reason ? `Gemini did not return an answer (reason: ${reason}${ratings ? `; safety: ${ratings}` : ''}).` : 'Gemini returned no text.');
  }
  return text;
}

function base64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const client = await requireUser(req);
    const body = await req.json();

    if (body.action === 'extract') {
      const fileId = typeof body.fileId === 'string' ? body.fileId : '';
      const organisationId = typeof body.organisationId === 'string' ? body.organisationId : '';
      const description = typeof body.description === 'string' ? body.description : '';

      if (!fileId || !organisationId) return json({ error: 'fileId and organisationId are required' }, 400);

      const { data: document, error: documentError } = await client
        .from('saved_documents')
        .select('data')
        .eq('id', fileId)
        .eq('organisation_id', organisationId)
        .single();

      if (documentError || !document?.data?.path) return json({ error: 'Document not found or inaccessible' }, 404);

      const { data: signed, error: signedError } = await client.storage
        .from('documents')
        .createSignedUrl(document.data.path, 120);

      if (signedError || !signed?.signedUrl) return json({ error: 'Unable to access document' }, 400);

      const documentName = document.data.name || 'shipment-document';
      const documentType = document.data.type || '';

      if (!documentType.startsWith('image/') && documentType !== 'application/pdf' && documentType !== 'text/plain') {
        return json({ error: 'Unsupported AI document type' }, 400);
      }

      const fileResponse = await fetch(signed.signedUrl);
      if (!fileResponse.ok) return json({ error: 'Unable to read document' }, 400);

      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      if (bytes.byteLength > 50 * 1024 * 1024) {
        return json({ error: 'Document is larger than Gemini\'s 50 MB inline document limit. Use manual entry or a smaller document.' }, 400);
      }
      const prompt = `You are Waypoint's document extraction assistant.
Extract only factual product/shipment information explicitly present in the supplied document.
Do not invent missing values. Use null for missing fields.
Category must be one of: cosmetics, food, textiles, agriculture, electronics.
Manufactured must be one of: NG, GH, KE.
Classification should contain a classification/code only when the document explicitly provides one.
A suggestion is never authoritative and MUST require human confirmation.
${description ? `Additional user description: ${description}` : ''}`;

      const text = await gemini([
        { text: prompt },
        { inlineData: { mimeType: documentType, data: base64(bytes) } },
      ], extractionSchema);

      const parsed = JSON.parse(text);
      const candidate: ProductCandidate = {};
      for (const [key, value] of Object.entries(parsed.candidate ?? {})) {
        if (value !== null && value !== '') (candidate as any)[key] = value;
      }

      return json({
        candidate,
        confidence: parsed.confidence,
        reason: parsed.reason,
        requiresConfirmation: true,
      });
    }

    if (body.action === 'explain') {
      const rule = body.rule;
      if (!rule || typeof rule !== 'object') return json({ error: 'rule is required' }, 400);

      const text = await gemini([{
        text: `Explain this Waypoint rule in plain English. Do not change, reinterpret, or override the rule. Do not add requirements that are absent from it. Mention that official requirements and professional review remain authoritative.

Rule:
${JSON.stringify(rule)}`,
      }]);

      return json({ explanation: text });
    }

    return json({ error: 'Unknown AI action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, 400);
  }
});
