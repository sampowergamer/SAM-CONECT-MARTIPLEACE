import {build} from 'esbuild';
import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
await cp('web','dist',{recursive:true});
await build({entryPoints:['web/app.js','web/mobile-auth.js'],bundle:true,outdir:'dist',format:'esm',minify:true,target:'es2022'});
console.log('Web compilado. Nenhuma credencial privada é incorporada ao cliente.');
