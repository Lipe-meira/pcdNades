import {readFile} from 'node:fs/promises';
import type {SupabaseClient} from '@supabase/supabase-js';
import {MediaError} from './probe.js';

// The SDK signing/removal methods expose no AbortSignal. Stop awaiting their
// response on cancellation; a late signing response never starts an upload.
function storageOperation<T>(operation:()=>PromiseLike<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const aborted=()=>{signal.removeEventListener('abort',aborted);reject(new MediaError('PROCESSING_TIMEOUT'));};
  if(signal.aborted){aborted();return;}
  signal.addEventListener('abort',aborted,{once:true});
  Promise.resolve().then(()=>{if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');return operation();}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',aborted));
 });
}

export async function storeClip(db:SupabaseClient,key:string,path:string,signal:AbortSignal){
 try{
  const session=await storageOperation(()=>db.storage.from('videos-staging').createSignedUploadUrl(key,{upsert:false}),signal);
  if(session.error||!session.data)throw new MediaError('STORAGE_UNAVAILABLE');
  const bytes=await readFile(path,{signal});signal.throwIfAborted();
  const response=await fetch(session.data.signedUrl,{method:'PUT',headers:{'content-type':'video/mp4','x-upsert':'false'},body:new Uint8Array(bytes),signal,redirect:'error'});
  await response.body?.cancel();if(!response.ok)throw new MediaError('STORAGE_UNAVAILABLE');
 }catch{throw new MediaError(signal.aborted?'PROCESSING_TIMEOUT':'STORAGE_UNAVAILABLE');}
}

// Only call after a fenced failed transition confirms this attempt is no
// longer publishable. Never delete by prefix or remove an existing media key.
export async function removeClip(db:SupabaseClient,key:string,signal:AbortSignal){
 const result=await storageOperation(()=>db.storage.from('videos-staging').remove([key]),signal);
 if(result.error)throw new MediaError('STORAGE_UNAVAILABLE');
}
