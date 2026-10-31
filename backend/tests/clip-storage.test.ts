import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {storeClip,removeClip} from '../src/clip-storage.js';

test('aborted storage never requests a signing URL',async()=>{
 let calls=0;const db:any={storage:{from:()=>({createSignedUploadUrl:async()=>{calls++;throw new Error('private URL');}})}};const c=new AbortController();c.abort();
 await assert.rejects(storeClip(db,'asset/import-1.mp4','unused.mp4',c.signal));assert.equal(calls,0);
});

test('signed upload sends exact final bytes without upsert and rejects HTTP failure safely',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pcdnades-storage-test-')),file=join(dir,'clip.mp4'),body=Buffer.from('validated final bytes');await writeFile(file,body);
 let status=200,received=Buffer.alloc(0),headers:any;const server=createServer(async(req,res)=>{headers=req.headers;const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));received=Buffer.concat(chunks);res.writeHead(status);res.end('private URL body');});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const a=server.address();assert.ok(a&&typeof a==='object');
 const db:any={storage:{from:(bucket:string)=>{assert.equal(bucket,'videos-staging');return {createSignedUploadUrl:async(key:string,options:any)=>{assert.equal(key,'asset/import-1.mp4');assert.deepEqual(options,{upsert:false});return {data:{signedUrl:`http://127.0.0.1:${a.port}/upload?token=fixture`},error:null};}};}}};
 try{await storeClip(db,'asset/import-1.mp4',file,new AbortController().signal);assert.deepEqual(received,body);assert.equal(headers['content-type'],'video/mp4');assert.equal(headers['x-upsert'],'false');
 status=503;await assert.rejects(storeClip(db,'asset/import-1.mp4',file,new AbortController().signal),(e:any)=>e.code==='STORAGE_UNAVAILABLE'&&!e.message.includes('private'));
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
});

test('a stalled signing operation stops waiting at cancellation',async()=>{
 let started!:()=>void;const entered=new Promise<void>(r=>started=r);const db:any={storage:{from:()=>({createSignedUploadUrl:()=>{started();return new Promise(()=>{});}})}};
 const c=new AbortController();const operation=storeClip(db,'asset/import-1.mp4','unused.mp4',c.signal);await entered;c.abort();
 await assert.rejects(Promise.race([operation,new Promise((_,reject)=>setTimeout(()=>reject(new Error('deadline ignored')),300))]),(e:any)=>e.code==='PROCESSING_TIMEOUT');
});

test('real Supabase SDK signs and uploads through a loopback HTTP contract fixture',async()=>{
 const {createClient}=await import('@supabase/supabase-js');const dir=await mkdtemp(join(tmpdir(),'pcdnades-sdk-storage-')),file=join(dir,'clip.mp4'),body=Buffer.from('final clip fixture');await writeFile(file,body);
 const requests:string[]=[];let uploaded=Buffer.alloc(0);const path='/storage/v1/object/upload/sign/videos-staging/asset/import-1.mp4';
 const server=createServer(async(req,res)=>{requests.push(`${req.method} ${new URL(req.url!,'http://local').pathname}`);if(req.method==='DELETE'&&req.url==='/storage/v1/object/videos-staging'){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),{prefixes:['asset/import-1.mp4']});res.setHeader('content-type','application/json');res.end('[]');return;}if(req.method==='POST'&&req.url===path){res.setHeader('content-type','application/json');res.end(JSON.stringify({url:'/object/upload/sign/videos-staging/asset/import-1.mp4?token=controlled'}));return;}if(req.method==='PUT'&&req.url===`${path}?token=controlled`){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));uploaded=Buffer.concat(chunks);res.setHeader('content-type','application/json');res.end('{}');return;}res.writeHead(404);res.end();});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const a=server.address();assert.ok(a&&typeof a==='object');const db=createClient(`http://127.0.0.1:${a.port}`,'sb_secret_controlled_local_fixture',{auth:{persistSession:false,autoRefreshToken:false}});
 try{await storeClip(db,'asset/import-1.mp4',file,new AbortController().signal);assert.deepEqual(uploaded,body);await removeClip(db,'asset/import-1.mp4',new AbortController().signal);assert.deepEqual(requests,[`POST ${path}`,`PUT ${path}`,'DELETE /storage/v1/object/videos-staging']);}
 finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
});
