const q=new URLSearchParams(location.search),oid=q.get('order'),token=q.get('token'),title=document.querySelector('#payment-title'),description=document.querySelector('#payment-description'),status=document.querySelector('#payment-status'),back=document.querySelector('#back-app');
const states={paid:['Pagamento confirmado','Seu pedido foi atualizado. Você já pode continuar na plataforma.'],partially_refunded:['Estorno parcial registrado','A central já recebeu a atualização do provedor.'],refunded:['Pagamento estornado','O estorno foi confirmado pelo provedor.'],disputed:['Pagamento em contestação','A equipe acompanhará a situação com o provedor.'],charged_back:['Pagamento contestado','A administração acompanhará a atualização do pedido.'],rejected:['Pagamento não aprovado','Confira as informações do pedido antes de tentar uma nova compra.'],cancelled:['Pagamento cancelado','Consulte o pedido na plataforma.'],pending:['Aguardando confirmação','O pagamento ainda está pendente. A central continuará acompanhando a confirmação.'],awaiting_checkout:['Pedido em processamento','A central está aguardando a atualização do Mercado Pago.']};
let attempts=0,redirected=false,timer;
async function update(){
  clearTimeout(timer);attempts++;const b=document.querySelector('#check-payment');b.disabled=true;
  try{
    if(!oid||!token)throw new Error('O link de retorno está incompleto. Abra Meus pedidos na plataforma.');
    const r=await fetch(`/api/return/status?${new URLSearchParams({order:oid,token})}`,{cache:'no-store'}),data=await r.json();if(!r.ok)throw new Error(data.error?.message||'A central não respondeu.');
    const [headline,body]=states[data.status]||['Acompanhando seu pedido','Consulte os detalhes na plataforma.'];title.textContent=headline;description.textContent=body;status.textContent=`Pedido ${data.id.slice(-10)} · ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(data.totalCents/100)}`;
    const native=data.client==='android'||data.client==='android-adm';back.href=native?`${data.client==='android-adm'?'samconecta-adm':'samconecta'}://payment?order=${encodeURIComponent(data.id)}`:`/?order=${encodeURIComponent(data.id)}#pedidos`;back.textContent=native?'Voltar ao aplicativo':'Voltar para meus pedidos';
    if(native&&!redirected){redirected=true;setTimeout(()=>location.assign(back.href),3500);}
    if(['pending','awaiting_checkout'].includes(data.status)&&attempts<24)timer=setTimeout(update,5000);
  }catch(e){title.textContent='Confira seu pedido na plataforma';description.textContent=e.message;}
  finally{b.disabled=false;}
}
document.querySelector('#check-payment').addEventListener('click',()=>{attempts=0;update();});update();
