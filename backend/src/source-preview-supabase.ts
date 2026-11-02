import type {SupabaseClient} from '@supabase/supabase-js';
import {readFile,lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {importFailure} from './import-network.js';
import {beforeDeadline} from './import-deadline.js';
import {previewKey,stageSourcePreview,readSourcePreview,cleanupSourcePreviews,reconcilePreviewOrphans,type PreviewPorts,type PreviewRow} from './source-preview.js';
const bucket='import-previews';
const fail=()=>importFailure('PREVIEW_UNAVAILABLE',503);
async function storageOperation<T>(operation:()=>PromiseLike<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)throw fail();
 const value=await beforeDeadline(operation(),signal);if(signal.aborted)throw fail();return value;
}
function result<T>(r:{data:T;error:unknown}):T{if(r.error)throw fail();return r.data;}
function row(v:any):PreviewRow|null{if(!v||!v.source_id)return null;return {sourceId:v.source_id,ownerId:v.owner_id,key:v.object_key,expiresAt:v.expires_at,state:v.state,holder:v.holder,lockedUntil:v.locked_until};}
export function safePreviewSignedUrl(raw:string,origin:string,prefix:string,key:string){
 let url:URL,base:URL;try{url=new URL(raw);base=new URL(origin)}catch{throw fail()}
 if(base.username||base.password||base.hash||base.search||base.pathname!=='/'||!['https:','http:'].includes(base.protocol)||(base.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(base.hostname)))throw fail();
 if(url.origin!==base.origin||url.username||url.password||url.hash||url.pathname!==`${prefix}${key}`)throw fail();
 return url.href;
}
export function supabasePreviewPorts(db:SupabaseClient,origin:string,signal:AbortSignal):PreviewPorts{
 const storage=db.storage.from(bucket);
 return {
  reserve:async input=>{const v=row(result(await db.rpc('reserve_source_preview',{p_source:input.sourceId,p_owner:input.ownerId}).abortSignal(signal)));if(!v)throw fail();return v},
  upload:async(key,path)=>{
   const id=key.endsWith('.mp4')?key.slice(0,-4):'';if(previewKey(id)!==key)throw fail();
   const file=await lstat(path);if(!file.isFile()||file.size<1||file.size>50000000)throw fail();
   const s=result(await storageOperation(()=>storage.createSignedUploadUrl(key,{upsert:false}),signal));
   if(!s)throw fail();const url=safePreviewSignedUrl(s.signedUrl,origin,'/storage/v1/object/upload/sign/import-previews/',key);
   const bytes=await readFile(path,{signal});if(bytes.length!==file.size||signal.aborted)throw fail();
   const response=await fetch(url,{method:'PUT',headers:{'content-type':'video/mp4','x-upsert':'false','cache-control':'no-store'},body:new Uint8Array(bytes),signal,redirect:'error'});
   await response.body?.cancel();if(!response.ok)throw fail();
  },
  ready:async(sourceId,ownerId)=>result(await db.rpc('finish_source_preview',{p_source:sourceId,p_owner:ownerId}).abortSignal(signal))===true,
  lookup:async(sourceId)=>row(result(await db.from('import_preview_jobs').select('*').eq('source_id',sourceId).abortSignal(signal).maybeSingle())),
  sign:async(key,seconds)=>{const s=result(await storageOperation(()=>storage.createSignedUrl(key,seconds),signal));if(!s)throw fail();return safePreviewSignedUrl(s.signedUrl,origin,'/storage/v1/object/sign/import-previews/',key)},
  claimExpired:async()=>{const holder=randomUUID();return row(result(await db.rpc('claim_source_preview_cleanup',{p_holder:holder}).abortSignal(signal)))},
  remove:async key=>{if(previewKey(key.slice(0,-4))!==key)throw fail();result(await storageOperation(()=>storage.remove([key]),signal))},
  release:async(sourceId,holder)=>{if(result(await db.rpc('finish_source_preview_cleanup',{p_source:sourceId,p_holder:holder}).abortSignal(signal))!==true)throw fail()},
 };
}

const MAX_HEARTBEAT_AGE_MS=480000;
/** The flag alone is not sufficient; a fresh complete sweep is mandatory. */
export async function sourcePreviewAvailable(db:SupabaseClient,env:Record<string,string|undefined>=process.env,now=Date.now()):Promise<boolean>{
 if(env.MEDIA_SOURCE_PREVIEW_ENABLED!=='true')return false;
 try{
  const v=result(await db.from('import_preview_maintenance').select('swept_at').eq('singleton',true).abortSignal(AbortSignal.timeout(3000)).maybeSingle());
  const ts=Date.parse(v?.swept_at??'');return Number.isFinite(ts)&&ts<=now+5000&&now-ts<=MAX_HEARTBEAT_AGE_MS;
 }catch{return false}
}
export async function stageImportPreview(db:SupabaseClient,input:{sourceId:string;ownerId:string;expiresAt:string;localSource:string;signal:AbortSignal;origin:string}):Promise<boolean>{
 if(!await sourcePreviewAvailable(db))return false;
 try{await stageSourcePreview(supabasePreviewPorts(db,input.origin,input.signal),{...input,path:input.localSource,now:Date.now(),enabled:true});return true}catch{return false}
}
export async function getImportPreview(db:SupabaseClient,input:{sourceId:string;ownerId:string;signal:AbortSignal;origin:string}){
 if(!await sourcePreviewAvailable(db))throw fail();
 return readSourcePreview(supabasePreviewPorts(db,input.origin,input.signal),{...input,now:Date.now(),enabled:true});
}
/** Run via a monitored scheduler. No heartbeat is written on any incomplete sweep. */
export async function runSourcePreviewMaintenance(db:SupabaseClient,origin:string,signal:AbortSignal){
 const ports=supabasePreviewPorts(db,origin,signal),now=Date.now();
 const removed=await cleanupSourcePreviews(ports,now,50);if(removed===50)throw fail();
 const storage=db.storage.from(bucket);
 const orphans=await reconcilePreviewOrphans({
  list:async(offset,limit)=>{const items=result(await storageOperation(()=>storage.list('',{offset,limit,sortBy:{column:'name',order:'asc'}}),signal));if(!items)throw fail();return items.map(item=>({name:item.name,createdAt:item.created_at??null}))},
  lookup:async id=>ports.lookup(id),remove:async key=>ports.remove(key),
 },now);
 if(!orphans.complete)throw fail();
 // An unexpired cleanup lease may belong to a stalled peer. Skipping it is not
 // evidence of a complete sweep; never refresh health while expired jobs remain.
 const backlog=result(await db.from('import_preview_jobs').select('source_id').lte('expires_at',new Date(now-120000).toISOString()).limit(1).abortSignal(signal));
 if(backlog?.length)throw fail();
 result(await db.rpc('mark_source_preview_sweep').abortSignal(signal));
 return {removed,orphansRemoved:orphans.removed};
}
