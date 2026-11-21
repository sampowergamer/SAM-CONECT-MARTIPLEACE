import {firebaseServices} from '../../server/store.mjs';
export const config={schedule:'@daily'};
// Limpeza de códigos já vencidos. Não altera pedidos, saldos ou credenciais.
export default async function(){
  if(!process.env.FIREBASE_PROJECT_ID)return new Response('Configuração pendente',{status:200});
  const {db}=firebaseServices();let deleted=0;
  for(const table of ['rates','mobileCodes','oauthStates']){
    for(let page=0;page<10;page++){
      const docs=await db.collection('samConecta').doc('v1').collection(table).where('expiresAt','<',Date.now()).limit(300).get();if(docs.empty)break;
      const batch=db.batch();for(const d of docs.docs)batch.delete(d.ref);await batch.commit();deleted+=docs.size;if(docs.size<300)break;
    }
  }
  return Response.json({deleted});
}
