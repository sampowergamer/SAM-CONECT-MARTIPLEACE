import {AppError,assert,seal,unseal,now,id,hash,challenge} from './domain.mjs';
const BASE='https://api.mercadopago.com';
export class MercadoPago {
  constructor(store,env,fetcher=fetch){this.store=store;this.env=env;this.fetcher=fetcher;}
  async credentials(){const doc=await this.store.get('privateIntegrations','mercadopago');return doc?unseal(doc.encrypted,this.env.TOKEN_ENCRYPTION_KEY):{};}
  async request(path,token,body,method='GET',idem=''){
    // Apenas o host oficial é aceito. Não há campo de URL de API arbitrária.
    let response;try{response=await this.fetcher(`${BASE}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...(idem?{'X-Idempotency-Key':idem}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(14000),redirect:'error'});}catch{throw new AppError(502,'PROVIDER_UNAVAILABLE','Não foi possível comunicar com o Mercado Pago. Tente novamente.');}
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new AppError(502,`MP_${response.status}`,'O Mercado Pago recusou a operação. Revise as credenciais, as permissões e o ambiente da conta.');
    return data;
  }
  async account(token){assert(token,409,'MP_CREDENTIALS','Cadastre o Access Token do Mercado Pago no painel web.');return this.request('/users/me',token);}
  async sellerCredentials(sellerId,ownerId){
    const central=await this.credentials();
    if(sellerId===ownerId){const account=await this.account(central.accessToken);return {accessToken:central.accessToken,collectorId:String(account.id)};}
    const doc=await this.store.get('privateSellers',sellerId);assert(doc,409,'SELLER_CONNECT','O vendedor precisa conectar sua conta Mercado Pago.');
    let tokens=unseal(doc.encrypted,this.env.TOKEN_ENCRYPTION_KEY);
    assert(tokens.expiresAt>Date.now()+60000,409,'SELLER_RECONNECT','A conexão do vendedor expirou. Reconecte o Mercado Pago na área de vendas.');
    return {accessToken:tokens.accessToken,collectorId:String(tokens.userId)};
  }
  async checkout(order,token,returnToken){
    const returnUrl=`${this.env.APP_URL}/retorno.html?order=${order.id}&token=${returnToken}`;
    const fee=order.platformCents+order.affiliateCents;
    const preference={items:[{id:order.productId,title:order.productTitle,quantity:1,currency_id:'BRL',unit_price:order.totalCents/100}],external_reference:order.id,back_urls:{success:returnUrl,pending:returnUrl,failure:returnUrl},auto_return:'approved',notification_url:`${this.env.APP_URL}/api/webhooks/mercadopago?order=${order.id}`,metadata:{order_id:order.id},...(order.useSplit&&fee>0?{marketplace_fee:fee/100}:{})};
    const result=await this.request('/checkout/preferences',token,preference,'POST',order.id);
    const url=order.liveMode?result.init_point:result.sandbox_init_point;
    assert(url&&/^https:\/\/([a-z0-9-]+\.)*mercadopago\.(com|com\.br)\//i.test(url),502,'CHECKOUT_URL','O provedor não retornou uma URL de checkout válida.');
    return {preferenceId:result.id,checkoutUrl:url};
  }
  async findPayments(order,token){
    const r=await this.request(`/v1/payments/search?external_reference=${encodeURIComponent(order.id)}&sort=date_last_updated&criteria=asc&limit=100`,token);
    return r.results||[];
  }
  async oauthStart(user){
    const c=await this.credentials();assert(c.clientId&&c.clientSecret,409,'OAUTH_SETUP','Configure Client ID e Client Secret da aplicação Mercado Pago no painel web.');
    const state=id(),verifier=id()+id(),stateId=hash(state);
    await this.store.set('oauthStates',stateId,{uid:user.uid,verifier,expiresAt:Date.now()+600000,used:false});
    const q=new URLSearchParams({client_id:c.clientId,response_type:'code',platform_id:'mp',state,redirect_uri:`${this.env.APP_URL}/api/oauth/mercadopago/callback`,code_challenge:challenge(verifier),code_challenge_method:'S256'});
    return `https://auth.mercadopago.com.br/authorization?${q}`;
  }
  async oauthFinish(code,state){
    assert(code&&state,400,'OAUTH_STATE','Autorização incompleta.');
    const st=await this.store.transaction(async tx=>{const value=await tx.get('oauthStates',hash(state));assert(value&&!value.used&&value.expiresAt>Date.now(),400,'OAUTH_STATE','Autorização expirada ou já utilizada.');tx.set('oauthStates',hash(state),{...value,used:true});return value;});
    const c=await this.credentials();
    const data=await this.request('/oauth/token','',{client_id:c.clientId,client_secret:c.clientSecret,code,grant_type:'authorization_code',redirect_uri:`${this.env.APP_URL}/api/oauth/mercadopago/callback`,code_verifier:st.verifier},'POST');
    assert(data.access_token&&data.user_id,502,'OAUTH_RESPONSE','Resposta de conexão incompleta.');
    const tokens={accessToken:data.access_token,refreshToken:data.refresh_token||'',userId:String(data.user_id),expiresAt:Date.now()+Number(data.expires_in||0)*1000,liveMode:!!data.live_mode};
    await this.store.set('privateSellers',st.uid,{encrypted:seal(tokens,this.env.TOKEN_ENCRYPTION_KEY),updatedAt:now()});
    return st.uid;
  }
}
