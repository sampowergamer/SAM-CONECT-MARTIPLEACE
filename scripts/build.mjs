import {build} from 'esbuild';
import {mkdir,cp,rm,readFile,writeFile,rename} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';

// Compatibilidade do Firebase Admin 14 com servidores que desabilitam require(ESM).
// O jwks-rsa continua usando o jose original e todas as verificacoes de assinatura.
// Somente o carregamento de jose passa para import() nas funcoes de processamento.
const require=createRequire(import.meta.url);
const firebaseRequire=createRequire(require.resolve('firebase-admin/auth'));
const jwksDirectory=dirname(firebaseRequire.resolve('jwks-rsa'));
const marker='// SAM-CONECTA: jose carregado por import() para compatibilidade Netlify.';
const syncImport="const jose = require('jose');";
const asyncStart='async function retrieveSigningKeys(jwks) {';
const asyncImport="  const jose = await import('jose');";
async function applyCompatibility(relativePath,replacements){
  const path=join(jwksDirectory,relativePath),source=await readFile(path,'utf8');
  if(source.includes(marker)){
    if(source.includes(syncImport)||replacements.some(([,after])=>!source.includes(after)))throw new Error('A compatibilidade do Firebase precisa ser revisada.');
    return;
  }
  let patched=source;
  for(const [before,after] of replacements){
    if(patched.split(before).length!==2)throw new Error('A biblioteca jwks-rsa mudou. Revise a compatibilidade antes de publicar.');
    patched=patched.replace(before,after);
  }
  const temporary=path+'.sam-conecta-'+process.pid+'.tmp';
  await writeFile(temporary,patched,'utf8');await rename(temporary,path);
}
await applyCompatibility('utils.js',[
  [syncImport,marker],
  [asyncStart,asyncStart+'\n'+asyncImport]
]);
await applyCompatibility('integrations/passport.js',[
  [syncImport,marker],
  ['return function secretProvider(req, rawJwtToken, cb) {','return async function secretProvider(req, rawJwtToken, cb) {'],
  ['try {\n      decoded = {',"try {\n      const jose = await import('jose');\n      decoded = {"]
]);
console.log('Compatibilidade Firebase/Netlify verificada sem alterar a verificacao de tokens.');

await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
await cp('web','dist',{recursive:true});
await build({entryPoints:['web/app.js','web/mobile-auth.js'],bundle:true,outdir:'dist',format:'esm',minify:true,target:'es2022'});
console.log('Web compilado. Nenhuma credencial privada é incorporada ao cliente.');
