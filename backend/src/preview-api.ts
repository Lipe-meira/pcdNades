import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {importFailure} from './import-network.js';
import {getImportPreview,stageImportPreview,sourcePreviewAvailable,supabasePreviewPorts} from './source-preview-supabase.js';
import {preparePreviewSource,tikTokRuntimeAvailable,instagramRuntimeAvailable} from './import-runtime.js';
export async function sourcePreview(db:SupabaseClient,sourceId:string,ownerId:string,prepare:boolean){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);timer.unref();const signal=controller.signal,origin=process.env.SUPABASE_URL!;let dir:string|undefined,holder:string|undefined;
 const checked=(r:any)=>{if(r.error)throw importFailure('PREVIEW_UNAVAILABLE',503);return r.data;};
 try{
  const session=checked(await db.from('import_sources').select('*').eq('id',sourceId).eq('owner_id',ownerId).abortSignal(signal).maybeSingle());
  if(!session?.metadata)throw importFailure('SOURCE_NOT_FOUND',404);
  const expires=Date.parse(session.expires_at);if(!Number.isFinite(expires))throw importFailure('PREVIEW_UNAVAILABLE',503);if(expires<=Date.now())throw importFailure('SOURCE_EXPIRED',410);
  if(session.metadata.provider==='instagram'?!instagramRuntimeAvailable():session.metadata.provider==='tiktok'?!tikTokRuntimeAvailable():true)throw importFailure('PREVIEW_UNAVAILABLE',503);
  if(!await sourcePreviewAvailable(db))throw importFailure('PREVIEW_UNAVAILABLE',503);
  const ports=supabasePreviewPorts(db,origin,signal),existing=await ports.lookup(sourceId);
  const ready=async()=>({sourceId,status:'ready',...await getImportPreview(db,{sourceId,ownerId,signal,origin}),sourceExpiresAt:session.expires_at});
  if(existing?.ownerId===ownerId&&existing.state==='ready')return await ready();
  if(!prepare)throw importFailure('PREVIEW_UNAVAILABLE',404);
  if(existing)throw importFailure('PREVIEW_UNAVAILABLE',503);
  const candidate=randomUUID();if(!checked(await db.rpc('claim_import_slot',{p_holder:candidate,p_seconds:120}).abortSignal(signal)))throw importFailure('PROCESSOR_BUSY',503);holder=candidate;
  const rechecked=await ports.lookup(sourceId);if(rechecked?.ownerId===ownerId&&rechecked.state==='ready')return await ready();if(rechecked)throw importFailure('PREVIEW_UNAVAILABLE',503);
  dir=await mkdtemp(join(tmpdir(),'pcdnades-source-preview-'));
  const localSource=await preparePreviewSource(session.metadata,controller,dir);
  if(!await stageImportPreview(db,{sourceId,ownerId,expiresAt:session.expires_at,localSource,signal,origin}))throw importFailure('PREVIEW_UNAVAILABLE',503);
  return await ready();
 }finally{clearTimeout(timer);try{if(holder)await db.rpc('release_import_slot',{p_holder:holder}).abortSignal(AbortSignal.timeout(2000));}finally{if(dir)await rm(dir,{recursive:true,force:true});}}
}
