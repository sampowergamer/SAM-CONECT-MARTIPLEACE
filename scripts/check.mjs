import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
for(const d of ['server','netlify/functions','web','scripts']) for(const f of readdirSync(d).filter(x=>/\.(mjs|js)$/.test(x))){
  const r=spawnSync(process.execPath,['--check',`${d}/${f}`],{stdio:'inherit'}); if(r.status)process.exit(r.status);
}
console.log('Sintaxe verificada.');
