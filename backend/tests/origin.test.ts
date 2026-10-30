import {test} from 'node:test';
import assert from 'node:assert/strict';
import {body,dbBody,grenadeView} from '../src/model.js';
import {buildApp} from '../src/application.js';

const id='123e4567-e89b-42d3-a456-426614174000';
const videoId='123e4567-e89b-42d3-a456-426614174001';
const otherVideoId='123e4567-e89b-42d3-a456-426614174009';
const draft={title:'Smoke janela',mapId:'mirage',type:'smoke',side:'T',instructions:'Execute o lançamento.',target:{x:0.7,y:0.4},videoId};

test('origin accepts null/omission and inclusive zero/one bounds',()=>{
 for(const origin of [null,{x:0,y:1},{x:1,y:0},{x:0.125,y:0.625}])assert.equal(body.safeParse({...draft,origin}).success,true);
 assert.equal(body.safeParse(draft).success,true);
});
test('origin rejects partial, non-finite, outside bounds and unknown fields',()=>{
 for(const origin of [{x:0},{y:0},{x:null,y:0},{x:'0',y:0},{x:NaN,y:0},{x:Infinity,y:0},{x:-Infinity,y:0},{x:-0.001,y:0},{x:0,y:1.001},{x:0,y:0,z:0},[],false])assert.equal(body.safeParse({...draft,origin}).success,false);
});
test('DB mapping replaces/clears origin atomically and omitted patch preserves it',()=>{
 assert.deepEqual(dbBody({origin:{x:0,y:1}}),{origin_x:0,origin_y:1});
 assert.deepEqual(dbBody({origin:null}),{origin_x:null,origin_y:null});
 assert.deepEqual(dbBody({title:'Renomeada'}),{title:'Renomeada'});
 assert.deepEqual(dbBody({mapId:'mirage',videoId}),{map_id:'mirage',video_id:videoId});
 assert.deepEqual(body.partial().parse({origin:null}),{origin:null});
 assert.throws(()=>body.partial().parse({origin:{x:1}}));
});
test('view exposes origin, preserving zeros and legacy nulls without deriving it from target',()=>{
 const row={id,target:{x:0.7,y:0.4},origin_x:0,origin_y:1};
 assert.deepEqual(grenadeView(row).origin,{x:0,y:1});
 assert.equal(grenadeView({id,target:row.target}).origin,null);
 assert.equal(grenadeView({...row,origin_x:null,origin_y:null}).origin,null);
 assert.deepEqual(grenadeView(row).target,row.target);
 assert.equal('origin_x' in grenadeView(row),false);
});

