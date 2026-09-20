import fs from 'node:fs';import {packs,seed} from '../src/services/seed';
const quote=(v:unknown)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const sql=['-- Fictional WAYPOINT demo rule packs only. Never use as official legal requirements.','-- Run using Supabase SQL editor / database owner. No real accounts or credentials seeded.'];
for(const source of seed().sources)sql.push(`insert into public.rule_sources(id,data) values('${source.id}',${quote(source)}) on conflict do nothing;`);
for(const p of packs)sql.push(`insert into public.rule_packs(id,version,data) values('${p.id}','${p.version}',${quote(p)}) on conflict do nothing;`);
fs.writeFileSync('supabase/seed.sql',sql.join('\n')+'\n');
