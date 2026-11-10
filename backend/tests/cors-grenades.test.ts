import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/application.js';

const id='123e4567-e89b-42d3-a456-426614174000';
const origin='https://pcdnades.vercel.app';
function fixture(){
 let writes=0; let exists=true;
 const grenade={id,title:'Smoke',map_id:'mirage',type:'smoke',side:'T',instructions:'Teste',target:{x:.5,y:.5},video_id:id,created_at:'2026-01-01',updated_at:'2026-01-01'};
 const from=(table:string)=>{let operation='select';const q:any={select:()=>q,eq:()=>q,delete:()=>{operation='delete';return q;},update:()=>{operation='update';return q;},maybeSingle:async()=>{if(table==='media_assets')return {data:null,error:null};if(operation!=='select')writes++;if(!exists)return {data:null,error:null};if(operation==='delete')exists=false;return {data:grenade,error:null};}};return q;};
 const clients:any={public:{from},service:{from},user:(token:string)=>({from,auth:{getUser:async()=>({data:{user:token==='bad'?null:{id}},error:null})},rpc:async()=>({data:token==='admin',error:null})})};
 return {app:buildApp(clients),writes:()=>writes};
}
test('preflight allows only configured origins and API methods',async()=>{
 const previous=process.env.CORS_ORIGINS;process.env.CORS_ORIGINS=origin;const app=buildApp();
 try{for(const method of ['DELETE','PATCH']){const r=await app.inject({method:'OPTIONS',url:`/api/v1/grenades/${id}`,headers:{origin,'access-control-request-method':method,'access-control-request-headers':'authorization,content-type'}});assert.equal(r.statusCode,204);assert.equal(r.headers['access-control-allow-origin'],origin);assert.ok(String(r.headers['access-control-allow-methods']).split(',').map(x=>x.trim()).includes(method));assert.match(String(r.headers['access-control-allow-headers']),/authorization/i);}
 const denied=await app.inject({method:'OPTIONS',url:`/api/v1/grenades/${id}`,headers:{origin:'https://untrusted.example','access-control-request-method':'DELETE','access-control-request-headers':'authorization'}});assert.equal(denied.headers['access-control-allow-origin'],undefined);
 }finally{await app.close();if(previous===undefined)delete process.env.CORS_ORIGINS;else process.env.CORS_ORIGINS=previous;}
});
test('PATCH and DELETE enforce authentication and admin permission before writes',async()=>{
 const f=fixture();try{for(const method of ['PATCH','DELETE'] as const){for(const [token,status]of [[undefined,401],['bad',401],['viewer',403]] as const){const r=await f.app.inject({method,url:`/api/v1/grenades/${id}`,headers:token?{authorization:`Bearer ${token}`}:{},...(method==='PATCH'?{payload:{title:'Novo'}}:{})});assert.equal(r.statusCode,status);}}assert.equal(f.writes(),0);}finally{await f.app.close();}
});
test('admin PATCH succeeds and DELETE returns 204 then 404 for missing row',async()=>{
 const f=fixture();try{const headers={authorization:'Bearer admin'};const patch=await f.app.inject({method:'PATCH',url:`/api/v1/grenades/${id}`,headers,payload:{title:'Novo',expectedRevision:1}});assert.equal(patch.statusCode,200);const deleted=await f.app.inject({method:'DELETE',url:`/api/v1/grenades/${id}`,headers});assert.equal(deleted.statusCode,204);assert.equal(deleted.body,'');const missing=await f.app.inject({method:'DELETE',url:`/api/v1/grenades/${id}`,headers});assert.equal(missing.statusCode,404);}finally{await f.app.close();}
});
