import test from 'node:test';import assert from 'node:assert/strict';
import {Service} from '../server/service.mjs';import {createHandler} from '../server/handler.mjs';import {challenge,hash} from '../server/domain.mjs';
import {MemoryStore,env,owner,seed,product,user} from './helpers.mjs';
const auth={verifyIdToken:async()=>({uid:'owner',email:'owner@example.com',email_verified:true,auth_time:Date.now()/1000}),createCustomToken:async uid=>'custom-'+uid};
test('login mobile usa código único e exige a prova PKCE correta',async()=>{
  const store=new MemoryStore(seed()),service=new Service(store,auth,env),handler=createHandler({service,env}),verifier='a'.repeat(43);
  const authorize=await handler(new Request('https://central.example/api/mobile/authorize',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({challenge:challenge(verifier)})}));assert.equal(authorize.status,200);const {code}=await authorize.json();
  const exchange=async v=>handler(new Request('https://central.example/api/mobile/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,verifier:v})}));
  assert.equal((await exchange('b'.repeat(43))).status,401);const accepted=await exchange(verifier);assert.equal(accepted.status,200);assert.equal((await accepted.json()).customToken,'custom-owner');assert.equal((await exchange(verifier)).status,401);
});
test('URL de retorno adulterada não confirma pagamento',async()=>{
  const store=new MemoryStore(seed()),service=new Service(store,auth,env),handler=createHandler({service,env});await store.set('orders','order123',{id:'order123',paymentStatus:'pending',totalCents:10000,client:'web',returnTokenHash:hash('known-return')});
  const r=await handler(new Request('https://central.example/api/return/status?order=order123&token=known-return&status=approved'));assert.equal((await r.json()).status,'pending');assert.equal((await handler(new Request('https://central.example/api/return/status?order=order123&token=wrong'))).status,404);
});
test('referência de repasse repetida não duplica baixa parcial',async()=>{
  const store=new MemoryStore(seed()),service=new Service(store,auth,env),handler=createHandler({service,env});await store.set('commissions','order123',{orderId:'order123',affiliateId:'affiliate',earnedCents:1000,paidCents:0});
  const payout=()=>handler(new Request('https://central.example/api/admin/commissions/order123/payout',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({amountCents:200,reference:'transfer-123'})}));
  assert.equal((await payout()).status,200);assert.equal((await payout()).status,200);assert.equal((await store.get('commissions','order123')).paidCents,200);assert.equal((await store.list('payouts')).items.length,1);
});
test('pagamento duplicado alerta a administração sem gerar segunda comissão',async()=>{
  const store=new MemoryStore(seed()),service=new Service(store,auth,env);const {id}=await service.createOrder(user(),{productId:product.id,affiliateId:'affiliate'},'request-test-123456');const o=await store.get('orders',id);await store.set('orders',id,{...o,saleMode:'online',collectorId:'123',liveMode:false,paymentStatus:'pending'});
  const payment={id:111,external_reference:id,collector_id:123,currency_id:'BRL',transaction_amount:100,status:'approved',live_mode:false,date_last_updated:'2026-11-20T12:00:00Z'};
  await service.settle(id,payment);await service.settle(id,{...payment,id:222,date_last_updated:'2026-11-20T13:00:00Z'});await service.settle(id,{...payment,id:222,date_last_updated:'2026-11-20T13:00:00Z'});
  const next=await store.get('orders',id);assert(next.needsAttention);assert.deepEqual(next.additionalPayments,['222']);assert.equal((await store.get('commissions',id)).earnedCents,1000);
});
