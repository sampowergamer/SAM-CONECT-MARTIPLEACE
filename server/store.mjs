import {getApps,initializeApp,cert,applicationDefault} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {assert,key} from './domain.mjs';
let services;
export function firebaseServices(env=process.env){
  if(services)return services;
  assert(env.FIREBASE_PROJECT_ID,503,'FIREBASE_SETUP','Configure o Firebase no servidor para iniciar.');
  let app=getApps()[0];
  if(!app){
    let credential;
    try{credential=env.FIREBASE_SERVICE_ACCOUNT_JSON?cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)):applicationDefault();}catch{assert(false,503,'FIREBASE_SETUP','Revise a conta de serviço Firebase no servidor.');}
    app=initializeApp({credential,projectId:env.FIREBASE_PROJECT_ID,storageBucket:env.FIREBASE_STORAGE_BUCKET||undefined});
  }
  services={db:getFirestore(app),auth:getAuth(app),app};return services;
}
export class FirestoreStore {
  constructor(db){this.db=db;this.root=db.collection('samConecta').doc('v1');}
  ref(table,id){return this.root.collection(key(table)).doc(key(id));}
  async get(table,id){const d=await this.ref(table,id).get();return d.exists?{...d.data(),id:d.id}:null;}
  async set(table,id,data){await this.ref(table,id).set(data);}
  async remove(table,id){await this.ref(table,id).delete();}
  async list(table,filters=[],cursor='',limit=100){
    let q=this.root.collection(key(table));for(const [f,op,v] of filters)q=q.where(f,op,v);
    const chronological=['notifications','audit'].includes(table);
    if(chronological)q=q.orderBy('createdAt','desc');
    q=q.orderBy(FieldPath.documentId(),chronological?'desc':'asc');
    if(cursor){const last=await this.ref(table,key(cursor)).get();if(last.exists)q=q.startAfter(last);}
    const snap=await q.limit(limit+1).get(),items=snap.docs.slice(0,limit).map(d=>({...d.data(),id:d.id}));
    return {items,nextCursor:snap.docs.length>limit?items.at(-1).id:null};
  }
  async transaction(fn){return this.db.runTransaction(async t=>fn({
    get:async(table,id)=>{const d=await t.get(this.ref(table,id));return d.exists?{...d.data(),id:d.id}:null;},
    set:(table,id,data)=>t.set(this.ref(table,id),data),
    remove:(table,id)=>t.delete(this.ref(table,id))
  }));}
}
