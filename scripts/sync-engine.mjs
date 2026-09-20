import fs from 'node:fs';
fs.copyFileSync('src/types/index.ts','supabase/functions/_shared/types.ts');
fs.copyFileSync('src/services/id.ts','supabase/functions/_shared/id.ts');
fs.writeFileSync('supabase/functions/_shared/engine.ts',fs.readFileSync('src/services/engine.ts','utf8').replace("'../types'","'./types.ts'").replace("'./id'","'./id.ts'"));
