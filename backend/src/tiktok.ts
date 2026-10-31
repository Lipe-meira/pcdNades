import {z} from 'zod';
import {recognizeSource,type Clip} from './importers.js';
import {importFailure} from './import-network.js';
import {readMediaLimits,type MediaLimits} from './config.js';
export const importLimits=Object.freeze({maxSourceDurationSeconds:7200,maxSourceBytes:50000000,maxDurationSeconds:30,maxBytes:50000000,minDurationSeconds:0.1,timePrecisionSeconds:0.001});
// The deployed policy may be lower than the protocol ceiling (e.g. 20s).
export function effectiveImportLimits(limits:MediaLimits=readMediaLimits()){
 return Object.freeze({...importLimits,maxDurationSeconds:Math.min(importLimits.maxDurationSeconds,limits.maxDurationSeconds),maxBytes:Math.min(importLimits.maxBytes,limits.maxBytes)});
}
export const importClipSchema=z.object({startSeconds:z.number().finite().min(0),endSeconds:z.number().finite().max(7200)}).strict().refine(c=>c.endSeconds-c.startSeconds>=0.1-1e-8&&c.endSeconds-c.startSeconds<=90&&[c.startSeconds,c.endSeconds].every(n=>Math.abs(n*1000-Math.round(n*1000))<1e-6));
export const inspectRequest=z.object({sourceUrl:z.string().min(1).max(2048)}).strict();
export const selectedImport=z.object({sourceId:z.uuid(),clip:importClipSchema}).strict();
export function checkImportSelection(clip:Clip,duration:number){if(!importClipSchema.safeParse(clip).success||!Number.isFinite(duration)||duration<=0||duration>7200||clip.endSeconds>duration)throw importFailure('CLIP_OUT_OF_RANGE',400);return clip.endSeconds-clip.startSeconds;}
export function sourceMetadata(raw:any){
 if(!raw||raw._type==='playlist'||raw.entries||raw.is_live||['is_live','is_upcoming','post_live'].includes(raw.live_status))throw importFailure('SOURCE_UNSUPPORTED');
 const duration=raw.duration;if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0)throw importFailure('SOURCE_UNSUPPORTED');if(duration>7200)throw importFailure('SOURCE_TOO_LONG');
 const source=recognizeSource(raw.webpage_url);if(source.provider!=='tiktok'||source.shortLink||source.videoId!==raw.id)throw importFailure('SOURCE_UNSUPPORTED');
 const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
 return {provider:'tiktok' as const,sourceUrl:source.canonicalUrl,videoId:source.videoId,title:text(raw.title,300)||'Vídeo TikTok',author:text(raw.uploader??raw.creator,120)||null,durationSeconds:duration};
}
