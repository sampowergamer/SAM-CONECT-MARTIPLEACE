import {initializeApp} from 'firebase/app';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut} from 'firebase/auth';
const status=document.querySelector('#mobile-status'),actions=document.querySelector('#mobile-actions'),q=new URLSearchParams(location.search),challenge=q.get('challenge'),client=q.get('client')==='adm'?'adm':'user';
function btn(label,fn,secondary=false){const b=document.createElement('button');b.className='button'+(secondary?' secondary':'');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};actions.append(b);}
async function start(){
  if(!/^[A-Za-z0-9_-]{43}$/.test(challenge||''))throw new Error('Abra o login pelo aplicativo para começar.');
  const response=await fetch('/api/bootstrap',{cache:'no-store'}),config=await response.json();if(!response.ok||!config.configured)throw new Error('O Firebase ainda precisa ser configurado na central.');
  const auth=getAuth(initializeApp(config.firebase));auth.languageCode='pt-BR';
  onAuthStateChanged(auth,user=>{
    actions.replaceChildren();
    if(user){
      status.textContent=`Conta: ${user.email}. Confirme para autorizar o aplicativo.`;
      btn('Continuar com esta conta',async()=>{
        const r=await fetch('/api/mobile/authorize',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({challenge})});
        const result=await r.json();if(!r.ok)throw new Error(result.error?.message||'Não foi possível autorizar.');
        const url=`${client==='adm'?'samconecta-adm':'samconecta'}://auth?code=${encodeURIComponent(result.code)}`;
        status.textContent='Autorização pronta. Volte ao aplicativo para concluir.';actions.replaceChildren();const link=document.createElement('a');link.className='button';link.href=url;link.textContent='Voltar ao aplicativo';actions.append(link);location.assign(url);
      });
      btn('Usar outra conta',()=>signOut(auth),true);
    }else{
      status.textContent='Entre com a mesma conta que deseja usar no aplicativo.';btn('Entrar com Google',()=>signInWithPopup(auth,new GoogleAuthProvider()));
      const p=document.createElement('p');p.textContent='O acesso com e-mail e senha também está disponível diretamente no aplicativo.';actions.append(p);
    }
  });
}
start().catch(e=>{status.textContent=e.message;actions.replaceChildren();});
