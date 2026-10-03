import type {Product, Rule} from '../types';
import {supabase} from './backend';

export interface ExtractionSuggestion {
  candidate: Partial<Product>;
  confidence: 'low'|'medium'|'high';
  reason: string;
  requiresConfirmation: true;
}

export interface AIProvider {
  extract(input: {fileId:string; organisationId:string; description?:string}): Promise<ExtractionSuggestion>;
  explain(rule: Rule): Promise<string>;
}

async function functionError(error: { message?: string; context?: unknown }) {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string') return body.error;
      if (typeof body?.message === 'string') return body.message;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        // Fall through to the SDK's message.
      }
    }
  }
  return error.message || 'Gemini request failed.';
}

export class GeminiProvider implements AIProvider {
  async extract(input: {fileId:string; organisationId:string; description?:string}) {
    if (!supabase) throw new Error('AI is unavailable in demo mode. Connect Supabase to use Gemini extraction.');
    const {data,error}=await supabase.functions.invoke('ai',{body:{action:'extract',...input}});
    if(error) throw new Error(await functionError(error));
    if(!data?.candidate || data.requiresConfirmation!==true) throw new Error('AI returned an invalid extraction.');
    return data as ExtractionSuggestion;
  }

  async explain(rule: Rule) {
    if(!supabase) throw new Error('AI is unavailable in demo mode. Use the source-backed rule explanation.');
    const {data,error}=await supabase.functions.invoke('ai',{body:{action:'explain',rule}});
    if(error) throw new Error(await functionError(error));
    if(!data?.explanation) throw new Error('AI returned no explanation.');
    return data.explanation as string;
  }
}

export const ai: AIProvider = new GeminiProvider();

export interface TariffProvider {
  lookup(input:{origin:string;destination:string;classification:string}):Promise<{rate:number|null;source:string|null;verifiedAt:string|null}>;
}

export const tariffProvider:TariffProvider = {
  async lookup(){return {rate:null,source:null,verifiedAt:null};},
};
