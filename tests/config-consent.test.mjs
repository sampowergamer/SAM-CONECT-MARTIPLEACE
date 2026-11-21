import test from 'node:test';import assert from 'node:assert/strict';
import {Service} from '../server/service.mjs';import {MemoryStore,env,owner,settings,seed,user} from './helpers.mjs';
test('alteração de termos exige nova versão e não aceita consentimento antigo',async()=>{
  const store=new MemoryStore(seed()),service=new Service(store,{},env);
  await assert.rejects(()=>service.saveSettings(owner,{...settings,paymentsEnabled:false,termsText:'Termos alterados',expectedRevision:1}),e=>e.code==='TERMS_VERSION');
  const next=await service.saveSettings(owner,{...settings,paymentsEnabled:false,termsText:'Termos alterados',termsVersion:'v2',expectedRevision:1});assert.equal(next.termsVersion,'v2');
  await assert.rejects(()=>service.createOrder(user(),{productId:'product_1'},'idempotency-123456789'),e=>e.code==='PROFILE_REQUIRED');
});
test('troca de banco por uma chave é recusada sem modificar a configuração',async()=>{
  const store=new MemoryStore(seed()),service=new Service(store,{verifyIdToken:async()=>({uid:'owner',email:'owner@example.com',email_verified:true,auth_time:Date.now()/1000})},env);
  const request=new Request('https://central.example/api/admin/database',{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({provider:'other-database',key:'example'})});
  await assert.rejects(()=>service.route(request,'/admin/database',{provider:'other-database'},new URL(request.url)),e=>e.code==='MIGRATION_REQUIRED');assert.equal((await store.get('settings','public')).revision,1);
});
