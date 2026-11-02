import {test} from 'node:test';import assert from 'node:assert/strict';import {buildApp} from '../src/application.js';
const owner='123e4567-e89b-42d3-a456-426614174000',source='223e4567-e89b-42d3-a456-426614174000';
function clients(value:()=>any,admin=true):any{return {public:{},service:{from:()=>{const q:any={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:value(),error:null})};return q;}},user:()=>({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async()=>({data:admin})})};}
test('capabilities provides strict sourcePreview booleans and fails closed on stale heartbeat',async()=>{
 const previous=process.env.MEDIA_SOURCE_PREVIEW_ENABLED;process.env.MEDIA_SOURCE_PREVIEW_ENABLED='true';let stamp=new Date().toISOString();
 const app=buildApp(clients(()=>({swept_at:stamp})),{available:()=>true,extract:async()=>{throw Error('unused');}});
 try{const fresh=(await app.inject('/api/v1/media/capabilities')).json().data.importers;assert.equal(fresh.tiktok.sourcePreview,true);assert.equal(fresh.instagram.sourcePreview,true);stamp=new Date(Date.now()-600000).toISOString();assert.equal((await app.inject('/api/v1/media/capabilities')).json().data.importers.tiktok.sourcePreview,false);process.env.MEDIA_SOURCE_PREVIEW_ENABLED='false';assert.equal((await app.inject('/api/v1/media/capabilities')).json().data.importers.instagram.sourcePreview,false);}finally{await app.close();if(previous===undefined)delete process.env.MEDIA_SOURCE_PREVIEW_ENABLED;else process.env.MEDIA_SOURCE_PREVIEW_ENABLED=previous;}
});
test('preview endpoints enforce authentication, owner lookup and finite expiration',async()=>{
 const previous=process.env.MEDIA_TIKTOK_ADMIN_USER_ID;process.env.MEDIA_TIKTOK_ADMIN_USER_ID=owner;let row:any=null;
 const app=buildApp(clients(()=>row));const url=`/api/v1/media/imports/${source}/preview`,headers={authorization:'Bearer test'};
 try{assert.equal((await app.inject({method:'POST',url,payload:{}})).statusCode,401);assert.equal((await app.inject({method:'GET',url,headers})).statusCode,404);row={metadata:{provider:'tiktok'},expires_at:'invalid'};assert.equal((await app.inject({method:'GET',url,headers})).statusCode,503);row.expires_at=new Date(Date.now()-1).toISOString();assert.equal((await app.inject({method:'GET',url,headers})).statusCode,410);assert.equal((await app.inject({method:'POST',url,headers,payload:{sourceUrl:'https://evil.test/'}})).statusCode,400);}finally{await app.close();if(previous===undefined)delete process.env.MEDIA_TIKTOK_ADMIN_USER_ID;else process.env.MEDIA_TIKTOK_ADMIN_USER_ID=previous;}
});
