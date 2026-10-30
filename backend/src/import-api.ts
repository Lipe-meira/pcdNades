import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {tikTokRuntimeAvailable,extractTikTok} from './import-runtime.js';
import {recognizeSource} from './importers.js';
import {inspectRequest,selectedImport,importLimits,type sourceMetadata} from './tiktok.js';
import {importFailure} from './import-network.js';
export type ImportDependencies={available:()=>boolean;extract:(url:string,controller:AbortController,dir:string)=>Promise<{metadata:ReturnType<typeof sourceMetadata>}>};
export const importDependencies:ImportDependencies={available:tikTokRuntimeAvailable,extract:extractTikTok};
export function importDbResult<T>(result:{data:T;error?:{message?:string}|null}):T{
 if(result.error){const code=['SOURCE_NOT_FOUND','SOURCE_EXPIRED','IMPORT_SELECTION_CONFLICT','CLIP_OUT_OF_RANGE','IMPORT_RATE_LIMIT'].find(v=>result.error?.message?.includes(v));if(code)throw importFailure(code,({SOURCE_NOT_FOUND:404,SOURCE_EXPIRED:410,IMPORT_SELECTION_CONFLICT:409,CLIP_OUT_OF_RANGE:400,IMPORT_RATE_LIMIT:429} as Record<string,number>)[code]);throw importFailure('SERVICE_UNAVAILABLE',503);}return result.data;
}
export async function inspectSource(db:SupabaseClient,owner:string,input:unknown,deps:ImportDependencies){
 const request=inspectRequest.parse(input);const source=recognizeSource(request.sourceUrl);if(source.provider!=='tiktok')throw importFailure('SOURCE_UNSUPPORTED');
 if(!deps.available())throw importFailure('IMPORT_UNAVAILABLE',503);
 const controller=new AbortController(),holder=randomUUID();const timer=setTimeout(()=>controller.abort(importFailure('IMPORT_TIMEOUT')),25000);timer.unref();let slot=false,dir:string|undefined;
 const rpc=async(name:string,args:Record<string,unknown>)=>{const query=db.rpc(name,args);return await (typeof query.abortSignal==='function'?query.abortSignal(controller.signal):query);};
 try{
  if(!importDbResult(await rpc('claim_import_slot',{p_holder:holder,p_seconds:30})))throw importFailure('PROCESSOR_BUSY',503);slot=true;
  const session=importDbResult<any>(await rpc('reserve_import_source',{p_owner:owner}));
  dir=await mkdtemp(join(tmpdir(),'pcdnades-inspect-'));const {metadata}=await deps.extract(source.canonicalUrl,controller,dir);
  if(controller.signal.aborted)throw importFailure('IMPORT_TIMEOUT');
  const updated=importDbResult(await db.from('import_sources').update({metadata}).eq('id',session.id).eq('owner_id',owner).is('metadata',null).select('id').abortSignal(controller.signal).maybeSingle());if(!updated)throw importFailure('SERVICE_UNAVAILABLE',503);
  return {sourceId:session.id,...metadata,expiresAt:session.expires_at,preview:null,previewReasonCode:'PREVIEW_UNAVAILABLE',limits:importLimits};
 }catch(error){if(controller.signal.aborted)throw controller.signal.reason??importFailure('IMPORT_TIMEOUT');throw error;}
 finally{clearTimeout(timer);if(slot){const q=db.rpc('release_import_slot',{p_holder:holder});await (typeof q.abortSignal==='function'?q.abortSignal(AbortSignal.timeout(2000)):q).then(()=>{},()=>{});}if(dir)await rm(dir,{recursive:true,force:true});}
}
export async function createSourceImport(db:SupabaseClient,owner:string,input:unknown,deps:ImportDependencies){
 const request=selectedImport.parse(input);if(!deps.available())throw importFailure('IMPORT_UNAVAILABLE',503);
 const q=db.rpc('create_tiktok_import',{p_source_id:request.sourceId,p_owner:owner,p_clip:request.clip});const result=await (typeof q.abortSignal==='function'?q.abortSignal(AbortSignal.timeout(5000)):q);return importDbResult(result);
}
