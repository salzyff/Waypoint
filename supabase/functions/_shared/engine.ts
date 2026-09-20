import {randomId} from './id.ts';
import type {Condition,Shipment,RulePack,Compilation,Result} from './types.ts';
export function evaluate(condition:Condition,data:Record<string,unknown>):boolean {
 if('all'in condition)return condition.all.every(c=>evaluate(c,data));
 if('any'in condition)return condition.any.some(c=>evaluate(c,data));
 const value=condition.field.split('.').reduce<unknown>((v,k)=>v&&typeof v==='object'?(v as Record<string,unknown>)[k]:undefined,data);
 switch(condition.op){
 case 'equals':return value===condition.value;
 case 'not_equals':return value!==condition.value;
 case 'in':return Array.isArray(condition.value)&&condition.value.includes(value);
 case 'gt':return typeof value==='number'&&value>Number(condition.value);
 case 'lt':return typeof value==='number'&&value<Number(condition.value);
 case 'exists':return value!==undefined&&value!==null&&value!==''&&value!==false;
 case 'missing':return value===undefined||value===null||value===''||value===false;
 case 'date_before':return Number.isFinite(Date.parse(String(value)))&&Date.parse(String(value))<Date.parse(String(condition.value));
 case 'date_after':return Number.isFinite(Date.parse(String(value)))&&Date.parse(String(value))>Date.parse(String(condition.value));
 }
}
export function selectPacks(packs:RulePack[],s:Shipment):RulePack[]{
 const latest=new Map<string,RulePack>();
 packs.filter(p=>p.status==='published'&&(p.country==='ALL'||p.country===s.origin||p.country===s.destination)).forEach(p=>{const old=latest.get(p.id);if(!old||p.version.localeCompare(old.version,undefined,{numeric:true})>0)latest.set(p.id,p)});return [...latest.values()];
}
export function compile(s:Shipment,packs:RulePack[],sequence=1,at=new Date().toISOString()):Compilation {
 const selected=selectPacks(packs,s);const docs:Record<string,boolean>={};
 s.documents.filter(d=>d.status==='available'&&(!d.country||d.country===s.destination)&&(!d.category||d.category===s.category)).forEach(d=>docs[d.type]=true);
 const data={...s,docs,expired:s.documents.some(d=>d.expires&&d.expires<s.shippingDate),originSimple:s.manufactured===s.origin&&s.localPercent>=60,valid:!!s.name&&!!s.description&&s.quantity>0&&s.weight>0&&s.value>0&&s.origin!==s.destination};
 const results:Result[]=selected.flatMap(p=>p.rules).filter(r=>(r.country==='ALL'||(r.direction==='origin'?s.origin:s.destination)===r.country)&&(r.category==='all'||r.category===s.category)&&r.effectiveFrom<=at.slice(0,10)&&(!r.effectiveUntil||r.effectiveUntil>=at.slice(0,10))&&evaluate(r.when,data)).map(rule=>({rule:structuredClone(rule),passed:evaluate(rule.check,data)}));
 const supported=results.some(r=>r.rule.direction==='destination');
 if(!supported)results.push({passed:false,rule:{id:'coverage',version:'1.0',country:'ALL',direction:'all',category:'all',stage:'Destination requirements',when:{all:[]},check:{all:[]},severity:'review',title:'No applicable destination rule pack',message:'The configured rule set does not cover this destination and product.',resolution:'Obtain professional review and publish a suitable rule pack.',sourceId:'demo',effectiveFrom:'2026-01-01',verifiedAt:'2026-09-12'}});
 const failed=results.filter(r=>!r.passed);const blockers=failed.filter(r=>r.rule.severity==='blocker').length;const warnings=failed.filter(r=>r.rule.severity==='warning').length;const reviews=failed.filter(r=>r.rule.severity==='review').length;
 const mandatory=results.filter(r=>r.rule.severity!=='warning');
 return {id:randomId(),shipmentId:s.id,sequence,at,status:blockers?'blocked':reviews?'review':warnings?'warning':'ready',results,mandatory:mandatory.length,completed:mandatory.filter(r=>r.passed).length,blockers,warnings,reviews,packs:selected.map(p=>({id:p.id,version:p.version})),shipment:structuredClone(s)};
}
export function diff(a:Compilation|undefined,b:Compilation){const old=a?.results??[];return {added:b.results.filter(r=>!old.some(x=>x.rule.id===r.rule.id)),removed:old.filter(r=>!b.results.some(x=>x.rule.id===r.rule.id)),resolved:b.results.filter(r=>r.passed&&old.some(x=>x.rule.id===r.rule.id&&!x.passed)),newIssues:b.results.filter(r=>!r.passed&&!old.some(x=>x.rule.id===r.rule.id&&!x.passed))};}
