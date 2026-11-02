import {importFailure} from './import-network.js';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_SESSION_MS=15*60*1000;
export type PreviewRow={sourceId:string;ownerId:string;key:string;expiresAt:string;state:'reserved'|'ready'|'deleting';holder?:string|null;lockedUntil?:string|null};
export type PreviewPorts={
 reserve:(row:Omit<PreviewRow,'state'>)=>Promise<PreviewRow>;
 upload:(key:string,path:string)=>Promise<void>;
 ready:(sourceId:string,ownerId:string)=>Promise<boolean>;
 lookup:(sourceId:string)=>Promise<PreviewRow|null>;
 sign:(key:string,seconds:number)=>Promise<string>;
 claimExpired:(now:number)=>Promise<PreviewRow|null>;
 remove:(key:string)=>Promise<void>;
 release:(sourceId:string,holder:string)=>Promise<void>;
};
export function previewKey(sourceId:string){if(!UUID.test(sourceId))throw importFailure('PREVIEW_UNAVAILABLE',503);return `${sourceId.toLowerCase()}.mp4`;}
function valid(row:PreviewRow,sourceId:string,ownerId:string,now:number){return row.sourceId===sourceId&&row.ownerId===ownerId&&row.key===previewKey(sourceId)&&Number.isFinite(Date.parse(row.expiresAt))&&Date.parse(row.expiresAt)>now;}
export async function stageSourcePreview(ports:PreviewPorts,input:{sourceId:string;ownerId:string;expiresAt:string;path:string;now:number;enabled:boolean}){
 if(!input.enabled||!UUID.test(input.ownerId)||!Number.isFinite(input.now))throw importFailure('PREVIEW_UNAVAILABLE',503);
 const key=previewKey(input.sourceId),end=Date.parse(input.expiresAt);if(!Number.isFinite(end)||end<=input.now||end-input.now>MAX_SESSION_MS)throw importFailure('PREVIEW_UNAVAILABLE',503);
 const row=await ports.reserve({sourceId:input.sourceId,ownerId:input.ownerId,key,expiresAt:input.expiresAt});
 if(!valid(row,input.sourceId,input.ownerId,input.now)||row.state!=='reserved')throw importFailure('PREVIEW_UNAVAILABLE',503);
 // Do not remove the reservation on failure: a timed-out upload may finish later.
 await ports.upload(key,input.path);if(!await ports.ready(input.sourceId,input.ownerId))throw importFailure('PREVIEW_UNAVAILABLE',503);
}
export async function readSourcePreview(ports:PreviewPorts,input:{sourceId:string;ownerId:string;now:number;enabled:boolean}){
 if(!input.enabled||!UUID.test(input.ownerId)||!Number.isFinite(input.now))throw importFailure('PREVIEW_UNAVAILABLE',503);
 const row=await ports.lookup(input.sourceId);if(!row||row.state!=='ready'||!valid(row,input.sourceId,input.ownerId,input.now))throw importFailure('PREVIEW_UNAVAILABLE',404);
 // The SDK signing request has a real 10s transport deadline; leave an 11s margin
 // so server-relative TTL cannot extend the source session while signing is in flight.
 const seconds=Math.min(60,Math.floor((Date.parse(row.expiresAt)-input.now)/1000)-11);if(seconds<1)throw importFailure('PREVIEW_UNAVAILABLE',404);
 const url=await ports.sign(row.key,seconds);return {url,expiresAt:new Date(input.now+seconds*1000).toISOString(),mimeType:'video/mp4' as const};
}
export async function cleanupSourcePreviews(ports:PreviewPorts,now:number,max=50){
 if(!Number.isFinite(now)||!Number.isSafeInteger(max)||max<1||max>100)throw importFailure('PREVIEW_UNAVAILABLE',503);
 let removed=0;for(let i=0;i<max;i++){const row=await ports.claimExpired(now);if(!row)break;
  if(row.state!=='deleting'||!row.holder||!UUID.test(row.holder)||!row.lockedUntil||Date.parse(row.lockedUntil)<=now||row.key!==previewKey(row.sourceId)||!Number.isFinite(Date.parse(row.expiresAt))||Date.parse(row.expiresAt)+120000>now)throw importFailure('PREVIEW_UNAVAILABLE',503);
  await ports.remove(row.key);await ports.release(row.sourceId,row.holder);removed++;
 }return removed;
}

/** A dedicated bucket is essential: never list or delete from the final-media bucket. */
export async function reconcilePreviewOrphans(ports:{list:(offset:number,limit:number)=>Promise<{name:string;createdAt:string|null}[]>;lookup:(id:string)=>Promise<unknown>;remove:(key:string)=>Promise<void>},now:number){
 if(!Number.isFinite(now))throw importFailure('PREVIEW_UNAVAILABLE',503);
 const limit=100;let offset=0,removed=0;
 for(let page=0;page<10;page++){
  const items=await ports.list(offset,limit);let deleted=0;
  for(const item of items){
   if(!item.name.endsWith('.mp4'))continue;const id=item.name.slice(0,-4);
   if(!UUID.test(id)||previewKey(id)!==item.name||!item.createdAt)continue;
   const created=Date.parse(item.createdAt);if(!Number.isFinite(created)||created>now-1800000)continue;
   if(await ports.lookup(id))continue;
   await ports.remove(item.name);removed++;deleted++;
  }
  if(items.length<limit)return {removed,complete:true};
  offset+=items.length-deleted;
 }
 return {removed,complete:false};
}
