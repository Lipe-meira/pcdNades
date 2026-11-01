import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/application.js';
const allowed='123e4567-e89b-42d3-a456-426614174000',other='223e4567-e89b-42d3-a456-426614174000';
const media='323e4567-e89b-42d3-a456-426614174000';
function fixture(user:string){
 let writes=0;
 const row={id:media,owner_id:allowed,source_type:'tiktok',import_source_id:media,status:'ready',storage_key:'private.mp4'};
 const service:any={from:()=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:row})};return q},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://storage.invalid/private'}})})},rpc:()=>{writes++;throw Error('unexpected write')}};
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
