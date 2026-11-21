import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import handle from '../server/handler.mjs';
try{process.loadEnvFile('.env');}catch{}
const root=resolve('dist'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
createServer(async(req,res)=>{
  try{
    const origin=`http://${req.headers.host}`,url=new URL(req.url,origin);
    if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const response=await handle(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
    const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/'))throw new Error('path');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Não encontrado');}
}).listen(Number(process.env.PORT||4173),'0.0.0.0',()=>console.log('SAM CONECTA: http://localhost:4173'));
