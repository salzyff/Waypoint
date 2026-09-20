import type {Product} from '../types';
export interface ExtractionSuggestion {candidate:Partial<Product>;confidence:'low'|'medium'|'high';reason:string;requiresConfirmation:true;}
export interface AIProvider {extract(input:{fileId:string;description?:string}):Promise<ExtractionSuggestion>;explain(ruleId:string):Promise<string>;}
export class UnavailableAI implements AIProvider {async extract():Promise<ExtractionSuggestion>{throw new Error('AI extraction is not connected. Use manual product entry.')}async explain():Promise<string>{throw new Error('Use the source-backed rule explanation.')}}
export const ai:AIProvider=new UnavailableAI();
export interface TariffProvider {lookup(input:{origin:string;destination:string;classification:string}):Promise<{rate:number|null;source:string|null;verifiedAt:string|null}>;}
export const tariffProvider:TariffProvider={async lookup(){return {rate:null,source:null,verifiedAt:null}}};
