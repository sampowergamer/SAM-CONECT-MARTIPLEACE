import {AppError,assert,defaults} from './domain.mjs';
import {firebaseServices,FirestoreStore} from './store.mjs';
import {Service} from './service.mjs';

export function createHandler({env=process.env,service:provided}={}){
  return async function handle(request){
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
    try{
      const url=new URL(request.url),path=url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/,'')||'/';
      const publicConfig={apiKey:env.FIREBASE_API_KEY||'',authDomain:env.FIREBASE_AUTH_DOMAIN||'',projectId:env.FIREBASE_PROJECT_ID||'',appId:env.FIREBASE_APP_ID||''};
      const configured=!!(publicConfig.apiKey&&publicConfig.authDomain&&publicConfig.projectId&&publicConfig.appId&&(env.FIREBASE_SERVICE_ACCOUNT_JSON||env.GOOGLE_APPLICATION_CREDENTIALS)&&env.ADMIN_EMAIL&&env.APP_URL);
      if(path==='/bootstrap'&&request.method==='GET'){
        let settings=defaults;if(configured||provided){const services=provided?null:firebaseServices(env),service=provided||new Service(new FirestoreStore(services.db),services.auth,env);settings=await service.settings();}
        return new Response(JSON.stringify({configured:configured||!!provided,firebase:publicConfig,settings,version:'0.1.0'}),{headers});
      }
      assert(configured||provided,503,'SETUP_REQUIRED','Configure o Firebase e as variáveis do servidor para iniciar a plataforma.');
      if(!['GET','HEAD'].includes(request.method)&&!path.startsWith('/webhooks/')){
        const origin=request.headers.get('origin');assert(!origin||origin===new URL(env.APP_URL).origin,403,'ORIGIN','Origem da solicitação não autorizada.');
        assert(request.headers.get('content-type')?.startsWith('application/json'),415,'JSON_REQUIRED','Envie o conteúdo em JSON.');
      }
      let body={};if(!['GET','HEAD'].includes(request.method)&&!path.startsWith('/webhooks/')){
        const raw=await request.text();assert(Buffer.byteLength(raw)<=600000,413,'BODY_TOO_LARGE','Conteúdo muito grande.');try{body=JSON.parse(raw||'{}');}catch{throw new AppError(400,'INVALID_JSON','JSON inválido.');}assert(body&&typeof body==='object'&&!Array.isArray(body),400,'INVALID_JSON','Envie um objeto JSON.');
      }
      const services=provided?null:firebaseServices(env),service=provided||new Service(new FirestoreStore(services.db),services.auth,env);
      const result=await service.route(request,path,body,url);
      if(result instanceof Response)return result;
      if(result?.redirect)return new Response(null,{status:303,headers:{...headers,Location:result.redirect}});
      return new Response(JSON.stringify(result),{headers});
    }catch(e){
      const known=e instanceof AppError;
      // Nunca registrar request, body, token, CPF nem resposta privada de provedor.
      if(!known)console.error('SAM_CONECTA_INTERNAL',e?.code||e?.name||'unknown');
      return new Response(JSON.stringify({error:{code:known?e.code:'INTERNAL',message:known?e.message:'Não foi possível concluir a operação. Confira a configuração do servidor.'}}),{status:known?e.status:500,headers});
    }
  };
}
export default createHandler();
