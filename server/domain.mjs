import {createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv} from 'node:crypto';

export class AppError extends Error {
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
export function assert(ok,status,code,message){if(!ok)throw new AppError(status,code,message);}
export const now=()=>new Date().toISOString();
export const id=()=>randomBytes(18).toString('base64url');
export const hash=s=>createHash('sha256').update(String(s)).digest('hex');
export const challenge=s=>createHash('sha256').update(String(s)).digest('base64url');
export function text(v,min=0,max=300){assert(typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max,400,'INVALID_TEXT',`Preencha um texto entre ${min} e ${max} caracteres.`);return v.trim();}
export function integer(v,min=0,max=10000000000){assert(Number.isSafeInteger(v)&&v>=min&&v<=max,400,'INVALID_NUMBER','Valor numérico inválido.');return v;}
export function key(v){assert(typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v),400,'INVALID_ID','Identificador inválido.');return v;}
export function boolean(v){assert(typeof v==='boolean',400,'INVALID_BOOLEAN','Informe verdadeiro ou falso.');return v;}
export function https(v){if(!v)return '';let u;try{u=new URL(v);}catch{}assert(u?.protocol==='https:'&&!u.username&&!u.password,400,'INVALID_URL','Use uma URL HTTPS válida.');return u.href;}
export function image(v){if(!v)return '';assert(typeof v==='string'&&v.length<=360000,400,'IMAGE_SIZE','Imagem muito grande. Use até 250 KB.');if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)||/^\/api\/images\/[A-Za-z0-9_-]+$/.test(v))return v;return https(v);}
export const defaults={brand:'SAM CONECTA',revision:0,maintenance:false,marketplaceEnabled:true,affiliatesEnabled:true,projectsEnabled:false,paymentsEnabled:false,platformFeeBp:0,categories:['Casa e decoração','Beleza e cuidados','Tecnologia','Veículos','Imóveis','Serviços','Outros'],termsVersion:'rascunho-1',termsText:'',privacyText:'',updatedAt:null};
export function settingsInput(data,current){
  const next={...current,brand:text(data.brand,2,70),maintenance:boolean(data.maintenance),marketplaceEnabled:boolean(data.marketplaceEnabled),affiliatesEnabled:boolean(data.affiliatesEnabled),projectsEnabled:boolean(data.projectsEnabled),paymentsEnabled:boolean(data.paymentsEnabled),platformFeeBp:integer(data.platformFeeBp,0,10000),termsVersion:text(data.termsVersion,1,80),termsText:text(data.termsText,0,30000),privacyText:text(data.privacyText,0,30000)};
  assert(Array.isArray(data.categories)&&data.categories.length>0&&data.categories.length<=40,400,'CATEGORIES','Defina de 1 a 40 categorias.');
  next.categories=[...new Set(data.categories.map(v=>text(v,1,60)))];return next;
}
export function profileInput(data,settings){
  const documentNumber=text(data.documentNumber,11,22).replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  assert(/^\d{11}$/.test(documentNumber)||/^[A-Z0-9]{12}\d{2}$/.test(documentNumber),400,'DOCUMENT_FORMAT','Confira o formato do CPF ou CNPJ.');
  assert(data.acceptTerms===true&&settings.termsText&&settings.privacyText&&data.termsVersion===settings.termsVersion,400,'TERMS_REQUIRED','Leia e aceite a versão atual dos termos e da privacidade.');
  const phone=text(data.phone,10,25).replace(/\D/g,'');assert(phone.length>=10&&phone.length<=15,400,'PHONE','Confira o telefone.');
  return {fullName:text(data.fullName,3,120),documentNumber,phone,address:text(data.address,8,500),seller:!!data.seller,affiliate:!!data.affiliate,documentVerified:false,consent:{version:settings.termsVersion,acceptedAt:now()},completed:true};
}
export function productInput(data,settings){
  const category=text(data.category,1,60);assert(settings.categories.includes(category),400,'CATEGORY','Categoria não disponível.');
  assert(['online','manual'].includes(data.saleMode),400,'MODE','Escolha pagamento online ou negociação assistida.');
  return {title:text(data.title,3,120),description:text(data.description,10,6000),category,priceCents:integer(data.priceCents,100),affiliateBp:integer(data.affiliateBp,0,10000),image:image(data.image),saleMode:data.saleMode,stock:integer(data.stock,0,1000000)};
}
export function splitMoney(total,feeBp,affiliateBp){
  integer(total,0);integer(feeBp,0,10000);integer(affiliateBp,0,10000);
  assert(feeBp+affiliateBp<=10000,400,'FEES_EXCEED_TOTAL','A taxa da plataforma e a comissão não podem superar 100% da venda.');
  const platform=Math.floor(total*feeBp/10000),affiliate=Math.floor(total*affiliateBp/10000);
  return {platformCents:platform,affiliateCents:affiliate,sellerCents:total-platform-affiliate};
}
export function requireOwner(user){assert(user?.isOwner,403,'OWNER_ONLY','Apenas o proprietário pode alterar esta configuração.');}
export function requireAdmin(user){assert(user?.isAdmin,403,'ADMIN_ONLY','Acesso exclusivo da administração.');}
export function operate(user,settings){assert(user?.status==='active',403,'SUSPENDED','Conta desativada.');assert(!settings.maintenance||user.isAdmin,503,'MAINTENANCE','Plataforma em manutenção. Tente novamente mais tarde.');}
export function ready(user,settings){operate(user,settings);assert(user.completed&&user.consent?.version===settings.termsVersion,409,'PROFILE_REQUIRED','Complete o cadastro e aceite os termos atuais no seu perfil.');}
export function seal(data,key64){
  const master=Buffer.from(key64||'','base64');assert(master.length===32,503,'ENCRYPTION_KEY','Configure TOKEN_ENCRYPTION_KEY no servidor.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv),value=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),value:value.toString('base64')};
}
export function unseal(data,key64){
  const master=Buffer.from(key64||'','base64');assert(master.length===32,503,'ENCRYPTION_KEY','Configure TOKEN_ENCRYPTION_KEY no servidor.');
  const decipher=createDecipheriv('aes-256-gcm',master,Buffer.from(data.iv,'base64'));decipher.setAuthTag(Buffer.from(data.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.value,'base64')),decipher.final()]).toString('utf8'));
}
export function validWebhook({signature,requestId,dataId,secret}){
  if(!secret||!requestId||!dataId||typeof signature!=='string')return false;
  const fields=Object.fromEntries(signature.split(',').map(x=>x.trim().split('=')));
  if(!/^\d{10,16}$/.test(fields.ts||'')||!/^[a-f0-9]{64}$/i.test(fields.v1||''))return false;
  const manifest=`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
  const expected=createHmac('sha256',secret).update(manifest).digest();
  return timingSafeEqual(expected,Buffer.from(fields.v1,'hex'));
}
export function paymentTransition(order,payment){
  assert(String(payment.external_reference)===order.id,409,'PAYMENT_REFERENCE','Pagamento não corresponde ao pedido.');
  assert(payment.currency_id==='BRL'&&Math.round(Number(payment.transaction_amount)*100)===order.totalCents,409,'PAYMENT_AMOUNT','Valor ou moeda não corresponde ao pedido.');
  assert(String(payment.collector_id)===String(order.collectorId),409,'PAYMENT_COLLECTOR','Recebedor diferente do pedido.');
  assert(!!payment.live_mode===!!order.liveMode,409,'PAYMENT_ENVIRONMENT','Ambiente do pagamento diferente do pedido.');
  const updated=payment.date_last_updated||payment.date_created;
  assert(updated&&Number.isFinite(Date.parse(updated)),409,'PAYMENT_DATE','Data do pagamento inválida.');
  if(order.paymentUpdatedAt&&Date.parse(updated)<Date.parse(order.paymentUpdatedAt))return null;
  const pid=String(payment.id);
  if(order.paymentId&&order.paymentId!==pid&&['paid','refunded','charged_back','partially_refunded','disputed'].includes(order.paymentStatus))return null;
  let state={approved:'paid',pending:'pending',in_process:'pending',authorized:'pending',in_mediation:'disputed',rejected:'rejected',cancelled:'cancelled',refunded:'refunded',charged_back:'charged_back'}[payment.status];
  assert(state,409,'PAYMENT_STATUS','Estado de pagamento desconhecido.');
  const refundedCents=Math.max(0,Math.min(order.totalCents,Math.round(Number(payment.transaction_amount_refunded||0)*100)));
  if(state==='paid'&&refundedCents>0)state=refundedCents>=order.totalCents?'refunded':'partially_refunded';
  const remaining=['paid','partially_refunded'].includes(state)?order.totalCents-refundedCents:0;
  const commissionCents=Math.floor(order.affiliateCents*remaining/order.totalCents);
  const feeCents=Math.floor(order.platformCents*remaining/order.totalCents);
  if(order.paymentId===pid&&order.paymentUpdatedAt===updated&&order.paymentStatus===state&&order.refundedCents===refundedCents)return null;
  return {paymentId:pid,paymentStatus:state,paymentUpdatedAt:updated,refundedCents,commissionCents,recognizedFeeCents:feeCents,updatedAt:now()};
}
export const providerRegistry=[
  {id:'firebase',kind:'database',name:'Firebase',implemented:true,capabilities:['Autenticação','Leitura','Gravação'],description:'Base central desta versão. Alteração do projeto exige migração e configuração do servidor.'},
  {id:'mercadopago',kind:'payment',name:'Mercado Pago',implemented:true,capabilities:['Checkout Pro','Webhook assinado','OAuth vendedor','Split 1:1'],description:'Teste de autenticação separado da homologação de pagamentos.'},
  {id:'stripe',kind:'payment',name:'Stripe',implemented:false,capabilities:[],description:'Requer um conector adicional.'},
  {id:'asaas',kind:'payment',name:'Asaas',implemented:false,capabilities:[],description:'Requer um conector adicional.'},
  {id:'other-database',kind:'database',name:'Outro banco de dados',implemented:false,capabilities:[],description:'Requer adaptador, cópia dos dados e validação antes da troca.'}
];
