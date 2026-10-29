import {readFile} from 'node:fs/promises';import type {SupabaseClient} from '@supabase/supabase-js';import {MediaError} from './probe.js';
export async function storeClip(db:SupabaseClient,key:string,path:string,signal:AbortSignal){
 const session=await db.storage.from('videos-staging').createSignedUploadUrl(key,{upsert:false});if(session.error)throw new MediaError('STORAGE_UNAVAILABLE');
 const bytes=await readFile(path);signal.throwIfAborted();
 const response=await fetch(session.data.signedUrl,{method:'PUT',headers:{'content-type':'video/mp4','x-upsert':'false'},body:new Uint8Array(bytes),signal,redirect:'error'});
 await response.body?.cancel();if(!response.ok)throw new MediaError('STORAGE_UNAVAILABLE');
}
