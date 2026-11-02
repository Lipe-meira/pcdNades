import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/application.js';
const allowed='123e4567-e89b-42d3-a456-426614174000',other='223e4567-e89b-42d3-a456-426614174000';
const media='323e4567-e89b-42d3-a456-426614174000';
function fixture(user:string,provider="tiktok",owner=allowed,status="ready"){
 let writes=0;
 const row={id:media,owner_id:owner,source_type:provider,import_source_id:media,status,storage_key:'private.mp4'};
 const service:any={from:()=>{const q:any={select:()=>q,eq:()=>q,in:()=>q,maybeSingle:async()=>({data:row})};return q},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://storage.invalid/private'}})})},rpc:()=>{writes++;throw Error('unexpected write')}};
 return {clients:{public:{},service,user:()=>({auth:{getUser:async()=>({data:{user:{id:user}}})},rpc:async()=>({data:true})})} as any,writes:()=>writes};
}
test('only explicitly configured administrator may inspect, create, complete or privately play imported media',async()=>{
 const prev=process.env.MEDIA_TIKTOK_ADMIN_USER_ID;process.env.MEDIA_TIKTOK_ADMIN_USER_ID=allowed;
 const f=fixture(other),app=buildApp(f.clients,{available:()=>true,extract:async()=>{throw Error('not allowed')}}),headers={authorization:'Bearer token'};
 try{for(const req of [{method:'POST',url:'/api/v1/media/imports/inspect',payload:{sourceUrl:'https://vt.tiktok.com/ZSgs9BM9L/'}},{method:'POST',url:'/api/v1/media/imports',payload:{sourceId:media,clip:{startSeconds:0,endSeconds:1}}},{method:'POST',url:`/api/v1/media/${media}/complete`,payload:{}},{method:'GET',url:`/api/v1/media/${media}/import-playback`}]){const response=await app.inject({...req,headers} as any);assert.equal(response.statusCode,403,req.url)}assert.equal(f.writes(),0)}finally{await app.close();if(prev===undefined)delete process.env.MEDIA_TIKTOK_ADMIN_USER_ID;else process.env.MEDIA_TIKTOK_ADMIN_USER_ID=prev}
});
test('authorized admin can privately play ready own import; missing configured identity fails closed',async()=>{
 const prev=process.env.MEDIA_TIKTOK_ADMIN_USER_ID;process.env.MEDIA_TIKTOK_ADMIN_USER_ID=allowed;const f=fixture(allowed),app=buildApp(f.clients,{available:()=>true,extract:async()=>{throw Error('not used')}});const headers={authorization:'Bearer token'};
 try{const r=await app.inject({method:'GET',url:`/api/v1/media/${media}/import-playback`,headers});assert.equal(r.statusCode,200);assert.equal(r.json().data.mimeType,'video/mp4');delete process.env.MEDIA_TIKTOK_ADMIN_USER_ID;const denied=await app.inject({method:'GET',url:`/api/v1/media/${media}/import-playback`,headers});assert.equal(denied.statusCode,403)}finally{await app.close();if(prev===undefined)delete process.env.MEDIA_TIKTOK_ADMIN_USER_ID;else process.env.MEDIA_TIKTOK_ADMIN_USER_ID=prev}
});


test('Instagram import routes preserve admin and owner isolation',async()=>{
 const prev=process.env.MEDIA_TIKTOK_ADMIN_USER_ID;process.env.MEDIA_TIKTOK_ADMIN_USER_ID=allowed;const headers={authorization:'Bearer token'};
 try{
  const denied=fixture(other,'instagram'),app=buildApp(denied.clients,{available:()=>true,extract:async()=>{throw Error('unexpected')}});
  try{for(const request of [{method:'GET',url:`/api/v1/media/${media}`},{method:'POST',url:`/api/v1/media/${media}/complete`,payload:{}},{method:'GET',url:`/api/v1/media/${media}/import-playback`}])assert.equal((await app.inject({...request,headers} as any)).statusCode,403);}finally{await app.close();}
  const foreign=fixture(allowed,'instagram',other),app2=buildApp(foreign.clients,{available:()=>true,extract:async()=>{throw Error('unexpected')}});
  try{assert.equal((await app2.inject({method:'POST',url:`/api/v1/media/${media}/complete`,headers,payload:{}})).statusCode,403);assert.equal((await app2.inject({method:'GET',url:`/api/v1/media/${media}/import-playback`,headers})).statusCode,404);}finally{await app2.close();}
  const own=fixture(allowed,'instagram'),app3=buildApp(own.clients,{available:()=>true,extract:async()=>{throw Error('unexpected')}});
  try{const ok=await app3.inject({method:'GET',url:`/api/v1/media/${media}/import-playback`,headers});assert.equal(ok.statusCode,200);assert.match(ok.headers['cache-control'] as string,/no-store/);}finally{await app3.close();}
 }finally{if(prev===undefined)delete process.env.MEDIA_TIKTOK_ADMIN_USER_ID;else process.env.MEDIA_TIKTOK_ADMIN_USER_ID=prev}
});
