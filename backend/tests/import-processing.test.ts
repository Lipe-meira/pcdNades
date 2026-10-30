import {test} from 'node:test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {completeImport} from '../src/import-processing.js';
const source={provider:'tiktok',sourceUrl:'https://www.tiktok.com/@creator/video/7701366996495125766',videoId:'7701366996495125766',title:'Tutorial',author:'Autor',durationSeconds:4000};
function fake(initial:any={}){
 let row:any={id:'media',owner_id:'admin',source_type:'tiktok',source_url:source.sourceUrl,storage_key:'pending.mp4',status:'queued',attempts:0,locked_until:null,clip:{startSeconds:1800,endSeconds:1810},import_source_id:'source',import_snapshot:source,...initial};let slot=true,stores=0,processed=0;
 const calls:string[]=[];
 const db:any={rpc:async(name:string)=>{calls.push(name);return {data:name==='claim_import_slot'?slot:null};},from:()=>{let update:any;const predicates:Array<(r:any)=>boolean>=[];const q:any={select:()=>q,update:(u:any)=>{update=u;return q;},eq:(k:string,v:any)=>{predicates.push(r=>r[k]===v);return q;},lte:(k:string,v:any)=>{predicates.push(r=>r[k]<=v);return q;},gt:(k:string,v:any)=>{predicates.push(r=>r[k]>v);return q;},abortSignal:()=>q,maybeSingle:async()=>{if(!predicates.every(f=>f(row)))return {data:null};if(update)row={...row,...update};return {data:{...row}};}};return q;}};
 const deps={available:()=>true,process:async(_s:any,_c:any,path:string)=>{processed++;await writeFile(path,'clip');return {durationSeconds:10,width:320,height:240,mimeType:'video/mp4',bytes:4,provenance:source};},store:async()=>{stores++;}};
 return {db,deps,row:()=>row,calls,denySlot:()=>{slot=false;},stores:()=>stores,processed:()=>processed};
}
test('import stores only validated output, preserves provenance, and terminal complete is idempotent',async()=>{
 const f=fake();const result=await completeImport(f.db,'media',{maxBytes:50000000,maxDurationSeconds:90},f.deps);
 assert.equal(result.asset.status,'ready');assert.equal(result.asset.storage_key,'media/import-1.mp4');assert.equal(result.asset.metadata.sourceId,'source');assert.deepEqual(result.asset.clip,{startSeconds:1800,endSeconds:1810});assert.equal(f.stores(),1);
 await completeImport(f.db,'media',{maxBytes:50000000,maxDurationSeconds:90},f.deps);assert.equal(f.processed(),1);assert.deepEqual(f.calls,['claim_import_slot','release_import_slot']);
});
test('global slot busy leaves queued asset intact and retry does not create a new selection',async()=>{
 const f=fake();f.denySlot();await assert.rejects(completeImport(f.db,'media',{maxBytes:50000000,maxDurationSeconds:90},f.deps),(e:any)=>e.code==='PROCESSOR_BUSY');assert.equal(f.row().status,'queued');assert.equal(f.row().attempts,0);assert.equal(f.processed(),0);
});
test('failed download never stores or changes existing key and returns bounded error without raw extractor output',async()=>{
 const f=fake();const result=await completeImport(f.db,'media',{maxBytes:50000000,maxDurationSeconds:90},{...f.deps,process:async()=>{throw new Error('https://secret.cdn/token');}});
 assert.equal(result.asset.status,'failed');assert.equal(result.asset.storage_key,'pending.mp4');assert.equal(f.stores(),0);assert.equal(result.asset.error.code,'IMPORT_FAILED');assert.ok(!JSON.stringify(result.asset.error).includes('secret'));
});
test('active lease is observed without claiming; expired second attempt cannot exceed recovery budget',async()=>{
 const active=fake({status:'processing',attempts:1,locked_until:new Date(Date.now()+10000).toISOString()});assert.equal((await completeImport(active.db,'media',{maxBytes:50000000,maxDurationSeconds:90},active.deps)).status,202);assert.equal(active.calls.length,0);
 const expired=fake({status:'processing',attempts:2,locked_until:new Date(Date.now()-10000).toISOString()});const r=await completeImport(expired.db,'media',{maxBytes:50000000,maxDurationSeconds:90},expired.deps);assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'ATTEMPTS_EXHAUSTED');assert.equal(expired.processed(),0);
});
test('stale attempt cannot publish a stored result over a later attempt',async()=>{
 const f=fake();const result=await completeImport(f.db,'media',{maxBytes:50000000,maxDurationSeconds:90},{...f.deps,process:async(_s,_c,path)=>{await writeFile(path,'clip');f.row().attempts++;return {durationSeconds:10,width:320,height:240,mimeType:'video/mp4',bytes:4};}});assert.equal(result.status,202);assert.equal(result.asset.status,'processing');assert.equal(f.stores(),0);
});
test('access denial and network quota failures remain explicit sanitized terminal errors',async()=>{
 for(const code of ['IMPORT_ACCESS_DENIED','IMPORT_NETWORK_LIMIT']){
  const f=fake();const r=await completeImport(f.db,'media',{maxBytes:50000000,maxDurationSeconds:90},{...f.deps,process:async(_s,_c,_p,_d,_l,controller)=>{const e=Object.assign(new Error('secret CDN headers'),{code});if(code==='IMPORT_NETWORK_LIMIT')controller.abort(e);throw e;}});
  assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,code);assert.ok(!JSON.stringify(r.asset.error).includes('secret'));assert.equal(f.stores(),0);
 }
});
