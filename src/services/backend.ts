import {randomId} from './id';
import {createClient} from '@supabase/supabase-js';
import type {State,Role,Document} from '../types';
import {seed} from './seed';
export const demo=import.meta.env.VITE_DEMO_MODE!=='false';
export const supabase=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export const bindings={shipments:'shipments',products:'products',documents:'saved_documents',compilations:'shipment_compilations',packs:'rule_packs',sources:'rule_sources',audit:'audit_logs',notifications:'notifications',reviews:'consultant_reviews',invitations:'invitations'} as const;
export async function loadWorkspace(orgId:string):Promise<State>{
 if(!supabase)throw Error('Supabase is not configured. Add the public URL and anon key.');
 const empty=seed();for(const key of Object.keys(bindings) as (keyof typeof bindings)[]) (empty[key] as unknown[])=[];
 const responses=await Promise.all(Object.entries(bindings).map(async([key,table])=>{let q=supabase!.from(table).select('data');if(key!=='packs'&&key!=='sources')q=q.eq('organisation_id',orgId);const {data,error}=await q;if(error)throw error;return [key,data.map(x=>x.data)] as const}));
 for(const [key,rows]of responses)(empty as unknown as Record<string,unknown>)[key]=rows;
 const {data,error}=await supabase.from('organisations').select('data').eq('id',orgId).single();if(error)throw error;empty.organisation=data.data;return empty;
}
export async function saveWorkspace(previous:State,next:State,orgId:string){if(!supabase)throw Error('Database unavailable.');const {error}=await supabase.rpc('save_workspace',{org_id:orgId,previous_state:previous,next_state:next});if(error)throw error;}
export async function memberships(){if(!supabase)return [];const{data:{user}}=await supabase.auth.getUser();if(!user)return [];const{data,error}=await supabase.from('organisation_members').select('organisation_id,role,organisations(name)').eq('user_id',user.id);if(error)throw error;const{data:admins}=await supabase.from('platform_admins').select('user_id').eq('user_id',user.id);return (data??[]).map(x=>({...x,role:admins?.length?'platform_admin':x.role})) as unknown as {organisation_id:string;role:Role;organisations:{name:string}}[];}
export function validateFile(file:File){if(!['application/pdf','image/png','image/jpeg','text/plain'].includes(file.type))throw Error('Choose a PDF, PNG, JPG, or plain-text file.');if(file.size>10*1024*1024)throw Error('Files must be smaller than 10 MB.');if(!file.size)throw Error('The file is empty.');}
export async function uploadFile(file:File,org:string,type:string,country?:string):Promise<Document>{validateFile(file);const id=randomId();let path:string|undefined;
 if(!demo){if(!supabase)throw Error('Storage unavailable.');path=`${org}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const{error}=await supabase.storage.from('documents').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;}
 return{id,name:file.name,type,country,demo,status:'review',path,size:file.size};}
export async function documentUrl(doc:Document){if(!supabase||!doc.path)throw Error('This demonstration document has no original uploaded file.');const{data,error}=await supabase.storage.from('documents').createSignedUrl(doc.path,60);if(error)throw error;return data.signedUrl;}
