// Fastify route tests with an in-memory DB/Storage adapter, NOT Supabase E2E.
import {test} from 'node:test';import assert from 'node:assert/strict';import {buildApp} from '../src/application.js';
const id='123e4567-e89b-42d3-a456-426614174000';
function fixture(published=true,status='ready',storageError=false){
 let signed=0;const key=`${id}/import-1.mp4`;
 const clients:any={public:{},user:()=>({}),service:{from:(table:string)=>{
  const q:any={select:()=>q,eq:()=>q,limit:async()=>({data:published?[{id:'grenade'}]:[],error:null}),maybeSingle:async()=>({data:status==='ready'?{id,status,source_type:'tiktok',source_url:'https://www.tiktok.com/@gone/video/123',storage_key:key}:null,error:null})};assert.ok(['media_assets','grenades'].includes(table));return q;
 },storage:{from:(bucket:string)=>{assert.equal(bucket,'videos-staging');return {createSignedUrl:async(path:string,ttl:number)=>{assert.equal(path,key);assert.equal(ttl,3600);signed++;return storageError?{error:{message:'private signed URL'},data:null}:{data:{signedUrl:`https://storage.example.invalid/private-clip-${signed}`},error:null};}};}}}};
 return {app:buildApp(clients),signed:()=>signed};
}
test('playback signs only published ready output, renews independently of TikTok and hides internal keys',async()=>{
 const f=fixture();try{const a=await f.app.inject(`/api/v1/media/${id}/playback`),b=await f.app.inject(`/api/v1/media/${id}/playback`);assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);assert.equal(a.json().data.mimeType,'video/mp4');assert.notEqual(a.json().data.url,b.json().data.url);assert.ok(Date.parse(a.json().data.expiresAt)>Date.now());assert.equal(f.signed(),2);assert.ok(!a.body.includes('tiktok'));assert.ok(!a.body.includes('storage_key'));}finally{await f.app.close();}
});
test('unpublished or nonready media never receives a playback URL',async()=>{
 for(const args of [[false,'ready'],[true,'processing'],[true,'failed']] as const){const f=fixture(...args);try{assert.equal((await f.app.inject(`/api/v1/media/${id}/playback`)).statusCode,404);assert.equal(f.signed(),0);}finally{await f.app.close();}}
});
test('signing failure returns bounded Storage error without raw response',async()=>{
 const f=fixture(true,'ready',true);try{const r=await f.app.inject(`/api/v1/media/${id}/playback`);assert.equal(r.statusCode,503);assert.equal(r.json().error.code,'STORAGE_UNAVAILABLE');assert.ok(!r.body.includes('private'));}finally{await f.app.close();}
});
