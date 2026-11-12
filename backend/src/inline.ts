import {storeClip,clipOutputKey} from './clip-storage.js';
import { trimVideo, sourceLimits, decodeVideoOutcome } from './trimming.js';
import {contributorError} from './contributor-errors.js';import {clipSchema} from './importers.js';
import {readTrimmingEnabled} from './config.js';
import {mkdtemp,rm,stat} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import type {SupabaseClient} from '@supabase/supabase-js';
import type {MediaLimits} from './config.js';import {downloadBounded} from './transfer.js';import {probeOriginal,MediaError} from './probe.js';
let activeTrim=false;
class AdoptionUnavailable extends Error{constructor(){super('ADOPTION_UNAVAILABLE');}}
const isObjectNotFound=(e:unknown)=>{const x=e as {message?:unknown;statusCode?:unknown;status?:unknown}|null;return String(x?.statusCode??x?.status)==='404'||/not.?found/i.test(String(x?.message??''));};
const messages:Record<string,string>={INVALID_MEDIA:'Arquivo MP4 inválido ou resolução não suportada.',UNSUPPORTED_CODEC:'Exporte MP4 com vídeo H.264/yuv420p e áudio AAC ou sem áudio.',DURATION_EXCEEDED:'O vídeo ultrapassa a duração máxima permitida.',FILE_TOO_LARGE:'O arquivo ultrapassa o tamanho permitido.',PROCESSING_TIMEOUT:'Validação interrompida por tempo limite. Se continuar em processamento, tente novamente após a recuperação.',CLIP_OUT_OF_RANGE:'O intervalo está fora da duração da fonte ou do limite final.',CLIP_PROCESSING_FAILED:'Não foi possível gerar um trecho íntegro. Selecione outro intervalo.',SOURCE_DURATION_EXCEEDED:'A fonte para recorte deve ter até 180 segundos.',STORAGE_UNAVAILABLE:'Não foi possível armazenar o trecho. Tente uma nova seleção.',ATTEMPTS_EXHAUSTED:'Tentativas esgotadas. Selecione o arquivo novamente.',STORED_CLIP_INVALID:'O trecho gravado em uma tentativa anterior não passou na verificação. Selecione o arquivo novamente.'};
export async function completeInline(db:SupabaseClient,id:string,limits:MediaLimits,dependencies:{probe:typeof probeOriginal;download:typeof downloadBounded;trim?:typeof trimVideo;store?:typeof storeClip;decode?:typeof decodeVideoOutcome}={probe:probeOriginal,download:downloadBounded,trim:trimVideo,store:storeClip}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),110000);timer.unref();const signal=controller.signal;
 const table=()=>db.from('media_assets');
 async function bounded<T>(operation:PromiseLike<T>):Promise<T>{if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');return new Promise((resolve,reject)=>{const stop=()=>reject(new MediaError('PROCESSING_TIMEOUT'));signal.addEventListener('abort',stop,{once:true});Promise.resolve(operation).then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));});}
 async function checked<T>(query:PromiseLike<{data:T;error:unknown}>){const r=await bounded(query);if(r.error){const known=contributorError((r.error as any).message);if(known)throw Object.assign(new Error(known.code),{statusCode:known.status,code:known.code});throw Object.assign(new Error('MEDIA_SERVICE_UNAVAILABLE'),{statusCode:503});}return r.data;}
 async function current(){const r=await checked(table().select('*').eq('id',id).maybeSingle());if(!r)throw Object.assign(new Error('NOT_FOUND'),{statusCode:404});return r;}
 let dir:string|undefined;let trimSlot=false;let adopting=false;
 // Verifica o objeto já existente como se fosse uma saída nova: baixa com limite, valida contêiner/codec/duração e mede os bytes REAIS.
 // Só CONTEÚDO comprovadamente inválido vira STORED_CLIP_INVALID (terminal). Falha de infraestrutura (assinar, baixar, decodificar sem
 // conclusão, prazo) lança AdoptionUnavailable: nada é gravado, a linha segue `processing` e o lease/limite de tentativas governam a retomada.
 async function adoptStoredClip(key:string,file:string,clip:{startSeconds:number;endSeconds:number}){
  let signed;try{signed=await bounded(db.storage.from('videos-staging').createSignedUrl(key,120));}catch{throw new AdoptionUnavailable();}
  if(signed.error||!signed.data)throw new AdoptionUnavailable();
  try{await dependencies.download(signed.data.signedUrl,file,limits.maxBytes,signal);}catch(error){if(!signal.aborted&&error instanceof Error&&error.message==='FILE_TOO_LARGE')throw new MediaError('STORED_CLIP_INVALID');throw new AdoptionUnavailable();}
  let probed;try{probed=await dependencies.probe(file,limits,signal);}catch(error){if(error instanceof MediaError&&error.code==='PROCESSING_TIMEOUT')throw new AdoptionUnavailable();throw new MediaError('STORED_CLIP_INVALID');}
  if(Math.abs(probed.durationSeconds-(clip.endSeconds-clip.startSeconds))>0.1)throw new MediaError('STORED_CLIP_INVALID');
  // Mesma decodificação integral e limitada do corte novo, agora sobre o arquivo BAIXADO do Storage (probe só lê o contêiner: um MP4 truncado passa).
  const decoded=await (dependencies.decode??decodeVideoOutcome)(file,signal);
  if(decoded==='transient')throw new AdoptionUnavailable();if(decoded==='invalid')throw new MediaError('STORED_CLIP_INVALID');
  return {metadata:probed,bytes:(await stat(file)).size};
 }
 try{
 let asset=await current();
 if(['ready','failed'].includes(asset.status))return {status:200,asset};
 const clip=asset.clip?clipSchema.parse(asset.clip):null;
 if(clip&&!readTrimmingEnabled())throw Object.assign(new Error('CLIP_UNSUPPORTED'),{statusCode:422,code:'CLIP_UNSUPPORTED'});
 if(asset.status==='awaiting_upload'){
 const info=await bounded(db.storage.from('videos-staging').info(asset.storage_key));if(info.error)throw Object.assign(new Error('UPLOAD_NOT_FOUND'),{statusCode:409});
 await checked(table().update({status:'queued'}).eq('id',id).eq('status','awaiting_upload').select().maybeSingle());asset=await current();
 }
 if(asset.status==='processing'&&new Date(asset.locked_until).getTime()>Date.now())return {status:202,asset};
 if(!['queued','processing'].includes(asset.status))return {status:200,asset};
 if(clip){if(activeTrim)throw Object.assign(new Error('PROCESSOR_BUSY'),{statusCode:503,code:'PROCESSOR_BUSY'});activeTrim=true;trimSlot=true;}
 const attempts=asset.attempts;
 if(attempts>=3){const result=await checked(table().update({status:'failed',locked_until:null,stage:null,error:{code:'ATTEMPTS_EXHAUSTED',message:messages.ATTEMPTS_EXHAUSTED}}).eq('id',id).eq('status','processing').eq('attempts',attempts).lte('locked_until',new Date().toISOString()).select().maybeSingle());return {status:result?200:202,asset:result??await current()};}
 let claim=table().update({status:'processing',stage:'validating',locked_until:new Date(Date.now()+120000).toISOString(),attempts:attempts+1}).eq('id',id).eq('status',asset.status).eq('attempts',attempts);
 if(asset.status==='processing')claim=claim.lte('locked_until',new Date().toISOString());
 const claimed=await checked(claim.select().maybeSingle());if(!claimed)return {status:202,asset:await current()};
 const finish=async(values:any)=>{const r=await table().update(values).eq('id',id).eq('status','processing').eq('attempts',claimed.attempts).eq('locked_until',claimed.locked_until).gt('locked_until',new Date().toISOString()).select().abortSignal(AbortSignal.timeout(5000)).maybeSingle();if(r.error)throw Object.assign(new Error('MEDIA_SERVICE_UNAVAILABLE'),{statusCode:503});return r.data;};
 try{
 dir=await mkdtemp(join(tmpdir(),'pcdnades-inline-'));const file=join(dir,'source.mp4');
 const signed=await bounded(db.storage.from('videos-staging').createSignedUrl(claimed.storage_key,120));if(signed.error)throw new Error('STORAGE_UNAVAILABLE');
 await dependencies.download(signed.data.signedUrl,file,clip?sourceLimits.maxBytes:limits.maxBytes,signal);
 let playbackFile=file;let playbackKey=claimed.storage_key;let metadata:any;let bytes:number;let sourceBytes:number|undefined;
 const stage=async(value:string)=>{const r=await checked(table().update({stage:value}).eq('id',id).eq('status','processing').eq('attempts',claimed.attempts).eq('locked_until',claimed.locked_until).gt('locked_until',new Date().toISOString()).select().maybeSingle());if(!r)throw new MediaError('CLAIM_LOST');};
 if(clip){
  sourceBytes=(await stat(file)).size; // a fonte original continua no Storage: o orçamento de bytes de contribuidores conta fonte + trecho
  await stage('trimming');playbackFile=join(dir,'clip.mp4');
  metadata=await (dependencies.trim??trimVideo)(file,playbackFile,clip,limits,signal);bytes=(await stat(playbackFile)).size;if(bytes>limits.maxBytes)throw new MediaError('FILE_TOO_LARGE');
  if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');
  await stage('storing');playbackKey=clipOutputKey(id);
  // A chave NÃO depende da tentativa: só pode existir um corte por mídia (fonte + um trecho = a reserva cobrada). Se uma tentativa
  // anterior já gravou o objeto (lease perdido, resposta perdida), ele é verificado e adotado; nunca sobrescrito nem apagado.
  try{await bounded((dependencies.store??storeClip)(db,playbackKey,playbackFile,signal));}
  catch(error){
   if(signal.aborted)throw error;
   adopting=true;
   // Só "objeto inexistente" prova que a falha foi da gravação (terminal, como antes). Qualquer outra resposta do info é ambígua: recuperável.
   let present;try{present=await bounded(db.storage.from('videos-staging').info(playbackKey));}catch{throw new AdoptionUnavailable();}
   if(present.error){if(isObjectNotFound(present.error))throw error;throw new AdoptionUnavailable();}
   if(!present.data)throw error;
   const adopted=await adoptStoredClip(playbackKey,join(dir,'stored.mp4'),clip!);
   metadata={...metadata,...adopted.metadata};bytes=adopted.bytes;
   console.info(JSON.stringify({event:'clip_output_adopted',mediaId:id,attempt:claimed.attempts}));
  }
 }else{metadata=await dependencies.probe(file,limits,signal);bytes=(await stat(file)).size;}
 if(bytes>limits.maxBytes)throw new MediaError('FILE_TOO_LARGE');if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');
 const ready=await finish({status:'ready',stage:null,error:null,locked_until:null,storage_key:playbackKey,metadata:{...metadata,bytes,...(sourceBytes!==undefined?{sourceBytes}:{})}});return {status:ready?200:202,asset:ready??await current()};
 }catch(error){
 // Falha temporária na recuperação por adoção: sem `failed`, sem tocar na linha nem no objeto. A tentativa antiga não altera a nova, a reserva
 // fica retida e a próxima `complete` retoma depois do lease (cada retomada consome uma das 3 tentativas; ao esgotar, ATTEMPTS_EXHAUSTED).
 if(error instanceof AdoptionUnavailable||(adopting&&signal.aborted))throw Object.assign(new Error('STORAGE_UNAVAILABLE'),{statusCode:503,code:'STORAGE_UNAVAILABLE'});
 const code=signal.aborted?'PROCESSING_TIMEOUT':error instanceof MediaError?error.code:error instanceof Error&&error.message==='FILE_TOO_LARGE'?'FILE_TOO_LARGE':'INVALID_MEDIA';
 const failed=await finish({status:'failed',stage:null,locked_until:null,error:{code,message:messages[code]??'Não foi possível finalizar o vídeo. Seu cadastro anterior foi preservado.'}});return {status:failed?200:202,asset:failed??await current()};
 }
 }finally{clearTimeout(timer);if(trimSlot)activeTrim=false;if(dir)await rm(dir,{recursive:true,force:true});}
}
