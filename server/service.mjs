import {AppError,assert,now,id,hash,key,text,integer,image,defaults,settingsInput,profileInput,productInput,splitMoney,requireOwner,requireAdmin,operate,ready,seal,unseal,validWebhook,paymentTransition,providerRegistry,challenge} from './domain.mjs';
import {MercadoPago} from './mercadopago.mjs';
import {FirebaseImages} from './images.mjs';

export class Service {
  constructor(store,auth,env,provider,images){this.store=store;this.auth=auth;this.env=env;this.mp=provider||new MercadoPago(store,env);this.images=images||new FirebaseImages(store,env);}
  async settings(){return {...defaults,...await this.store.get('settings','public')};}
  async user(request){
    const bearer=request.headers.get('authorization')||'';assert(bearer.startsWith('Bearer '),401,'LOGIN_REQUIRED','Entre na sua conta.');
    let token;try{token=await this.auth.verifyIdToken(bearer.slice(7),true);}catch{throw new AppError(401,'INVALID_SESSION','Sua sessão expirou. Entre novamente.');}
    const owner=!!token.email_verified&&!!this.env.ADMIN_EMAIL&&token.email?.toLowerCase()===this.env.ADMIN_EMAIL.toLowerCase();
    let p=await this.store.get('profiles',token.uid);
    if(!p){p={uid:token.uid,email:token.email||'',fullName:token.name||'',photo:token.picture||'',status:'active',role:'user',completed:false,createdAt:now()};
      p=await this.store.transaction(async tx=>{const old=await tx.get('profiles',token.uid);if(old)return old;tx.set('profiles',token.uid,p);return p;});}
    assert(p.status==='active',403,'SUSPENDED','Sua conta está desativada. Contate a administração.');
    return {...p,uid:token.uid,isOwner:owner,isAdmin:owner||p.role==='admin',emailVerified:!!token.email_verified,authTime:token.auth_time};
  }
  audit(tx,user,action,target,detail={}){tx.set('audit',id(),{actor:user.uid,action,target,detail,createdAt:now()});}
  notice(tx,nid,title,message,audience,orderId=''){tx.set('notifications',nid,{title,message,audience:[...new Set(audience.filter(Boolean))],orderId,createdAt:now()});}
  async limit(uid,action,maximum,windowMs=60000){
    const stamp=Math.floor(Date.now()/windowMs),rid=hash(`${uid}:${action}:${stamp}`);
    await this.store.transaction(async tx=>{const r=await tx.get('rates',rid);assert((r?.count||0)<maximum,429,'RATE_LIMIT','Muitas tentativas. Aguarde um pouco e tente novamente.');tx.set('rates',rid,{count:(r?.count||0)+1,expiresAt:Date.now()+windowMs*2});});
  }
  owner(user,recent=false){requireOwner(user);if(recent)assert(Date.now()/1000-user.authTime<900,401,'REAUTHENTICATE','Entre novamente na conta para alterar credenciais.');}
  publicProduct(p){const {sellerId,title,description,category,priceCents,affiliateBp,image,saleMode,stock,status,createdAt,updatedAt}=p;return {id:p.id,sellerId,title,description,category,priceCents,affiliateBp,image,saleMode,stock,status,createdAt,updatedAt};}
  async saveSettings(user,body){
    this.owner(user);const result=await this.store.transaction(async tx=>{
      const old={...defaults,...await tx.get('settings','public')};assert(body.expectedRevision===old.revision,409,'CONFIG_CHANGED','As configurações mudaram. Atualize a página e tente novamente.');
      const next=settingsInput(body,old);
      if((old.termsText||old.privacyText)&&(next.termsText!==old.termsText||next.privacyText!==old.privacyText))assert(next.termsVersion!==old.termsVersion,400,'TERMS_VERSION','Atualize a versão ao alterar os termos ou a privacidade.');
      if(next.paymentsEnabled){
        assert(this.env.PAYMENTS_ENABLED==='true',409,'PAYMENTS_ENV','Ative PAYMENTS_ENABLED no ambiente Netlify após homologar a conta.');
        const integration=await tx.get('privateIntegrations','mercadopago');const health=await tx.get('integrationHealth','mercadopago');
        assert(integration&&health?.credentialRevision===integration.revision&&health?.authenticated&&Date.now()-Date.parse(health.checkedAt)<900000,409,'TEST_REQUIRED','Salve as credenciais e teste a conexão Mercado Pago antes de habilitar os pagamentos.');
      }
      next.revision=old.revision+1;next.updatedAt=now();tx.set('settings','public',next);this.audit(tx,user,'settings.updated','public',{revision:next.revision});return next;
    });return result;
  }
  async saveIntegration(user,body){
    this.owner(user,true);await this.limit(user.uid,'credentials',10);
    const allowed=['accessToken','clientId','clientSecret','webhookSecret'];
    await this.store.transaction(async tx=>{
      const old=await tx.get('privateIntegrations','mercadopago'),config={...defaults,...await tx.get('settings','public')};assert(body.expectedRevision===(old?.revision||0),409,'CONFIG_CHANGED','A conexão mudou. Atualize a página.');
      const c=old?unseal(old.encrypted,this.env.TOKEN_ENCRYPTION_KEY):{};
      for(const k of allowed)if(body[k])c[k]=text(body[k],1,4000);
      if(body.environment!==undefined){assert(['test','production'].includes(body.environment),400,'ENVIRONMENT','Ambiente inválido.');c.environment=body.environment;}
      assert(c.accessToken&&c.webhookSecret,400,'CREDENTIALS','Informe Access Token e segredo da assinatura Webhook.');
      tx.set('privateIntegrations','mercadopago',{encrypted:seal(c,this.env.TOKEN_ENCRYPTION_KEY),revision:(old?.revision||0)+1,updatedAt:now()});
      tx.set('settings','public',{...config,paymentsEnabled:false,revision:config.revision+1,updatedAt:now()});
      this.audit(tx,user,'integration.credentials.updated','mercadopago');
    });
    return {saved:true};
  }
  async integrations(user){
    this.owner(user);const doc=await this.store.get('privateIntegrations','mercadopago');
    const c=doc?unseal(doc.encrypted,this.env.TOKEN_ENCRYPTION_KEY):{};
    const health=await this.store.get('integrationHealth','mercadopago');
    return {providers:providerRegistry,mercadopago:{revision:doc?.revision||0,configured:!!doc,environment:c.environment||'test',fields:{accessToken:!!c.accessToken,clientId:!!c.clientId,clientSecret:!!c.clientSecret,webhookSecret:!!c.webhookSecret},health},firebase:{projectId:this.env.FIREBASE_PROJECT_ID,health:await this.store.get('integrationHealth','firebase')}};
  }
  async testIntegration(user,provider){
    this.owner(user);await this.limit(user.uid,'connection-test',6);let result;
    if(provider==='firebase'){
      const probe=id();await this.store.set('connectionProbes',probe,{createdAt:now()});const read=await this.store.get('connectionProbes',probe);await this.store.remove('connectionProbes',probe);
      result={authenticated:true,checkedAt:now(),checks:[{name:'Sessão administrativa validada',ok:true},{name:'Leitura e gravação no Firestore',ok:!!read}],scope:'Não testa entregas de e-mail, push, cotas nem disponibilidade futura.'};
    }else if(provider==='mercadopago'){
      const doc=await this.store.get('privateIntegrations','mercadopago');assert(doc,409,'CREDENTIALS','Cadastre as credenciais primeiro.');
      const c=unseal(doc.encrypted,this.env.TOKEN_ENCRYPTION_KEY);
      try{const account=await this.mp.account(c.accessToken);result={authenticated:true,credentialRevision:doc.revision,checkedAt:now(),accountId:String(account.id),checks:[{name:'API respondeu e autenticou a conta',ok:true},{name:'Segredo de Webhook cadastrado',ok:!!c.webhookSecret},{name:'OAuth de vendedores configurado',ok:!!(c.clientId&&c.clientSecret)}],scope:'Autenticação confirmada. Pagamento, repasse, estorno e retorno ao APK exigem teste de ponta a ponta.'};}
      catch(e){result={authenticated:false,credentialRevision:doc.revision,checkedAt:now(),checks:[{name:'Autenticação',ok:false}],scope:e.message};}
    }else throw new AppError(422,'ADAPTER_REQUIRED','Este serviço ainda precisa de um conector implementado.');
    await this.store.set('integrationHealth',provider,result);return result;
  }
  async saveProduct(user,body,productId=''){
    const cfg=await this.settings();ready(user,cfg);assert(cfg.marketplaceEnabled,409,'MARKETPLACE_DISABLED','O catálogo está desativado.');assert(user.seller||user.isAdmin,403,'SELLER_REQUIRED','Ative a opção de vendedor no seu perfil.');
    const data=productInput(body,cfg);splitMoney(data.priceCents,cfg.platformFeeBp,data.affiliateBp);data.image=await this.images.put(data.image,user.uid);
    const pid=productId||id();await this.store.transaction(async tx=>{const old=productId?await tx.get('products',key(pid)):null;
      assert(!productId||old,404,'NOT_FOUND','Produto não encontrado.');assert(!old||old.sellerId===user.uid||user.isAdmin,403,'FORBIDDEN','Você não pode alterar esse produto.');
      const result={...old,...data,sellerId:old?.sellerId||user.uid,status:user.isAdmin?'published':'pending',createdAt:old?.createdAt||now(),updatedAt:now()};tx.set('products',pid,result);this.audit(tx,user,'product.saved',pid);
      this.notice(tx,id(),'Produto enviado',`${data.title}: ${user.isAdmin?'publicado':'aguardando aprovação'}.`,['admin',user.uid]);});return {id:pid};
  }
  async createOrder(user,body,idem){
    assert(idem&&/^[A-Za-z0-9_-]{16,100}$/.test(idem),400,'IDEMPOTENCY_KEY','Chave de pedido ausente. Atualize e tente novamente.');await this.limit(user.uid,'orders',15);
    const idemId=hash(`${user.uid}:${idem}`),existing=await this.store.get('orderKeys',idemId);if(existing)return {id:existing.orderId};
    const product=await this.store.get('products',key(body.productId));assert(product,404,'NOT_FOUND','Produto não encontrado.');
    const cfg=await this.settings();ready(user,cfg);assert(user.emailVerified,403,'EMAIL_REQUIRED','Confirme seu e-mail antes de comprar.');
    let connection=null,mpCredentials=null;
    if(product.saleMode==='online'){
      assert(cfg.paymentsEnabled&&this.env.PAYMENTS_ENABLED==='true',409,'PAYMENTS_DISABLED','Os pagamentos online ainda não estão habilitados.');
      const seller=await this.store.get('profiles',product.sellerId);const ownerId=seller?.email?.toLowerCase()===this.env.ADMIN_EMAIL?.toLowerCase()?product.sellerId:'';
      connection=await this.mp.sellerCredentials(product.sellerId,ownerId);mpCredentials=await this.mp.credentials();
    }
    const orderId=id(),returnToken=id()+id();
    const result=await this.store.transaction(async tx=>{
      const duplicate=await tx.get('orderKeys',idemId);if(duplicate)return {id:duplicate.orderId};
      const settings={...defaults,...await tx.get('settings','public')},p=await tx.get('products',product.id),seller=await tx.get('profiles',product.sellerId);
      const freshBuyer=await tx.get('profiles',user.uid);ready({...user,...freshBuyer},settings);
      assert(settings.marketplaceEnabled&&p?.status==='published'&&p.stock>0&&seller?.status==='active',409,'UNAVAILABLE','Produto indisponível.');
      assert(p.sellerId!==user.uid,400,'OWN_PRODUCT','Você não pode comprar o próprio produto.');
      assert(p.saleMode!=='online'||settings.paymentsEnabled,409,'PAYMENTS_DISABLED','Pagamentos desabilitados.');
      assert(p.sellerId===product.sellerId&&p.saleMode===product.saleMode,409,'PRODUCT_CHANGED','O produto mudou. Tente novamente.');
      let affiliateId='';if(body.affiliateId&&settings.affiliatesEnabled){key(body.affiliateId);const aff=await tx.get('profiles',body.affiliateId);assert(aff?.affiliate&&aff.status==='active'&&aff.completed,400,'AFFILIATE_INVALID','Indicação indisponível.');assert(![user.uid,p.sellerId].includes(body.affiliateId),400,'SELF_REFERRAL','A indicação deve ser de outra pessoa.');affiliateId=body.affiliateId;}
      const amounts=splitMoney(p.priceCents,settings.platformFeeBp,affiliateId?p.affiliateBp:0);
      const order={id:orderId,productId:p.id,productTitle:p.title,sellerId:p.sellerId,buyerId:user.uid,affiliateId,members:[...new Set([user.uid,p.sellerId,affiliateId].filter(Boolean))],totalCents:p.priceCents,...amounts,feeBp:settings.platformFeeBp,affiliateBp:affiliateId?p.affiliateBp:0,paymentStatus:p.saleMode==='manual'?'manual_review':'awaiting_checkout',saleMode:p.saleMode,fulfillment:'new',inventoryState:'reserved',configRevision:settings.revision,client:['android','android-adm'].includes(body.client)?body.client:'web',returnTokenHash:hash(returnToken),liveMode:mpCredentials?.environment==='production',collectorId:connection?.collectorId||'',useSplit:!!connection&&seller.email?.toLowerCase()!==this.env.ADMIN_EMAIL?.toLowerCase(),createdAt:now(),updatedAt:now(),commissionCents:0,recognizedFeeCents:0};
      tx.set('orders',orderId,order);tx.set('orderKeys',idemId,{orderId});tx.set('products',p.id,{...p,stock:p.stock-1});
      this.notice(tx,`new_${orderId}`,p.saleMode==='manual'?'Negociação precisa de atendimento':'Pedido criado',p.title,['admin',user.uid,p.sellerId],orderId);this.audit(tx,user,'order.created',orderId);return {id:orderId,newOrder:order};
    });
    if(result.newOrder?.saleMode==='online'){
      try{const checkout=await this.mp.checkout(result.newOrder,connection.accessToken,returnToken);await this.store.transaction(async tx=>{const o=await tx.get('orders',orderId);tx.set('orders',orderId,{...o,...checkout,paymentStatus:o.paymentStatus==='awaiting_checkout'?'pending':o.paymentStatus,updatedAt:now()});});return {id:orderId,...checkout};}
      catch(e){await this.store.transaction(async tx=>{const o=await tx.get('orders',orderId);tx.set('orders',orderId,{...o,checkoutError:true,updatedAt:now()});this.notice(tx,`checkout_${orderId}`,'Checkout precisa de revisão','Não foi possível confirmar a criação do checkout. Confira o pedido antes de repetir.',['admin',user.uid],orderId);});throw new AppError(502,'CHECKOUT_REVIEW',`Pedido ${orderId} registrado, mas o checkout precisa de revisão. Consulte Meus pedidos.`);}
    }return {id:result.id};
  }
  async settle(orderId,payment){
    return this.store.transaction(async tx=>{
      const o=await tx.get('orders',key(orderId));assert(o&&o.saleMode==='online',404,'NOT_FOUND','Pedido não encontrado.');
      const transition=paymentTransition(o,payment);if(!transition){
        if(o.paymentId&&o.paymentId!==String(payment.id)&&payment.status==='approved'&&!(o.additionalPayments||[]).includes(String(payment.id))){
          const next={...o,needsAttention:true,additionalPayments:[...(o.additionalPayments||[]),String(payment.id)].slice(-20)};tx.set('orders',o.id,next);this.notice(tx,hash(`duplicate:${o.id}:${payment.id}`),'Possível pagamento em duplicidade','Confira o pedido e os pagamentos no provedor.',['admin',...o.members],o.id);return next;
        }return o;
      }
      const p=await tx.get('products',o.productId),ledger=o.affiliateId?await tx.get('commissions',o.id):null;
      let inventoryState=o.inventoryState,attention=!!o.needsAttention;
      const paid=['paid','partially_refunded'].includes(transition.paymentStatus);
      if(paid&&inventoryState==='released'){if(p&&p.stock>0)tx.set('products',p.id,{...p,stock:p.stock-1});else attention=true;inventoryState='consumed';}
      else if(paid&&inventoryState==='reserved')inventoryState='consumed';
      else if(['cancelled','rejected'].includes(transition.paymentStatus)&&inventoryState==='reserved'){if(p)tx.set('products',p.id,{...p,stock:p.stock+1});inventoryState='released';}
      const next={...o,...transition,inventoryState,needsAttention:attention};tx.set('orders',o.id,next);
      if(o.affiliateId)tx.set('commissions',o.id,{...ledger,orderId:o.id,affiliateId:o.affiliateId,productTitle:o.productTitle,earnedCents:transition.commissionCents,paidCents:ledger?.paidCents||0,paymentStatus:transition.paymentStatus,updatedAt:now()});
      this.notice(tx,hash(`${o.id}:${transition.paymentId}:${transition.paymentUpdatedAt}:${transition.paymentStatus}`),'Pagamento atualizado',`${o.productTitle}: ${{paid:'pago',pending:'pendente',rejected:'recusado',cancelled:'cancelado',refunded:'estornado',partially_refunded:'estorno parcial',charged_back:'contestação',disputed:'em contestação'}[transition.paymentStatus]||transition.paymentStatus}.`,['admin',...o.members],o.id);
      return next;
    });
  }
  safeOrder(order){const {returnTokenHash,...safe}=order;return safe;}
  async orderToken(order){
    const seller=await this.store.get('profiles',order.sellerId);const ownerId=seller?.email?.toLowerCase()===this.env.ADMIN_EMAIL?.toLowerCase()?order.sellerId:'';
    const c=await this.mp.sellerCredentials(order.sellerId,ownerId);assert(c.collectorId===order.collectorId,409,'COLLECTOR_CHANGED','A conta de recebimento mudou. Revise este pedido no ADM.');return c.accessToken;
  }
  async syncOrder(orderId){const o=await this.store.get('orders',key(orderId));assert(o,404,'NOT_FOUND','Pedido não encontrado.');if(o.saleMode!=='online')return o;const token=await this.orderToken(o),payments=await this.mp.findPayments(o,token);let result=o;for(const p of payments)result=await this.settle(o.id,p);return result;}
  async webhook(request,url){
    const dataId=url.searchParams.get('data.id');let orderId=url.searchParams.get('order');
    const c=await this.mp.credentials();assert(validWebhook({signature:request.headers.get('x-signature'),requestId:request.headers.get('x-request-id'),dataId,secret:c.webhookSecret}),401,'WEBHOOK_SIGNATURE','Assinatura inválida.');
    const body=await request.json().catch(()=>({}));if(body.type!=='payment')return {received:true,ignored:true};
    assert(String(body.data?.id)===String(dataId),400,'WEBHOOK_ID','Identificador inconsistente.');
    if(!orderId){const r=await this.store.list('orders',[['collectorId','==',String(body.user_id||'')]],'',1);if(!r.items.length)return {received:true,ignored:true};orderId=r.items[0].id;}
    const o=await this.store.get('orders',key(orderId));assert(o,404,'NOT_FOUND','Pedido não encontrado.');const token=await this.orderToken(o);
    const payment=await this.mp.request(`/v1/payments/${encodeURIComponent(dataId)}`,token);
    const targetId=url.searchParams.get('order')||payment.external_reference;await this.settle(key(targetId),payment);return {received:true};
  }
  async manualUpdate(user,oid,body){
    requireAdmin(user);return this.store.transaction(async tx=>{
      const o=await tx.get('orders',key(oid));assert(o,404,'NOT_FOUND','Pedido não encontrado.');
      const p=await tx.get('products',o.productId),ledger=o.affiliateId?await tx.get('commissions',o.id):null;
      if(body.action==='confirm'){
        assert(o.saleMode==='manual'&&o.paymentStatus==='manual_review',409,'MANUAL_ONLY','A confirmação manual é exclusiva de negociações assistidas abertas.');
        const reference=text(body.reference,5,180);assert(body.totalCents===o.totalCents,400,'AMOUNT','O valor recebido precisa corresponder ao pedido.');
        tx.set('orders',o.id,{...o,paymentStatus:'paid',manualReference:reference,confirmedBy:user.uid,inventoryState:'consumed',commissionCents:o.affiliateCents,recognizedFeeCents:o.platformCents,updatedAt:now()});
        if(o.affiliateId)tx.set('commissions',o.id,{...ledger,orderId:o.id,affiliateId:o.affiliateId,productTitle:o.productTitle,earnedCents:o.affiliateCents,paidCents:ledger?.paidCents||0,paymentStatus:'paid',updatedAt:now()});
      }else if(body.action==='cancel'){
        assert(o.saleMode==='manual'&&o.paymentStatus==='manual_review',409,'MANUAL_ONLY','Apenas negociações assistidas abertas podem ser canceladas manualmente.');
        tx.set('orders',o.id,{...o,paymentStatus:'cancelled',inventoryState:'released',updatedAt:now()});if(p)tx.set('products',p.id,{...p,stock:p.stock+1});
      }else if(body.action==='fulfill'){
        assert(['paid','partially_refunded'].includes(o.paymentStatus),409,'UNPAID','O pagamento precisa estar confirmado.');
        assert(['processing','shipped','completed'].includes(body.fulfillment),400,'FULFILLMENT','Situação de entrega inválida.');tx.set('orders',o.id,{...o,fulfillment:body.fulfillment,updatedAt:now()});
      }else throw new AppError(400,'ACTION','Ação inválida.');
      this.audit(tx,user,`order.${body.action}`,o.id);this.notice(tx,id(),'Pedido atualizado',o.productTitle,['admin',...o.members],o.id);return {saved:true};
    });
  }
  async route(request,path,body,url){
    const method=request.method;
    const imageRoute=path.match(/^\/images\/([\w-]+)$/);if(imageRoute&&method==='GET')return this.images.read(imageRoute[1]);
    if(path==='/webhooks/mercadopago'&&method==='POST')return this.webhook(request,url);
    if(path==='/oauth/mercadopago/callback'&&method==='GET'){
      await this.mp.oauthFinish(url.searchParams.get('code'),url.searchParams.get('state'));return {redirect:`${this.env.APP_URL}/?connected=mercadopago#vendas`};
    }
    if(path==='/return/status'&&method==='GET'){
      const o=await this.store.get('orders',key(url.searchParams.get('order')));assert(o&&hash(url.searchParams.get('token')||'')===o.returnTokenHash,404,'NOT_FOUND','Retorno não encontrado.');
      return {id:o.id,status:o.paymentStatus,totalCents:o.totalCents,client:o.client};
    }
    if(path==='/mobile/exchange'&&method==='POST'){
      key(body.code);text(body.verifier,43,160);await this.limit(hash(body.code),'exchange',5);
      const uid=await this.store.transaction(async tx=>{const c=await tx.get('mobileCodes',hash(body.code));assert(c&&!c.used&&c.expiresAt>Date.now()&&c.challenge===challenge(body.verifier),401,'MOBILE_CODE','Autorização inválida ou expirada.');tx.set('mobileCodes',hash(body.code),{...c,used:true});return c.uid;});
      const profile=await this.store.get('profiles',uid);assert(profile?.status==='active',403,'SUSPENDED','Conta desativada.');return {customToken:await this.auth.createCustomToken(uid)};
    }
    if(path==='/catalog'&&method==='GET'){
      const cfg=await this.settings();if(!cfg.marketplaceEnabled)return {items:[],nextCursor:null};
      const result=await this.store.list('products',[['status','==','published']],url.searchParams.get('cursor')||'');return {...result,items:result.items.map(p=>this.publicProduct(p))};
    }
    if(path==='/news'&&method==='GET')return this.store.list('news',[['published','==',true]],url.searchParams.get('cursor')||'');
    if(path==='/projects'&&method==='GET'){const cfg=await this.settings();if(!cfg.projectsEnabled)return {items:[],nextCursor:null};return this.store.list('projects',[['status','==','published']],url.searchParams.get('cursor')||'');}
    const user=await this.user(request),cfg=await this.settings();
    if(path==='/me'&&method==='GET')return {user,settings:cfg,sellerConnected:!!await this.store.get('privateSellers',user.uid)};
    if(path==='/profile'&&method==='PUT'){
      const input=profileInput(body,cfg);await this.store.transaction(async tx=>{const p=await tx.get('profiles',user.uid);assert(p?.status==='active',403,'SUSPENDED','Conta desativada.');tx.set('profiles',user.uid,{...p,...input,updatedAt:now()});});return {saved:true};
    }
    if(path==='/mobile/authorize'&&method==='POST'){
      assert(typeof body.challenge==='string'&&/^[A-Za-z0-9_-]{43}$/.test(body.challenge),400,'CHALLENGE','Solicitação de login inválida.');await this.limit(user.uid,'mobile-auth',10);const code=id();await this.store.set('mobileCodes',hash(code),{uid:user.uid,challenge:body.challenge,expiresAt:Date.now()+120000,used:false});return {code};
    }
    if(path==='/notifications'&&method==='GET')return this.store.list('notifications',[[ 'audience',user.isAdmin?'array-contains-any':'array-contains',user.isAdmin?[user.uid,'admin']:user.uid]],url.searchParams.get('cursor')||'');
    if(path==='/products/mine'&&method==='GET')return this.store.list('products',[['sellerId','==',user.uid]],url.searchParams.get('cursor')||'');
    if(path==='/products'&&method==='POST')return this.saveProduct(user,body);
    let m;
    if((m=path.match(/^\/products\/([\w-]+)$/))&&method==='PUT')return this.saveProduct(user,body,m[1]);
    if(path==='/orders'&&method==='POST')return this.createOrder(user,body,request.headers.get('idempotency-key'));
    if(path==='/orders'&&method==='GET')return this.store.list('orders',[['members','array-contains',user.uid]],url.searchParams.get('cursor')||'').then(r=>({...r,items:r.items.map(o=>this.safeOrder(o))}));
    if((m=path.match(/^\/orders\/([\w-]+)(\/sync)?$/))){
      const o=await this.store.get('orders',m[1]);assert(o&&(o.members.includes(user.uid)||user.isAdmin),404,'NOT_FOUND','Pedido não encontrado.');
      if(method==='POST'&&m[2]){await this.limit(user.uid,'payment-sync',8);return this.safeOrder(await this.syncOrder(o.id));}if(method==='GET'&&!m[2])return this.safeOrder(o);
    }
    if(path==='/commissions'&&method==='GET')return this.store.list('commissions',[['affiliateId','==',user.uid]],url.searchParams.get('cursor')||'');
    if(path==='/seller/connect'&&method==='POST'){ready(user,cfg);assert(user.seller,403,'SELLER_REQUIRED','Ative seu perfil de vendedor.');return {url:await this.mp.oauthStart(user)};}
    if(path==='/project-requests'&&method==='POST'){
      ready(user,cfg);assert(cfg.projectsEnabled,409,'PROJECTS_DISABLED','Projetos não habilitados.');const p=await this.store.get('projects',key(body.projectId));assert(p?.status==='published',404,'NOT_FOUND','Projeto indisponível.');
      const rid=id();await this.store.transaction(async tx=>{tx.set('projectRequests',rid,{uid:user.uid,projectId:p.id,projectTitle:p.title,amountCents:integer(body.amountCents,p.minimumCents),status:'requested',createdAt:now()});this.notice(tx,id(),'Interesse em projeto',p.title,['admin',user.uid]);});return {id:rid,status:'requested'};
    }
    if(!path.startsWith('/admin/'))throw new AppError(404,'NOT_FOUND','Operação não encontrada.');
    requireAdmin(user);
    if(path==='/admin/settings'&&method==='PUT')return this.saveSettings(user,body);
    if(path==='/admin/integrations'&&method==='GET')return this.integrations(user);
    if(path==='/admin/integrations/mercadopago'&&method==='PUT')return this.saveIntegration(user,body);
    if((m=path.match(/^\/admin\/integrations\/([\w-]+)\/test$/))&&method==='POST')return this.testIntegration(user,m[1]);
    if(path==='/admin/database'&&method==='PUT'){this.owner(user);throw new AppError(409,'MIGRATION_REQUIRED','A troca de banco exige adaptador, cópia, validação e plano de retorno. O banco atual foi preservado.');}
    const lists={'/admin/users':'profiles','/admin/products':'products','/admin/orders':'orders','/admin/news':'news','/admin/projects':'projects','/admin/project-requests':'projectRequests','/admin/commissions':'commissions','/admin/audit':'audit'};
    if(lists[path]&&method==='GET'){
      if(['/admin/audit','/admin/users','/admin/commissions'].includes(path))this.owner(user);
      const r=await this.store.list(lists[path],[],url.searchParams.get('cursor')||'');return {...r,items:lists[path]==='orders'?r.items.map(o=>this.safeOrder(o)):r.items};
    }
    if((m=path.match(/^\/admin\/users\/([\w-]+)$/))&&method==='PUT'){
      this.owner(user);assert(m[1]!==user.uid,400,'OWNER_PROTECTED','A conta proprietária não pode ser desativada por este painel.');
      await this.store.transaction(async tx=>{const p=await tx.get('profiles',m[1]);assert(p,404,'NOT_FOUND','Usuário não encontrado.');assert(['active','suspended'].includes(body.status)&&['user','admin'].includes(body.role),400,'STATUS','Situação ou função inválida.');tx.set('profiles',p.uid,{...p,status:body.status,role:body.role,updatedAt:now()});this.audit(tx,user,'user.updated',p.uid,{status:body.status,role:body.role});});if(body.status==='suspended')await this.auth.revokeRefreshTokens(m[1]);return {saved:true};
    }
    if((m=path.match(/^\/admin\/products\/([\w-]+)\/status$/))&&method==='PUT'){
      assert(['published','paused','rejected'].includes(body.status),400,'STATUS','Situação inválida.');await this.store.transaction(async tx=>{const p=await tx.get('products',m[1]);assert(p,404,'NOT_FOUND','Produto não encontrado.');tx.set('products',p.id,{...p,status:body.status,updatedAt:now()});this.audit(tx,user,'product.moderated',p.id,{status:body.status});});return {saved:true};
    }
    if((m=path.match(/^\/admin\/orders\/([\w-]+)$/))&&method==='PUT')return this.manualUpdate(user,m[1],body);
    if((m=path.match(/^\/admin\/commissions\/([\w-]+)\/payout$/))&&method==='POST'){
      this.owner(user);const reference=text(body.reference,5,180),amount=integer(body.amountCents,1);
      await this.store.transaction(async tx=>{const payoutId=hash(`${m[1]}:${reference}`),previous=await tx.get('payouts',payoutId),c=await tx.get('commissions',m[1]);if(previous){assert(previous.amountCents===amount,409,'PAYOUT_REFERENCE','Essa referência já foi registrada com outro valor.');return;}assert(c&&c.earnedCents-c.paidCents>=amount,409,'BALANCE','Valor superior à comissão pendente de repasse.');tx.set('commissions',c.id,{...c,paidCents:c.paidCents+amount,updatedAt:now()});tx.set('payouts',payoutId,{orderId:c.id,affiliateId:c.affiliateId,amountCents:amount,reference,recordedBy:user.uid,createdAt:now()});this.audit(tx,user,'commission.external-payout.recorded',c.id,{amountCents:amount,reference});this.notice(tx,payoutId,'Repasse registrado','A administração registrou um repasse externo de comissão.',[c.affiliateId,'admin'],c.id);});return {saved:true};
    }
    if(path==='/admin/news'&&method==='POST'){
      const nid=body.id?key(body.id):id(),data={title:text(body.title,3,160),body:text(body.body,5,10000),image:await this.images.put(body.image,user.uid),published:body.published===true,updatedAt:now()};await this.store.transaction(async tx=>{tx.set('news',nid,data);this.audit(tx,user,'news.saved',nid);});return {id:nid};
    }
    if(path==='/admin/projects'&&method==='POST'){
      this.owner(user);const pid=body.id?key(body.id):id();assert(['draft','published','paused'].includes(body.status),400,'STATUS','Situação inválida.');
      const data={title:text(body.title,3,120),description:text(body.description,10,10000),image:await this.images.put(body.image,user.uid),minimumCents:integer(body.minimumCents,100),targetCents:integer(body.targetCents,100),estimatedMonthlyBp:integer(body.estimatedMonthlyBp,0,10000),status:body.status,updatedAt:now()};
      await this.store.transaction(async tx=>{tx.set('projects',pid,data);this.audit(tx,user,'project.saved',pid);});return {id:pid};
    }
    throw new AppError(404,'NOT_FOUND','Operação não encontrada.');
  }
}
