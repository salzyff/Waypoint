import {build} from 'esbuild';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'waypoint-seed-'));const outfile=path.join(dir,'seed.mjs');await build({entryPoints:['scripts/seed-sql.ts'],bundle:true,platform:'node',format:'esm',outfile});await import('file://'+outfile);fs.rmSync(dir,{recursive:true,force:true});
