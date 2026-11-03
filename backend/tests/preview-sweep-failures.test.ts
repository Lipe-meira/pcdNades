import {test} from 'node:test';import assert from 'node:assert/strict';import {runSourcePreviewMaintenance} from '../src/source-preview-supabase.js';
const id='123e4567-e89b-42d3-a456-426614174000',holder='223e4567-e89b-42d3-a456-426614174000';
function scenario(options:{storageFailure?:boolean;releaseFailure?:boolean;batchLimit?:boolean;abortOnList?:boolean}={}){
 const c=new AbortController();let claimed=0,removed=0,released=0,marked=0;const buckets:string[]=[];
 const lease=()=>({source_id:id,owner_id:holder,object_key:`${id}.mp4`,expires_at:new Date(Date.now()-180000).toISOString(),state:'deleting',holder,locked_until:new Date(Date.now()+120000).toISOString()});
 const db:any={storage:{from:(bucket:string)=>{buckets.push(bucket);return {remove:async()=>{if(options.storageFailure)throw Error('fixture Storage failed');removed++;return {data:[],error:null};},list:async()=>{if(options.abortOnList)c.abort();return {data:[],error:null};}};}},rpc:(name:string)=>({abortSignal:async()=>{if(name==='claim_preview_sweep')return {data:true,error:null};if(name==='claim_source_preview_cleanup')return {data:options.batchLimit||claimed++===0?lease():null,error:null};if(name==='finish_source_preview_cleanup'){released++;return {data:!options.releaseFailure,error:null};}if(name==='finish_preview_sweep'){marked++;return {data:true,error:null};}return {data:null,error:null};}}),from:()=>{const q:any={select:()=>q,lte:()=>q,limit:()=>q,abortSignal:async()=>({data:[],error:null})};return q;}};
 return {db,c,result:()=>({removed,released,marked,buckets})};
}
test('Storage failure cannot release a reservation or refresh heartbeat; final bucket untouched',async()=>{
 const f=scenario({storageFailure:true});await assert.rejects(runSourcePreviewMaintenance(f.db,'https://fixture.supabase.test',f.c.signal));const r=f.result();assert.equal(r.removed,0);assert.equal(r.released,0);assert.equal(r.marked,0);assert.ok(r.buckets.every(v=>v==='import-previews'));
});
test('failed CAS after object removal keeps sweep unhealthy for later recovery',async()=>{
 const f=scenario({releaseFailure:true});await assert.rejects(runSourcePreviewMaintenance(f.db,'https://fixture.supabase.test',f.c.signal));assert.equal(f.result().removed,1);assert.equal(f.result().marked,0);
});
test('hitting the batch cap never counts a partial sweep as complete',async()=>{
 const f=scenario({batchLimit:true});await assert.rejects(runSourcePreviewMaintenance(f.db,'https://fixture.supabase.test',f.c.signal));assert.equal(f.result().removed,50);assert.equal(f.result().marked,0);
});
test('cancellation during orphan listing cannot publish a successful heartbeat',async()=>{
 const f=scenario({abortOnList:true});await assert.rejects(runSourcePreviewMaintenance(f.db,'https://fixture.supabase.test',f.c.signal));assert.equal(f.result().marked,0);
});
test('complete cleanup and reconciliation can refresh heartbeat once',async()=>{
 const f=scenario();const result=await runSourcePreviewMaintenance(f.db,'https://fixture.supabase.test',f.c.signal);assert.deepEqual(result,{removed:1,orphansRemoved:0});assert.equal(f.result().marked,1);assert.ok(f.result().buckets.every(v=>v==='import-previews'));
});
test('a competing collector cannot touch Storage or refresh the heartbeat',async()=>{
 let storageTouched=false,finished=false;
 const db:any={rpc:(name:string)=>({abortSignal:async()=>{if(name==='finish_preview_sweep')finished=true;return {data:false,error:null};}}),storage:{from:()=>{storageTouched=true;throw Error('unexpected Storage access');}}};
 await assert.rejects(runSourcePreviewMaintenance(db,'https://project.supabase.test',new AbortController().signal));
 assert.equal(storageTouched,false);assert.equal(finished,false);
});
