import test from 'node:test';import assert from 'node:assert/strict';
import {MercadoPago} from '../server/mercadopago.mjs';import {MemoryStore,env} from './helpers.mjs';
test('checkout usa domínio fixo, três retornos, webhook e referência do servidor',async()=>{
  let captured;const fetcher=async(url,options)=>{captured={url,options};return Response.json({id:'pref-123',sandbox_init_point:'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=123'});};
  const mp=new MercadoPago(new MemoryStore(),env,fetcher),order={id:'order-123',productId:'prod-123',productTitle:'Produto de teste',totalCents:12345,platformCents:617,affiliateCents:1234,useSplit:true,liveMode:false};
  const r=await mp.checkout(order,'test-token','return-token');const body=JSON.parse(captured.options.body);
  assert.equal(captured.url,'https://api.mercadopago.com/checkout/preferences');assert.equal(body.external_reference,order.id);assert.equal(body.items[0].unit_price,123.45);assert.equal(body.marketplace_fee,18.51);assert.equal(body.auto_return,'approved');assert.equal(body.back_urls.success,body.back_urls.failure);assert.equal(body.back_urls.success,body.back_urls.pending);assert(body.notification_url.includes('/api/webhooks/mercadopago?order=order-123'));assert(r.checkoutUrl.startsWith('https://sandbox.mercadopago.com.br/'));
});
test('token não aparece na mensagem de erro e checkout fora do provedor é recusado',async()=>{
  const mp=new MercadoPago(new MemoryStore(),env,async()=>Response.json({error:'private-token'},{status:401}));await assert.rejects(()=>mp.account('private-token'),e=>!e.message.includes('private-token'));
  const malicious=new MercadoPago(new MemoryStore(),env,async()=>Response.json({id:'pref',sandbox_init_point:'https://evil.example/pay'}));await assert.rejects(()=>malicious.checkout({id:'o',totalCents:10000,platformCents:0,affiliateCents:0},'test','r'));
});
