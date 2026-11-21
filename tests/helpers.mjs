export class MemoryStore {
  constructor(seed={}){this.data=new Map(Object.entries(seed).map(([k,v])=>[k,structuredClone(v)]));this.queue=Promise.resolve();}
  async get(t,i){const d=this.data.get(`${t}/${i}`);return d?{...structuredClone(d),id:i}:null;}
  async set(t,i,d){this.data.set(`${t}/${i}`,structuredClone(d));}
  async remove(t,i){this.data.delete(`${t}/${i}`);}
  async list(t,filters=[],cursor='',limit=100){
    let items=[...this.data.entries()].filter(([k])=>k.startsWith(t+'/')).map(([k,d])=>({...structuredClone(d),id:k.slice(t.length+1)}));
    for(const [f,op,v] of filters)items=items.filter(d=>op==='=='?d[f]===v:op==='array-contains'?d[f]?.includes(v):op==='array-contains-any'?v.some(x=>d[f]?.includes(x)):false);
    items.sort((a,b)=>a.id.localeCompare(b.id));if(cursor)items=items.filter(x=>x.id>cursor);return {items:items.slice(0,limit),nextCursor:items.length>limit?items[limit-1].id:null};
  }
  async transaction(fn){
    const run=async()=>{const staged=new Map([...this.data.entries()].map(([k,v])=>[k,structuredClone(v)]));let wrote=false;
      const result=await fn({get:async(t,i)=>{if(wrote)throw new Error('Firestore requires all reads before writes');const d=staged.get(`${t}/${i}`);return d?{...structuredClone(d),id:i}:null;},set:(t,i,d)=>{wrote=true;staged.set(`${t}/${i}`,structuredClone(d));},remove:(t,i)=>{wrote=true;staged.delete(`${t}/${i}`);}});this.data=staged;return result;};
    const promise=this.queue.then(run);this.queue=promise.catch(()=>{});return promise;
  }
}
export const env={APP_URL:'https://central.example',ADMIN_EMAIL:'owner@example.com',PAYMENTS_ENABLED:'true',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64')};
export const user=(uid='buyer',extra={})=>({uid,email:`${uid}@example.com`,fullName:uid,status:'active',completed:true,seller:false,affiliate:false,consent:{version:'v1'},isAdmin:false,isOwner:false,emailVerified:true,authTime:Date.now()/1000,...extra});
export const owner=user('owner',{email:'owner@example.com',isAdmin:true,isOwner:true,seller:true});
export const product={id:'product_1',title:'Produto real de teste automatizado',description:'Descrição suficiente para validar.',sellerId:'seller',category:'Outros',priceCents:10000,affiliateBp:1000,saleMode:'manual',stock:5,status:'published',image:'',createdAt:'2026-11-20T10:00:00Z'};
export const settings={brand:'SAM CONECTA',revision:1,maintenance:false,marketplaceEnabled:true,affiliatesEnabled:true,projectsEnabled:false,paymentsEnabled:true,platformFeeBp:500,categories:['Outros'],termsVersion:'v1',termsText:'Termos de teste',privacyText:'Privacidade de teste'};
export const seed=()=>({'settings/public':settings,'products/product_1':product,'profiles/buyer':user(),'profiles/seller':user('seller',{seller:true}),'profiles/affiliate':user('affiliate',{affiliate:true}),'profiles/owner':owner});
