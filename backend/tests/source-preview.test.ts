import {test} from 'node:test';import assert from 'node:assert/strict';import {stageSourcePreview,readSourcePreview,cleanupSourcePreviews,previewKey} from '../src/source-preview.js';
const sourceId='123e4567-e89b-42d3-a456-426614174000',owner='223e4567-e89b-42d3-a456-426614174000',expiresAt='2030-01-01T00:15:00.000Z',now=Date.parse('2030-01-01T00:00:00.000Z');
function fake(){let row:any=null;const calls:string[]=[];return {calls,get row(){return row},ports:{reserve:async(v:any)=>{calls.push('reserve');row={...v,state:'reserved'};return row},upload:async(key:string)=>{calls.push('upload:'+key)},ready:async()=>{calls.push('ready');row.state='ready';return true},lookup:async()=>row,sign:async(key:string,seconds:number)=>{calls.push('sign:'+seconds);return 'https://project.supabase.test/storage/v1/object/sign/import-previews/'+key+'?token=x'},claimExpired:async()=>row&&Date.parse(row.expiresAt)<now+1200000?{...row,state:'deleting',holder:owner,lockedUntil:new Date(now+1320000).toISOString()}:null,remove:async(key:string)=>{calls.push('remove:'+key)},release:async()=>{calls.push('release');row=null}}};}
test('preview records reservation before upload and refuses flag absent',async()=>{const f=fake();await assert.rejects(stageSourcePreview(f.ports,{sourceId,ownerId:owner,expiresAt,path:'unused',now,enabled:false}),/PREVIEW_UNAVAILABLE/);assert.deepEqual(f.calls,[]);await stageSourcePreview(f.ports,{sourceId,ownerId:owner,expiresAt,path:'unused',now,enabled:true});assert.deepEqual(f.calls,['reserve','upload:'+sourceId+'.mp4','ready']);});
test('URL signing requires owner, ready status and bounds expiration',async()=>{const f=fake();await stageSourcePreview(f.ports,{sourceId,ownerId:owner,expiresAt,path:'unused',now,enabled:true});await assert.rejects(readSourcePreview(f.ports,{sourceId,ownerId:'323e4567-e89b-42d3-a456-426614174000',now,enabled:true}),/PREVIEW_UNAVAILABLE/);const url=await readSourcePreview(f.ports,{sourceId,ownerId:owner,now,enabled:true});assert.equal(url.expiresAt,'2030-01-01T00:01:00.000Z');assert.equal(url.mimeType,'video/mp4');assert.ok(f.calls.includes('sign:60'));await assert.rejects(readSourcePreview(f.ports,{sourceId,ownerId:owner,now:Date.parse(expiresAt),enabled:true}),/PREVIEW_UNAVAILABLE/);});
test('ambiguous upload failure leaves durable reservation, cleanup removes only strict preview key',async()=>{const f=fake();f.ports.upload=async()=>{throw Error('ambiguous')};await assert.rejects(stageSourcePreview(f.ports,{sourceId,ownerId:owner,expiresAt,path:'unused',now,enabled:true}));assert.equal(f.row.state,'reserved');await cleanupSourcePreviews(f.ports,now+1200000);assert.ok(f.calls.includes('remove:'+sourceId+'.mp4'));assert.equal(f.row,null);assert.throws(()=>previewKey('../foo'));});

test('signed URL must point to the exact expected private object and Supabase origin',async()=>{
 const {safePreviewSignedUrl}=await import('../src/source-preview-supabase.js');const prefix='/storage/v1/object/sign/import-previews/',key=sourceId+'.mp4',origin='https://example.supabase.co';
 assert.equal(new URL(safePreviewSignedUrl(`${origin}${prefix}${key}?token=test`,origin,prefix,key)).origin,origin);
 for(const url of [`https://evil.example${prefix}${key}?token=test`,`${origin}${prefix}other.mp4?token=test`,`${origin}/storage/v1/object/sign/videos-staging/${key}?token=test`,`${origin}${prefix}${key}#unsafe`])assert.throws(()=>safePreviewSignedUrl(url,origin,prefix,key));
});
test('cleanup does not release registry on storage failure or invalid ownership lease',async()=>{
 const f=fake();await stageSourcePreview(f.ports,{sourceId,ownerId:owner,expiresAt,path:'unused',now,enabled:true});f.ports.remove=async()=>{throw Error('storage unavailable')};await assert.rejects(cleanupSourcePreviews(f.ports,now+1200000));assert.ok(f.row);assert.ok(!f.calls.includes('release'));
});

test('orphan reconciliation ignores published buckets, malformed names, fresh files and rows still registered',async()=>{
 const {reconcilePreviewOrphans}=await import('../src/source-preview.js');let deleted:string[]=[];const old='323e4567-e89b-42d3-a456-426614174000.mp4',fresh='423e4567-e89b-42d3-a456-426614174000.mp4',registered=sourceId+'.mp4';
 const list=async(offset:number)=>offset?[]:[{name:old,createdAt:'2029-12-31T22:00:00.000Z'},{name:fresh,createdAt:'2029-12-31T23:59:00.000Z'},{name:registered,createdAt:'2029-12-31T22:00:00.000Z'},{name:'../videos-staging/known.mp4',createdAt:'2029-12-31T22:00:00.000Z'}];
 await reconcilePreviewOrphans({list,lookup:async id=>id===sourceId?{}:null,remove:async key=>{deleted.push(key)}},now);
 assert.deepEqual(deleted,[old]);
});

test('preview availability fails closed on missing, stale, future or errored heartbeat',async()=>{
 const {sourcePreviewAvailable}=await import('../src/source-preview-supabase.js');
 const query=(swept:string|null,error:any=null)=>({from:()=>{const q:any={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:swept?{swept_at:swept}:null,error})};return q}} as any);
 assert.equal(await sourcePreviewAvailable(query(new Date(now-10_000).toISOString()),{MEDIA_SOURCE_PREVIEW_ENABLED:'true'},now),true);
 for(const value of [null,new Date(now-481_000).toISOString(),new Date(now+6000).toISOString()])assert.equal(await sourcePreviewAvailable(query(value),{MEDIA_SOURCE_PREVIEW_ENABLED:'true'},now),false);
 assert.equal(await sourcePreviewAvailable(query(new Date(now).toISOString()),{},now),false);
 assert.equal(await sourcePreviewAvailable(query(null,{message:'down'}),{MEDIA_SOURCE_PREVIEW_ENABLED:'true'},now),false);
});
