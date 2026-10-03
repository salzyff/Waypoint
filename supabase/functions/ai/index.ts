import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'gpt-5.6-luna';

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
        category: { type: ['string', 'null'], enum: ['cosmetics', 'food', 'textiles', 'agriculture', 'electronics', null] },
        ingredients: { type: ['string', 'null'] },
        brand: { type: ['string', 'null'] },
        classification: { type: ['string', 'null'] },
        manufactured: { type: ['string', 'null'], enum: ['NG', 'GH', 'KE', null] },
      },
      required: ['name', 'sku', 'description', 'category', 'ingredients', 'brand', 'classification', 'manufactured'],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string' },
    requiresConfirmation: { type: 'boolean', const: true },
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
  return { client, user };
}

async function openai(body: unknown) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OpenAI is not configured. Add OPENAI_API_KEY to Supabase Edge Function secrets.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'OpenAI request failed';
    throw new Error(message);
  }
  return data;
}

function outputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const message = response?.output?.find((item: any) => item.type === 'message');
  return message?.content?.find((part: any) => part.type === 'output_text')?.text || '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { client } = await requireUser(req);
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

      const prompt = `You are Waypoint's document extraction assistant.
Extract only factual product/shipment information explicitly present in the supplied document.
Do not invent missing values. Use null for missing fields.
Category must be one of: cosmetics, food, textiles, agriculture, electronics.
Manufactured must be one of: NG, GH, KE.
Classification should contain a classification/code only when the document explicitly provides one.
A suggestion is never authoritative and MUST require human confirmation.
${description ? `Additional user description: ${description}` : ''}`;

      if (!documentType.startsWith('image/') && documentType !== 'application/pdf' && documentType !== 'text/plain') {
        return json({ error: 'Unsupported AI document type' }, 400);
      }

      const content: any[] = [{ type: 'input_text', text: prompt }];
      if (documentType.startsWith('image/')) {
        content.push({ type: 'input_image', image_url: signed.signedUrl, detail: 'low' });
      } else {
        content.push({ type: 'input_file', file_url: signed.signedUrl, filename: documentName, detail: 'low' });
      }

      const response = await openai({
        model: MODEL,
        reasoning: { effort: 'low' },
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'waypoint_product_extraction',
            strict: true,
            schema: extractionSchema,
          },
        },
        max_output_tokens: 500,
      });

      const text = outputText(response);
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

      const response = await openai({
        model: MODEL,
        reasoning: { effort: 'low' },
        input: `Explain this Waypoint rule in plain English. Do not change, reinterpret, or override the rule. Mention that official requirements and professional review remain authoritative.

Rule:
${JSON.stringify(rule)}`,
        max_output_tokens: 220,
      });

      return json({ explanation: outputText(response) });
    }

    return json({ error: 'Unknown AI action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, 400);
  }
});
