import {recognizeSource} from './importers.js';
import {importFailure,allowedImportHost} from './import-network.js';
export function instagramMetadata(raw:any,probedDuration:number){
 if(!raw||raw._type==='playlist'||raw.entries||raw.is_live||['is_live','is_upcoming','post_live'].includes(raw.live_status))throw importFailure('SOURCE_UNSUPPORTED');
 if(typeof probedDuration!=='number'||!Number.isFinite(probedDuration)||probedDuration<=0)throw importFailure('SOURCE_UNSUPPORTED');
 if(probedDuration>7200)throw importFailure('SOURCE_TOO_LONG');
 const source=recognizeSource(raw.webpage_url);if(source.provider!=='instagram'||source.videoId!==raw.id)throw importFailure('SOURCE_UNSUPPORTED');
 const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
 return {provider:'instagram' as const,sourceUrl:source.canonicalUrl,videoId:source.videoId,title:text(raw.title,300)||'Vídeo Instagram',author:text(raw.uploader??raw.creator,120)||null,durationSeconds:probedDuration};
}
export function instagramArgs(url:string,proxy:string){
 const source=recognizeSource(url);if(source.provider!=='instagram')throw importFailure('SOURCE_UNSUPPORTED');
 return ['--ignore-config','--no-config-locations','--no-plugin-dirs','--no-js-runtimes','--no-remote-components','--no-update','--no-cache-dir','--no-playlist','--skip-download','--format','best[ext=mp4]/best','--dump-single-json','--no-warnings','--no-progress','--use-extractors','^instagram$','--retries','0','--fragment-retries','0','--extractor-retries','0','--socket-timeout','8','--proxy',proxy,'--',source.canonicalUrl];
}
export function validateInstagramProbe(info:any){
 const streams=Array.isArray(info?.streams)?info.streams:[],video=streams.filter((s:any)=>s.codec_type==='video'),audio=streams.filter((s:any)=>s.codec_type==='audio');const duration=Number(info?.format?.duration);
 if(!info?.format?.format_name?.split(',').includes('mp4')||!Number.isFinite(duration)||duration<=0||duration>7200||video.length!==1||audio.length>1||streams.some((s:any)=>!['video','audio'].includes(s.codec_type))||audio.some((s:any)=>s.codec_name!=='aac')||!['h264','hevc'].includes(video[0]?.codec_name)||![video[0]?.width,video[0]?.height].every((n:any)=>Number.isSafeInteger(n)&&n>0&&n<=1920))throw importFailure('INVALID_MEDIA');
 return duration;
}
export function instagramFormat(raw:any){
 if(!raw||raw.has_drm||raw.protocol!=='https'||raw.ext!=='mp4'||typeof raw.format_id!=='string'||!/^[a-zA-Z0-9_.-]{1,96}$/.test(raw.format_id)||typeof raw.url!=='string')throw importFailure('SOURCE_UNSUPPORTED');
 let u:URL;try{u=new URL(raw.url);}catch{throw importFailure('SOURCE_UNSUPPORTED');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!allowedImportHost(u.hostname,'instagram')||['instagram.com','www.instagram.com','m.instagram.com'].includes(u.hostname))throw importFailure('SOURCE_UNSUPPORTED');
 if(typeof raw.filesize==='number'&&raw.filesize>50000000)throw importFailure('FILE_TOO_LARGE');
 return raw.format_id as string;
}


/** Probe only the downloaded MP4; do not follow external data references. */
export function instagramProbeArgs(input:string){
 return ['-v','error','-protocol_whitelist','file','-format_whitelist','mov','-enable_drefs','0','-use_absolute_path','0','-show_format','-show_streams','-of','json',input];
}
