import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {compile} from '../_shared/engine.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});if(req.method!=='POST')return json({error:'Method not allowed'},405);try{
 const auth=req.headers.get('Authorization');if(!auth)return json({error:'Authentication required'},401);
 const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const{data:{user},error:authError}=await userClient.auth.getUser();if(authError||!user)return json({error:'Session expired'},401);
 const{shipmentId,organisationId}=await req.json();if(typeof shipmentId!=='string'||typeof organisationId!=='string')return json({error:'Invalid request'},400);
 // RLS verifies the caller can see this shipment and org. Never accept caller-supplied rules or snapshots.
 const{data:shipment,error}=await userClient.from('shipments').select('data').eq('id',shipmentId).eq('organisation_id',organisationId).single();if(error||!shipment)return json({error:'Shipment access denied'},403);
 const{data:packs,error:packError}=await userClient.from('rule_packs').select('data').eq('data->>status','published');if(packError)throw packError;
 const result=compile(shipment.data,packs.map(p=>p.data));
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const{data:snapshot,error:saveError}=await admin.rpc('record_compilation',{org_id:organisationId,shipment_key:shipmentId,expected_shipment:shipment.data,result});if(saveError)throw saveError;
 return json(snapshot);
 }catch(e){return json({error:e instanceof Error?e.message:'Compilation failed'},400)}});
