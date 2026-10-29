import {test} from 'node:test';import assert from 'node:assert/strict';import {buildApp} from '../src/application.js';
const id='123e4567-e89b-42d3-a456-426614174000';
function clients(status:string,role=true){
 const asset={id,status,storage_key:'source.mp4'};let updates=0;let updating=false;
 const query:any={select:()=>query,eq:()=>query,update:()=>{updates++;updating=true;return query;},maybeSingle:async()=>{const data=updating?null:asset;updating=false;return {data,error:null};}};
 return {updates:()=>updates,public:{} as any,service:{from:()=>query,storage:{from:()=>({info:async()=>({data:{size:10},error:null})})}} as any,user:()=>({auth:{getUser:async()=>({data:{user:{id}},error:null})},rpc:async()=>({data:role,error:null})}) as any};
}
test('missing token denied before administrative data access',async()=>{const app=buildApp(clients('queued'));try{assert.equal((await app.inject({method:'POST',url:`/api/v1/media/${id}/complete`})).statusCode,401);}finally{await app.close();}});
test('viewer denied administrative write',async()=>{const app=buildApp(clients('queued',false));try{assert.equal((await app.inject({method:'POST',url:`/api/v1/media/${id}/complete`,headers:{authorization:'Bearer token'}})).statusCode,403);}finally{await app.close();}});
test('complete repeated for queued and ready returns current state',async()=>{for(const status of ['queued','processing','ready']){const app=buildApp(clients(status));try{const r=await app.inject({method:'POST',url:`/api/v1/media/${id}/complete`,headers:{authorization:'Bearer token'}});assert.equal(r.statusCode,status==='ready'?200:202);assert.equal(r.json().data.status,status);}finally{await app.close();}}});
