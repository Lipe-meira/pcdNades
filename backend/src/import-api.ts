import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {tikTokRuntimeAvailable,extractTikTok,instagramRuntimeAvailable,extractInstagram} from './import-runtime.js';
import type {instagramMetadata} from './instagram.js';
import {recognizeSource} from './importers.js';
import {inspectRequest,selectedImport,effectiveImportLimits,type sourceMetadata} from './tiktok.js';
import type {MediaLimits} from './config.js';
import {importFailure} from './import-network.js';
import {beforeDeadline} from './import-deadline.js';
import {contributorError} from './contributor-errors.js';
type Provider='tiktok'|'instagram';
export type ImportDependencies={available:(provider?:Provider)=>boolean;extract:(url:string,controller:AbortController,dir:string)=>Promise<{metadata:ReturnType<typeof sourceMetadata>|ReturnType<typeof instagramMetadata>;localSource?:string}>};
export const importDependencies:ImportDependencies={available:provider=>provider==='instagram'?instagramRuntimeAvailable():tikTokRuntimeAvailable(),extract:(url,controller,dir)=>recognizeSource(url).provider==='instagram'?extractInstagram(url,controller,dir):extractTikTok(url,controller,dir)};
export function importDbResult<T>(result:{data:T;error?:{message?:string}|null}):T{
 if(result.error){const known=contributorError(result.error.message);if(known)throw importFailure(known.code,known.status);const code=['SOURCE_NOT_FOUND','SOURCE_EXPIRED','IMPORT_SELECTION_CONFLICT','CLIP_OUT_OF_RANGE','IMPORT_RATE_LIMIT'].find(v=>result.error?.message?.includes(v));if(code)throw importFailure(code,({SOURCE_NOT_FOUND:404,SOURCE_EXPIRED:410,IMPORT_SELECTION_CONFLICT:409,CLIP_OUT_OF_RANGE:400,IMPORT_RATE_LIMIT:429} as Record<string,number>)[code]);throw importFailure('SERVICE_UNAVAILABLE',503);}return result.data;
}
export async function inspectSource(db:SupabaseClient,owner:string,input:unknown,deps:ImportDependencies,limits?:MediaLimits){
 const request=inspectRequest.parse(input);const source=recognizeSource(request.sourceUrl);if(source.provider!=='tiktok'&&source.provider!=='instagram')throw importFailure('SOURCE_UNSUPPORTED');
 if(!deps.available(source.provider))throw importFailure('IMPORT_UNAVAILABLE',503);
 const controller=new AbortController(),holder=randomUUID(),inspectionMs=source.provider==='instagram'?65000:25000;const timer=setTimeout(()=>controller.abort(importFailure('IMPORT_TIMEOUT')),inspectionMs);timer.unref();let slot=false,dir:string|undefined;
 const rpc=async(name:string,args:Record<string,unknown>)=>{const query=db.rpc(name,args),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]);return await beforeDeadline<any>(typeof query.abortSignal==='function'?query.abortSignal(signal):query,signal);};
 try{
  if(!importDbResult(await rpc('claim_import_slot',{p_holder:holder,p_seconds:source.provider==='instagram'?70:30,p_owner:owner})))throw importFailure('PROCESSOR_BUSY',503);slot=true;
  const session=importDbResult<any>(await rpc('reserve_import_source',{p_owner:owner}));
  dir=await mkdtemp(join(tmpdir(),'pcdnades-inspect-'));const {metadata}=await deps.extract(source.canonicalUrl,controller,dir);
  if(controller.signal.aborted)throw importFailure('IMPORT_TIMEOUT');if(metadata.provider!==source.provider)throw importFailure('SOURCE_CHANGED');
  const updated=importDbResult(await db.from('import_sources').update({metadata}).eq('id',session.id).eq('owner_id',owner).is('metadata',null).select('id').abortSignal(controller.signal).maybeSingle());if(!updated)throw importFailure('SERVICE_UNAVAILABLE',503);
  return {sourceId:session.id,...metadata,expiresAt:session.expires_at,preview:null,previewReasonCode:'PREVIEW_UNAVAILABLE',limits:effectiveImportLimits(limits)};
 }catch(error){if(controller.signal.aborted)throw controller.signal.reason??importFailure('IMPORT_TIMEOUT');throw error;}
 finally{clearTimeout(timer);if(slot){const q=db.rpc('release_import_slot',{p_holder:holder});await (typeof q.abortSignal==='function'?q.abortSignal(AbortSignal.timeout(2000)):q).then(()=>{},()=>{});}if(dir)await rm(dir,{recursive:true,force:true});}
}
export async function createSourceImport(db:SupabaseClient,owner:string,input:unknown,deps:ImportDependencies,limits?:MediaLimits){
 const request=selectedImport.parse(input);
 const sourceQuery=db.from('import_sources').select('metadata').eq('id',request.sourceId).eq('owner_id',owner),sourceSignal=AbortSignal.timeout(5000);const source=importDbResult<any>(await beforeDeadline((typeof sourceQuery.abortSignal==='function'?sourceQuery.abortSignal(sourceSignal):sourceQuery).maybeSingle(),sourceSignal));
 const provider=source?.metadata?.provider;if(provider!=='tiktok'&&provider!=='instagram')throw importFailure('SOURCE_NOT_FOUND',404);
 if(!deps.available(provider))throw importFailure('IMPORT_UNAVAILABLE',503);
 if(request.clip.endSeconds-request.clip.startSeconds>effectiveImportLimits(limits).maxDurationSeconds)throw importFailure('CLIP_OUT_OF_RANGE',400);
 const q=db.rpc(provider==='instagram'?'create_instagram_import':'create_tiktok_import',{p_source_id:request.sourceId,p_owner:owner,p_clip:request.clip}),signal=AbortSignal.timeout(5000);const result=await beforeDeadline<any>(typeof q.abortSignal==='function'?q.abortSignal(signal):q,signal);return importDbResult<any>(result);
}
