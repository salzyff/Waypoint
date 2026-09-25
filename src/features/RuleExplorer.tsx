import {useMemo,useState} from 'react';
import {ArrowUpRight,CheckCircle2,ChevronDown,ChevronUp,Search,ShieldCheck} from 'lucide-react';
import {PageHead,Badge,Modal,Notice} from '../components/ui';
import {useStore} from '../app/store';
import {categories,countries,type Rule} from '../types';

const fieldNames:Record<string,string>={
  valid:'complete shipment information',
  classification:'a product classification',
  confirmed:'classification confirmation',
  'docs.invoice':'a commercial invoice',
  'docs.packing':'a packing list',
  'docs.transport':'a transport document',
  'docs.compliance':'a product compliance certificate',
  'docs.declaration':'a destination declaration',
  originSimple:'supported manufacturing-origin information',
  expired:'documents that remain valid through shipping',
  value:'declared commercial value',
  currency:'a supported shipment currency',
  destination:'the selected destination country',
  category:'the selected product category'
};
const severityCopy:Record<Rule['severity'],string>={blocker:'This requirement can stop the shipment from being prepared.',review:'This requirement needs confirmation from you or a qualified professional.',warning:'This requirement does not stop preparation, but it needs attention.'};
const pretty=(value:unknown)=>typeof value==='string'?value.replace(/_/g,' '):String(value);
function fieldLabel(field:string){return fieldNames[field]??pretty(field);}
function conditionText(condition:any):string{
  if(!condition)return 'This rule has no additional condition.';
  if(Array.isArray(condition.all)){
    if(condition.all.length===0)return 'Applies to every shipment in the selected scope.';
    return condition.all.map(conditionText).join(' and ');
  }
  if(Array.isArray(condition.any))return condition.any.map(conditionText).join(' or ');
  if(!condition.field)return 'This rule uses a configured condition.';
  const label=fieldLabel(condition.field);
  if(condition.op==='exists')return `You must provide ${label}.`;
  if(condition.op==='missing')return `${label} must be missing.`;
  if(condition.op==='equals')return `${label} must be ${typeof condition.value==='boolean'?(condition.value?'complete':'not complete'):pretty(condition.value)}.`;
  if(condition.op==='not_equals')return `${label} must not be ${pretty(condition.value)}.`;
  if(condition.op==='gt')return `${label} must be greater than ${pretty(condition.value)}.`;
  if(condition.op==='lt')return `${label} must be less than ${pretty(condition.value)}.`;
  if(condition.op==='in')return `${label} must be one of the configured options.`;
  if(condition.op==='date_before')return `${label} must be before ${pretty(condition.value)}.`;
  if(condition.op==='date_after')return `${label} must be after ${pretty(condition.value)}.`;
  return `PASSAGE checks ${label}.`;
}
function severityStatus(severity:Rule['severity']){return severity==='blocker'?'blocked':severity==='review'?'review':'warning' as const;}

export function RuleExplorer(){
  const{state}=useStore();
  const[q,setQ]=useState('');const[country,setCountry]=useState('all');const[category,setCategory]=useState('all');const[direction,setDirection]=useState('all');const[type,setType]=useState('all');const[date,setDate]=useState('2026-09-19');const[selected,setSelected]=useState<Rule|null>(null);const[showLogic,setShowLogic]=useState(false);
  const rows=useMemo(()=>state.packs.filter(p=>p.status==='published'&&!p.id.endsWith('-DEMO')&&p.id.includes('OFFICIAL')).flatMap(p=>p.rules).filter(r=>r.title.toLowerCase().includes(q.toLowerCase())&&(country==='all'||r.country==='ALL'||r.country===country)&&(category==='all'||r.category==='all'||r.category===category)&&(direction==='all'||r.direction===direction||r.direction==='all')&&(type==='all'||r.severity===type)&&r.effectiveFrom<=date&&(!r.effectiveUntil||r.effectiveUntil>=date)),[state.packs,q,country,category,direction,type,date]);
  const source=selected?state.sources.find(s=>s.id===selected.sourceId):undefined;
  return <><PageHead eyebrow="TRACEABLE BY DESIGN" title="Understand every requirement." description="Read the checks Waypoint uses, why they matter, and the official source behind each one."/><div className="info-banner"><ShieldCheck size={18}/>These checks are source-backed preparation guidance, not a complete legal database. Confirm current requirements with the relevant authority or a licensed professional.</div><div className="filters"><label className="search-field"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search requirements…"/></label><select aria-label="Country" value={country} onChange={e=>setCountry(e.target.value)}><option value="all">All countries</option>{Object.entries(countries).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select aria-label="Severity" value={type} onChange={e=>setType(e.target.value)}><option value="all">All severities</option><option value="blocker">Blocker</option><option value="review">Professional review</option><option value="warning">Warning</option></select><select aria-label="Direction" value={direction} onChange={e=>setDirection(e.target.value)}><option value="all">All directions</option><option value="origin">Origin</option><option value="destination">Destination</option></select><input aria-label="Effective on date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="rule-list">{rows.map(r=><button className="panel rule-row" key={r.id} onClick={()=>{setSelected(r);setShowLogic(false)}}><span className="rule-icon"><ShieldCheck size={21}/></span><div><span className="mini-label">{r.country} · {r.stage}</span><h3>{r.title}</h3><p>{severityCopy[r.severity]} · Checked {r.verifiedAt}</p></div><Badge status={severityStatus(r.severity)}>{r.severity==='review'?'Review':r.severity}</Badge><ArrowUpRight size={18}/></button>)}</div><Modal open={!!selected} onClose={()=>setSelected(null)} title={selected?.title??'Requirement'}>{selected&&<div className="rule-detail"><div className="rule-detail-intro"><span className="rule-icon"><CheckCircle2 size={22}/></span><div><p>{selected.message}</p><span className="mini-label">{severityCopy[selected.severity]}</span></div></div><h4>What this checks</h4><p>{conditionText(selected.check)}</p><h4>Why it matters</h4><p>{selected.severity==='blocker'?'A missing requirement can prevent this shipment from being marked ready for preparation.':selected.severity==='review'?'Some trade decisions need a human interpretation before the shipment can be trusted.':'This is a preparation signal to review before the shipment moves.'}</p><h4>What to do next</h4><p>{selected.resolution}</p><div className="requirement-details"><div><label>Rule version</label><code>{selected.id}@{selected.version}</code></div><div><label>Applies to</label><span>{selected.country==='ALL'?'All configured corridors':countries[selected.country as keyof typeof countries]??selected.country} · {selected.stage}</span></div><div><label>Effective from</label><span>{selected.effectiveFrom}</span></div><div><label>Last checked</label><span>{selected.verifiedAt}</span></div><div><label>Source</label><span>{source?.title??'Source not recorded'}</span></div></div><button className="btn secondary" type="button" onClick={()=>setShowLogic(v=>!v)}>{showLogic?<ChevronUp size={15}/>:<ChevronDown size={15}/>} {showLogic?'Hide advanced rule logic':'View advanced rule logic'}</button>{showLogic&&<><p className="mini-label" style={{marginTop:16}}>This is the structured condition used by the compiler. It is provided for consultants and administrators.</p><pre className="code-block">{JSON.stringify({when:selected.when,requires:selected.check},null,2)}</pre></>}<h4>Affected recorded compilations</h4><p>{state.compilations.filter(c=>c.results.some(r=>r.rule.id===selected.id)).length} compilation snapshots reference this rule.</p></div>}</Modal><Notice/></>;
}
