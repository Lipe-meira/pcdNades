import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer,get,request,type IncomingMessage} from 'node:http';
import {startMediaRelay,startMetadataProxy,TransferBudget,type openRemote} from '../src/import-network.js';
test('relay serves only its opaque local route and enforces ranges before upstream access',async()=>{
 let calls=0;const budget=new TransferBudget(1000,10,new AbortController());
 const relay=await startMediaRelay('https://v16.tiktokcdn.com/source.mp4',{},budget,async()=>{calls++;throw new Error('must not fetch');});
 try{const u=new URL(relay.url);const bad=await fetch(`${u.origin}/arbitrary.mp4`,{headers:{Range:'bytes=0-'}});assert.equal(bad.status,502);assert.equal(calls,0);const noRange=await fetch(relay.url);assert.equal(noRange.status,502);assert.equal(calls,0);}finally{await relay.close();}
});
test('relay preserves streamed data and a byte over budget aborts and closes the transfer',async()=>{
 const body=Buffer.alloc(32768,7);let upstreamClosed=false;
 const upstream=createServer((_req,res)=>{res.writeHead(206,{'Content-Length':body.length,'Content-Range':`bytes 0-${body.length-1}/${body.length}`});res.on('close',()=>upstreamClosed=true);res.end(body);});
 await new Promise<void>(r=>upstream.listen(0,'127.0.0.1',r));const addr=upstream.address();assert.ok(addr&&typeof addr==='object');
 const open:typeof openRemote=async(_url,b,headers)=>{b.request();return new Promise<IncomingMessage>((resolve,reject)=>{get(`http://127.0.0.1:${addr.port}`,{headers,signal:b.controller.signal},r=>{r.on('data',(chunk:Buffer)=>{try{b.consume(chunk.length);}catch{r.destroy(b.error);}});r.pause();resolve(r);}).on('error',reject);});};
 const budget=new TransferBudget(100000,10,new AbortController()),relay=await startMediaRelay('https://v16.tiktokcdn.com/source.mp4',{},budget,open);
 try{const r=await fetch(relay.url,{headers:{Range:'bytes=0-'}});assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),body);assert.equal(budget.bytes,body.length);}finally{await relay.close();}
 const controller=new AbortController(),small=new TransferBudget(100,10,controller),denied=await startMediaRelay('https://v16.tiktokcdn.com/source.mp4',{},small,open);
 try{await assert.rejects(async()=>{const r=await fetch(denied.url,{headers:{Range:'bytes=0-'}});await r.arrayBuffer();});assert.equal(controller.signal.aborted,true);assert.equal(small.error?.message,'IMPORT_NETWORK_LIMIT');assert.ok(small.bytes<=100+65536);assert.equal(upstreamClosed,true);}finally{await denied.close();upstream.closeAllConnections();await new Promise<void>(r=>upstream.close(()=>r()));}
});
test('metadata proxy rejects unauthenticated CONNECT and internal/alternate authorities without a remote socket',async()=>{
 for(const [target,authorized] of [['127.0.0.1:443',true],['www.tiktok.com:80',true],['www.tiktok.com:443',false],['www.tiktok.com@127.0.0.1:443',true],['2130706433:443',true]] as const){
  const b=new TransferBudget(10000,10,new AbortController()),proxy=await startMetadataProxy(b),u=new URL(proxy.url);
  try{await new Promise<void>(resolve=>{const req=request({hostname:u.hostname,port:u.port,method:'CONNECT',path:target,headers:authorized?{'Proxy-Authorization':`Basic ${Buffer.from(`${u.username}:`).toString('base64')}`}:{}});req.on('connect',(_res,s)=>{s.destroy();resolve();});req.on('error',()=>resolve());req.on('close',()=>resolve());req.end();});assert.equal(b.controller.signal.aborted,true);assert.equal(b.error?.message,'IMPORT_DESTINATION_DENIED');assert.equal(b.bytes,0);}finally{await proxy.close();}
 }
});
test('platform access denial is explicit and is never retried as a full download',async()=>{
 let calls=0;
 const upstream=createServer((_req,res)=>{calls++;res.writeHead(403,{'Content-Length':'6'});res.end('denied');});
 await new Promise<void>(r=>upstream.listen(0,'127.0.0.1',r));const addr=upstream.address();assert.ok(addr&&typeof addr==='object');
 const open:typeof openRemote=async()=>new Promise<IncomingMessage>((resolve,reject)=>{get(`http://127.0.0.1:${addr.port}`,res=>{res.pause();resolve(res);}).on('error',reject);});
 const budget=new TransferBudget(10000,4,new AbortController()),relay=await startMediaRelay('https://v16.tiktokcdn.com/source.mp4',{},budget,open);
 try{const r=await fetch(relay.url,{headers:{Range:'bytes=0-1023'}});assert.equal(r.status,502);assert.equal(budget.error?.message,'IMPORT_ACCESS_DENIED');const diagnostic=(budget.error as any).diagnostic;assert.equal(diagnostic.httpStatus,403);assert.ok(diagnostic.headerNames.includes('Range'));assert.ok(diagnostic.responseHeaderNames.includes('content-length'));assert.ok(!JSON.stringify(diagnostic).includes('denied'));assert.equal(calls,1);}finally{await relay.close();upstream.closeAllConnections();await new Promise<void>(r=>upstream.close(()=>r()));}
});
