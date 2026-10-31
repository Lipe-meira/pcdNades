import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildApp} from '../src/application.js';
const id='123e4567-e89b-42d3-a456-426614174000';
const metadata={provider:'tiktok',sourceUrl:'https://www.tiktok.com/@creator/video/7701366996495125766',videoId:'7701366996495125766',title:'Tutorial',author:'Autor',durationSeconds:4000};
function fake(){
 let inspected=0,created=0;const calls:string[]=[];
 const row={id,owner_id:'admin',status:'queued',source_type:'tiktok',source_url:metadata.sourceUrl,clip:{startSeconds:1800,endSeconds:1810},import_source_id:id,import_snapshot:metadata,attempts:0};
 const service:any={rpc:async(name:string,args:any)=>{calls.push(name);if(name==='claim_import_slot')return {data:true};if(name==='release_import_slot')return {data:null};if(name==='reserve_import_source')return {data:{id,expires_at:'2099-01-01T00:00:00Z'}};if(name==='create_tiktok_import'){created++;assert.equal(args.p_owner,'admin');return {data:row};}throw new Error(name);},from:()=>{const q:any={update:()=>q,eq:()=>q,is:()=>q,select:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:{id}})};return q;}};
 const clients:any={public:{},service,user:()=>({auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>({data:true})})};
 return {clients,calls,row,created:()=>created,inspected:()=>inspected,deps:{available:()=>true,extract:async()=>{inspected++;return {metadata};}}};
}
test('inspection requires authentication before extracting and returns only safe metadata',async()=>{
 const f=fake();const app=buildApp(f.clients,f.deps);
 try{assert.equal((await app.inject({method:'POST',url:'/api/v1/media/imports/inspect',payload:{sourceUrl:metadata.sourceUrl}})).statusCode,401);assert.equal(f.inspected(),0);
 const r=await app.inject({method:'POST',url:'/api/v1/media/imports/inspect',headers:{authorization:'Bearer token'},payload:{sourceUrl:metadata.sourceUrl}});assert.equal(r.statusCode,201);const d=r.json().data;assert.equal(d.sourceId,id);assert.equal(d.durationSeconds,4000);assert.equal(d.preview,null);assert.equal(d.previewReasonCode,'PREVIEW_UNAVAILABLE');assert.equal(d.limits.maxSourceDurationSeconds,7200);assert.equal(f.inspected(),1);assert.deepEqual(f.calls,['claim_import_slot','reserve_import_source','release_import_slot']);
 }finally{await app.close();}
});
test('source-id import accepts long-source clip without invoking extractor or accepting user CDN URL',async()=>{
 const f=fake(),app=buildApp(f.clients,f.deps);const headers={authorization:'Bearer token'};
 try{const r=await app.inject({method:'POST',url:'/api/v1/media/imports',headers,payload:{sourceId:id,clip:{startSeconds:1800,endSeconds:1810}}});assert.equal(r.statusCode,201);assert.equal(r.json().data.status,'queued');assert.equal(r.json().data.id,r.json().data.mediaId);assert.equal(r.json().data.sourceId,id);assert.equal(f.created(),1);assert.equal(f.inspected(),0);
 const bad=await app.inject({method:'POST',url:'/api/v1/media/imports',headers,payload:{sourceId:id,sourceUrl:'https://127.0.0.1/x',clip:{startSeconds:0,endSeconds:1}}});assert.equal(bad.statusCode,400);assert.equal(f.created(),1);
 }finally{await app.close();}
});
test('disabled runtime rejects source sessions and preserves disabled legacy source-url response',async()=>{
 const f=fake(),app=buildApp(f.clients,{...f.deps,available:()=>false});const headers={authorization:'Bearer token'};
 try{assert.equal((await app.inject({method:'POST',url:'/api/v1/media/imports/inspect',headers,payload:{sourceUrl:metadata.sourceUrl}})).statusCode,503);const r=await app.inject({method:'POST',url:'/api/v1/media/imports',headers,payload:{sourceUrl:metadata.sourceUrl}});assert.equal(r.statusCode,422);assert.equal(r.json().error.code,'PLATFORM_UNSUPPORTED');assert.equal(f.calls.length,0);
 }finally{await app.close();}
});

test('configured 20s/bytes limits are identical in capabilities, inspection and creation',async()=>{
 const previousDuration=process.env.MEDIA_MAX_DURATION_SECONDS,previousBytes=process.env.MEDIA_MAX_BYTES;
 process.env.MEDIA_MAX_DURATION_SECONDS='20';process.env.MEDIA_MAX_BYTES='1000000';
 const f=fake(),app=buildApp(f.clients,f.deps),headers={authorization:'Bearer token'};
 try{
  const caps=(await app.inject({method:'GET',url:'/api/v1/media/capabilities'})).json().data;
  assert.equal(caps.importers.tiktok.maxDurationSeconds,20);assert.equal(caps.importers.tiktok.maxBytes,1000000);
  const inspected=await app.inject({method:'POST',url:'/api/v1/media/imports/inspect',headers,payload:{sourceUrl:metadata.sourceUrl}});
  assert.equal(inspected.json().data.limits.maxDurationSeconds,20);assert.equal(inspected.json().data.limits.maxBytes,1000000);
  const denied=await app.inject({method:'POST',url:'/api/v1/media/imports',headers,payload:{sourceId:id,clip:{startSeconds:1800,endSeconds:1821}}});
  assert.equal(denied.statusCode,400);assert.equal(denied.json().error.code,'CLIP_OUT_OF_RANGE');assert.equal(f.created(),0);
 }finally{await app.close();if(previousDuration===undefined)delete process.env.MEDIA_MAX_DURATION_SECONDS;else process.env.MEDIA_MAX_DURATION_SECONDS=previousDuration;if(previousBytes===undefined)delete process.env.MEDIA_MAX_BYTES;else process.env.MEDIA_MAX_BYTES=previousBytes;}
});
