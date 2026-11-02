import {test} from 'node:test';import assert from 'node:assert/strict';import {serviceFetch} from '../src/service-fetch.js';import {supabasePreviewPorts} from '../src/source-preview-supabase.js';
test('service fetch preserves cancellation carried by a Request object',async()=>{
 const original=globalThis.fetch,c=new AbortController();c.abort();let aborted=false;
 globalThis.fetch=async(_input,init)=>{aborted=init!.signal!.aborted;return new Response();};
 try{await serviceFetch(new Request('https://example.test/',{signal:c.signal}));assert.equal(aborted,true);}finally{globalThis.fetch=original;}
});
test('preview signing cannot return a URL after its operation was cancelled',async()=>{
 const c=new AbortController(),key='123e4567-e89b-42d3-a456-426614174000.mp4',origin='https://project.supabase.test';
 const db:any={storage:{from:()=>({createSignedUrl:async()=>{c.abort();return {data:{signedUrl:`${origin}/storage/v1/object/sign/import-previews/${key}?token=fixture`},error:null};}})}};
 await assert.rejects(supabasePreviewPorts(db,origin,c.signal).sign(key,60));
});