// In-memory DB substitute verifies HTTP contract/authorization, not Supabase RLS.
function setup(role:'admin'|'viewer'='admin'){
 const rows:any[]=[{id,title:'Legada',map_id:'mirage',type:'smoke',side:'T',instructions:'Original',target:{x:0.7,y:0.4},video_id:videoId,created_at:'2026-10-30T00:00:00Z',updated_at:'2026-10-30T00:00:00Z',origin_x:null,origin_y:null}];
 let writes=0;
 const query=(table:string)=>{let change:any,operation='select';const predicates:Array<(r:any)=>boolean>=[];let single=false;
  const q:any={select:()=>q,eq:(k:string,v:any)=>{predicates.push(r=>r[k]===v);return q;},order:()=>q,range:()=>q,insert:(value:any)=>{operation='insert';change=value;return q;},update:(value:any)=>{operation='update';change=value;return q;},single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},then:(resolve:any)=>{
   if(table==='media_assets'){const media=[videoId,otherVideoId].map(id=>({id,status:'ready',source_type:'upload',source_url:null,metadata:{durationSeconds:2}}));return Promise.resolve({data:media.find(r=>predicates.every(p=>p(r)))??null,error:null}).then(resolve);}
   let selected=rows.filter(r=>predicates.every(p=>p(r)));
   if(operation==='insert'){writes++;const added={...change,id:`123e4567-e89b-42d3-a456-42661417400${rows.length+1}`,created_at:'2026-10-30T00:00:00Z',updated_at:'2026-10-30T00:00:00Z',origin_x:null,origin_y:null,...change};rows.push(added);selected=[added];}
   if(operation==='update'){writes++;for(const row of selected)Object.assign(row,change);}
   return Promise.resolve({data:single?selected[0]??null:selected,count:selected.length,error:null}).then(resolve);
  }};return q;
 };
 const clients:any={public:{from:query},service:{from:query},user:()=>({from:query,auth:{getUser:async()=>({data:{user:{id:'admin-id'}},error:null})},rpc:async()=>({data:role==='admin',error:null})})};
 return {app:buildApp(clients),rows,writes:()=>writes};
}
const adminHeaders={authorization:'Bearer test-token'};
test('create distinct origins for the same destination and return public list/detail',async()=>{
 const f=setup();try{
  for(const [origin,chosenVideoId] of [[{x:0,y:1},videoId],[{x:0.2,y:0.3},otherVideoId]] as const){const r=await f.app.inject({method:'POST',url:'/api/v1/grenades',headers:adminHeaders,payload:{...draft,videoId:chosenVideoId,origin}});assert.equal(r.statusCode,201);assert.deepEqual(r.json().data.origin,origin);assert.deepEqual(r.json().data.target,draft.target);assert.equal(r.json().data.video.id,chosenVideoId);}
  const list=await f.app.inject('/api/v1/grenades?mapId=mirage');assert.equal(list.statusCode,200);assert.equal(list.json().data.length,3);assert.equal(list.json().data[0].origin,null);
  const detail=await f.app.inject(`/api/v1/grenades/${id}`);assert.equal(detail.statusCode,200);assert.equal(detail.json().data.origin,null);
 }finally{await f.app.close();}
});
test('patch can set, preserve or explicitly clear origin without changing target/video',async()=>{
 const f=setup();try{
  for(const [patch,expected]of [[{origin:{x:0,y:0}},{x:0,y:0}],[{title:'Novo título'},{x:0,y:0}],[{origin:null},null]] as const){const r=await f.app.inject({method:'PATCH',url:`/api/v1/grenades/${id}`,headers:adminHeaders,payload:patch});assert.equal(r.statusCode,200);assert.deepEqual(r.json().data.origin,expected);assert.deepEqual(r.json().data.target,draft.target);assert.equal(r.json().data.video.id,videoId);}
  const before=f.writes();const invalid=await f.app.inject({method:'PATCH',url:`/api/v1/grenades/${id}`,headers:adminHeaders,payload:{origin:{x:0}}});assert.equal(invalid.statusCode,400);assert.equal(f.writes(),before);
 }finally{await f.app.close();}
});
test('create without origin remains compatible and partial origin cannot be persisted',async()=>{
 const f=setup();try{const r=await f.app.inject({method:'POST',url:'/api/v1/grenades',headers:adminHeaders,payload:draft});assert.equal(r.statusCode,201);assert.equal(r.json().data.origin,null);const before=f.writes();const invalid=await f.app.inject({method:'POST',url:'/api/v1/grenades',headers:adminHeaders,payload:{...draft,origin:{x:1.001,y:0}}});assert.equal(invalid.statusCode,400);assert.equal(f.writes(),before);}finally{await f.app.close();}
});
test('anonymous and non-admin writes stay denied before origin mutation',async()=>{
 const f=setup('viewer');try{for(const method of ['POST','PATCH'] as const){const url=method==='POST'?'/api/v1/grenades':`/api/v1/grenades/${id}`;const payload=method==='POST'?{...draft,origin:{x:0,y:0}}:{origin:null};assert.equal((await f.app.inject({method,url,payload})).statusCode,401);assert.equal((await f.app.inject({method,url,payload,headers:adminHeaders})).statusCode,403);}assert.equal(f.writes(),0);}finally{await f.app.close();}
});

test('mapId-only patch does not infer or silently clear origin; caller must remark coordinates',async()=>{
 const f=setup();f.rows[0].origin_x=0;f.rows[0].origin_y=1;
 try{const r=await f.app.inject({method:'PATCH',url:`/api/v1/grenades/${id}`,headers:adminHeaders,payload:{mapId:'inferno'}});assert.equal(r.statusCode,200);assert.deepEqual(r.json().data.origin,{x:0,y:1});assert.deepEqual(r.json().data.target,draft.target);assert.equal(r.json().data.mapId,'inferno');assert.equal(r.json().data.video.id,videoId);}finally{await f.app.close();}
});
