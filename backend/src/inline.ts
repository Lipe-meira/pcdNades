import {mkdtemp,rm,stat} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import type {SupabaseClient} from '@supabase/supabase-js';
import type {MediaLimits} from './config.js';import {downloadBounded} from './transfer.js';import {probeOriginal,MediaError} from './probe.js';
const messages:Record<string,string>={INVALID_MEDIA:'Arquivo MP4 inválido ou resolução não suportada.',UNSUPPORTED_CODEC:'Exporte MP4 com vídeo H.264/yuv420p e áudio AAC ou sem áudio.',DURATION_EXCEEDED:'O vídeo ultrapassa a duração máxima permitida.',FILE_TOO_LARGE:'O arquivo ultrapassa o tamanho permitido.',PROCESSING_TIMEOUT:'Validação interrompida por tempo limite. Se continuar em processamento, tente novamente após a recuperação.',ATTEMPTS_EXHAUSTED:'Tentativas esgotadas. Selecione o arquivo novamente.'};
export async function completeInline(db:SupabaseClient,id:string,limits:MediaLimits,dependencies={probe:probeOriginal,download:downloadBounded}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),110000);timer.unref();const signal=controller.signal;
 const table=()=>db.from('media_assets');
 async function bounded<T>(operation:PromiseLike<T>):Promise<T>{if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');return new Promise((resolve,reject)=>{const stop=()=>reject(new MediaError('PROCESSING_TIMEOUT'));signal.addEventListener('abort',stop,{once:true});Promise.resolve(operation).then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));});}
 async function checked<T>(query:PromiseLike<{data:T;error:unknown}>){const r=await bounded(query);if(r.error)throw Object.assign(new Error('MEDIA_SERVICE_UNAVAILABLE'),{statusCode:503});return r.data;}
 async function current(){const r=await checked(table().select('*').eq('id',id).maybeSingle());if(!r)throw Object.assign(new Error('NOT_FOUND'),{statusCode:404});return r;}
 let dir:string|undefined;
 try{
 let asset=await current();
 if(['ready','failed'].includes(asset.status))return {status:200,asset};
 if(asset.status==='awaiting_upload'){
 const info=await bounded(db.storage.from('videos-staging').info(asset.storage_key));if(info.error)throw Object.assign(new Error('UPLOAD_NOT_FOUND'),{statusCode:409});
 await checked(table().update({status:'queued'}).eq('id',id).eq('status','awaiting_upload').select().maybeSingle());asset=await current();
 }
 if(asset.status==='processing'&&new Date(asset.locked_until).getTime()>Date.now())return {status:202,asset};
 if(!['queued','processing'].includes(asset.status))return {status:200,asset};
 const attempts=asset.attempts;
 if(attempts>=3){const result=await checked(table().update({status:'failed',locked_until:null,stage:null,error:{code:'ATTEMPTS_EXHAUSTED',message:messages.ATTEMPTS_EXHAUSTED}}).eq('id',id).eq('status','processing').eq('attempts',attempts).lte('locked_until',new Date().toISOString()).select().maybeSingle());return {status:result?200:202,asset:result??await current()};}
 let claim=table().update({status:'processing',stage:'validating',locked_until:new Date(Date.now()+120000).toISOString(),attempts:attempts+1}).eq('id',id).eq('status',asset.status).eq('attempts',attempts);
 if(asset.status==='processing')claim=claim.lte('locked_until',new Date().toISOString());
 const claimed=await checked(claim.select().maybeSingle());if(!claimed)return {status:202,asset:await current()};
 const finish=async(values:any)=>{const r=await table().update(values).eq('id',id).eq('status','processing').eq('attempts',claimed.attempts).eq('locked_until',claimed.locked_until).gt('locked_until',new Date().toISOString()).select().abortSignal(AbortSignal.timeout(5000)).maybeSingle();if(r.error)throw Object.assign(new Error('MEDIA_SERVICE_UNAVAILABLE'),{statusCode:503});return r.data;};
 try{
 dir=await mkdtemp(join(tmpdir(),'pcdnades-inline-'));const file=join(dir,'source.mp4');
 const signed=await bounded(db.storage.from('videos-staging').createSignedUrl(claimed.storage_key,120));if(signed.error)throw new Error('STORAGE_UNAVAILABLE');
 await dependencies.download(signed.data.signedUrl,file,limits.maxBytes,signal);
 const metadata=await dependencies.probe(file,limits,signal);const bytes=(await stat(file)).size;
 if(bytes>limits.maxBytes)throw new MediaError('FILE_TOO_LARGE');if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');
 const ready=await finish({status:'ready',stage:null,error:null,locked_until:null,metadata:{...metadata,bytes}});return {status:ready?200:202,asset:ready??await current()};
 }catch(error){
 const code=signal.aborted?'PROCESSING_TIMEOUT':error instanceof MediaError?error.code:error instanceof Error&&error.message==='FILE_TOO_LARGE'?'FILE_TOO_LARGE':'INVALID_MEDIA';
 const failed=await finish({status:'failed',stage:null,locked_until:null,error:{code,message:messages[code]}});return {status:failed?200:202,asset:failed??await current()};
 }
 }finally{clearTimeout(timer);if(dir)await rm(dir,{recursive:true,force:true});}
}
