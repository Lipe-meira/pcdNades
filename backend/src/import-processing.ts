import {randomUUID} from 'node:crypto';import {mkdtemp,rm,stat} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import type {SupabaseClient} from '@supabase/supabase-js';import type {MediaLimits} from './config.js';
import {importSection,tikTokRuntimeAvailable} from './import-runtime.js';import {storeClip} from './clip-storage.js';
import {importFailure} from './import-network.js';import {sourceMetadata,checkImportSelection} from './tiktok.js';
type Dependencies={available:()=>boolean;process:typeof importSection;store:typeof storeClip};
let active=false;
export async function completeImport(db:SupabaseClient,id:string,limits:MediaLimits,deps:Dependencies={available:tikTokRuntimeAvailable,process:importSection,store:storeClip}){
 const controller=new AbortController(),signal=controller.signal;const timer=setTimeout(()=>controller.abort(importFailure('IMPORT_TIMEOUT')),110000);timer.unref();
 const holder=randomUUID();let slot=false,local=false,dir:string|undefined;
 const checked=async(query:any)=>{const result=await (typeof query.abortSignal==='function'?query.abortSignal(signal):query);if(result.error)throw importFailure('SERVICE_UNAVAILABLE',503);return result.data;};
 const table=()=>db.from('media_assets');
 const current=async()=>{const row=await checked(table().select('*').eq('id',id).maybeSingle());if(!row)throw importFailure('NOT_FOUND',404);return row;};
 try{
  const asset=await current();if(['ready','failed'].includes(asset.status))return {status:200,asset};
  if(asset.source_type!=='tiktok'||!asset.import_source_id||!asset.import_snapshot)throw importFailure('SOURCE_UNSUPPORTED');
  if(asset.status==='processing'&&new Date(asset.locked_until).getTime()>Date.now())return {status:202,asset};
  if(!['queued','processing'].includes(asset.status))throw importFailure('MEDIA_STATE_CONFLICT',409);
  if(asset.attempts>=2){const failed=await checked(table().update({status:'failed',stage:null,locked_until:null,error:{code:'ATTEMPTS_EXHAUSTED',message:'Tentativas esgotadas. Inspecione o link novamente.'}}).eq('id',id).eq('status','processing').eq('attempts',asset.attempts).lte('locked_until',new Date().toISOString()).select().maybeSingle());return {status:failed?200:202,asset:failed??await current()};}
  if(!deps.available())throw importFailure('IMPORT_UNAVAILABLE',503);
  const snapshot=asset.import_snapshot;
  const source=sourceMetadata({webpage_url:snapshot.sourceUrl,id:snapshot.videoId,title:snapshot.title,uploader:snapshot.author,duration:snapshot.durationSeconds});
  if(checkImportSelection(asset.clip,source.durationSeconds)>limits.maxDurationSeconds)throw importFailure('CLIP_OUT_OF_RANGE',400);
  if(active)throw importFailure('PROCESSOR_BUSY',503);active=true;local=true;
  if(!await checked(db.rpc('claim_import_slot',{p_holder:holder,p_seconds:120})))throw importFailure('PROCESSOR_BUSY',503);slot=true;
  let query=table().update({status:'processing',stage:'resolving',attempts:asset.attempts+1,locked_until:new Date(Date.now()+120000).toISOString()}).eq('id',id).eq('status',asset.status).eq('attempts',asset.attempts);
  if(asset.status==='processing')query=query.lte('locked_until',new Date().toISOString());
  const claimed=await checked(query.select().maybeSingle());if(!claimed)return {status:202,asset:await current()};
  const finish=async(values:any)=>{const r=await table().update(values).eq('id',id).eq('status','processing').eq('attempts',claimed.attempts).eq('locked_until',claimed.locked_until).gt('locked_until',new Date().toISOString()).select().abortSignal(AbortSignal.timeout(5000)).maybeSingle();if(r.error)throw importFailure('SERVICE_UNAVAILABLE',503);return r.data;};
  const stage=async(value:string)=>{const row=await checked(table().update({stage:value}).eq('id',id).eq('status','processing').eq('attempts',claimed.attempts).eq('locked_until',claimed.locked_until).gt('locked_until',new Date().toISOString()).select().maybeSingle());if(!row)throw importFailure('CLAIM_LOST',409);};
  try{
   dir=await mkdtemp(join(tmpdir(),'pcdnades-import-'));const file=join(dir,'clip.mp4');
   const metadata=await deps.process(source,asset.clip,file,dir,limits,controller,stage);
   const bytes=(await stat(file)).size;if(bytes<=0||bytes>limits.maxBytes)throw importFailure('FILE_TOO_LARGE');
   if(signal.aborted)throw importFailure('IMPORT_TIMEOUT');
   await stage('storing');const key=`${id}/import-${claimed.attempts}.mp4`;
   await deps.store(db,key,file,signal);if(signal.aborted)throw importFailure('IMPORT_TIMEOUT');
   const ready=await finish({status:'ready',stage:null,error:null,locked_until:null,storage_key:key,metadata:{...metadata,bytes,sourceId:claimed.import_source_id,provenance:source}});
   return {status:ready?200:202,asset:ready??await current()};
  }catch(error){
   const candidate=error instanceof Error&&'code'in error?String(error.code):'';
   const codes=['IMPORT_NETWORK_LIMIT','IMPORT_DESTINATION_DENIED','IMPORT_ACCESS_DENIED','IMPORT_RANGE_UNSUPPORTED','IMPORT_RANGE_REQUIRED','IMPORT_REDIRECT_LIMIT','IMPORT_TIMEOUT','SOURCE_CHANGED','SOURCE_UNSUPPORTED','FILE_TOO_LARGE','INVALID_MEDIA','DURATION_EXCEEDED','UNSUPPORTED_CODEC','PROCESSING_TIMEOUT'];
   const abortCode=signal.reason&&typeof signal.reason==='object'&&'code'in signal.reason?String(signal.reason.code):'IMPORT_TIMEOUT';
   const code=signal.aborted?(codes.includes(abortCode)?abortCode:'IMPORT_TIMEOUT'):codes.includes(candidate)?candidate:'IMPORT_FAILED';
   const failed=await finish({status:'failed',stage:null,locked_until:null,error:{code,message:code==='IMPORT_ACCESS_DENIED'?'A plataforma recusou o download. Envie um arquivo MP4 autorizado.':'Não foi possível importar este trecho dentro dos limites. Inspecione o link novamente ou envie um MP4.'}});
   return {status:failed?200:202,asset:failed??await current()};
  }
 }finally{
  clearTimeout(timer);if(local)active=false;
  if(slot){const q=db.rpc('release_import_slot',{p_holder:holder});await (typeof q.abortSignal==='function'?q.abortSignal(AbortSignal.timeout(2000)):q).then(()=>{},()=>{});}
  if(dir)await rm(dir,{recursive:true,force:true});
 }
}
