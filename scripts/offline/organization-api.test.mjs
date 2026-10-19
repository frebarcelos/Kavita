import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { KavitaApi } from './organization-api.mjs';

test('API local envia a chave no header e serializa o DTO sem colocá-la na URL', async t => {
    const seen = [];
    const server = createServer(async (req, res) => { let body=''; for await (const chunk of req) body+=chunk; seen.push({url:req.url,key:req.headers['x-api-key'],body}); res.setHeader('content-type','application/json'); res.end(JSON.stringify({id:7})); });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>server.close(resolve)));
    const api = new KavitaApi('http://127.0.0.1:'+server.address().port,{apiKey:'synthetic-test-key'});
    assert.deepEqual(await api.request('/api/library/update',{method:'POST',body:{id:7,name:'Biblioteca'}}),{id:7});
    assert.deepEqual(seen,[{url:'/api/library/update',key:'synthetic-test-key',body:'{"id":7,"name":"Biblioteca"}'}]);
});

test('API não segue redirect e não transmite credenciais para outro destino', async t => {
    let redirected=0;
    const server=createServer((req,res)=>{if(req.url==='/api/redirect'){res.writeHead(302,{Location:'/api/target'});res.end();} else {redirected++;res.end('{}');}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>server.close(resolve)));
    const api=new KavitaApi('http://127.0.0.1:'+server.address().port,{apiKey:'synthetic-test-key'});
    await assert.rejects(api.request('/api/redirect')); assert.equal(redirected,0);
    await assert.rejects(api.request('http://8.8.8.8/api/account'));
});

test('erros de API não reproduzem corpo da resposta nem credencial', async t=>{
    const server=createServer((req,res)=>{res.writeHead(403);res.end('synthetic-secret-from-response');});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>server.close(resolve)));
    const api=new KavitaApi('http://127.0.0.1:'+server.address().port,{apiKey:'synthetic-test-key'});
    await assert.rejects(api.request('/api/library/libraries'),error=>error.message.includes('403')&&!error.message.includes('synthetic-secret'));
});
test('aplicação confere todas as bibliotecas antes de escrever e recusa edição concorrente', async () => {
    const { applyLibraryPlan } = await import('./organization-api.mjs');
    const posts=[]; const api={request:async(route,options={})=>{if(options.method==='POST'){posts.push(route);return null;} const id=Number(route.split('=')[1]);return {id,name:id===1?'Mangas':'Nome alterado',type:0,folders:['/media/'+id],excludePatterns:[],libraryFileTypes:[1],enableMetadata:true};}};
    const before=id=>({id,name:id===1?'Mangas':'Livros',type:0,folders:['/media/'+id],excludePatterns:[],libraryFileTypes:[1],enableMetadata:true});
    const entries=[1,2].map(id=>({before:before(id),after:{...before(id),excludePatterns:['**/capas/**']}}));
    await assert.rejects(applyLibraryPlan(api,entries),/concorrente/i); assert.equal(posts.length,0);
});