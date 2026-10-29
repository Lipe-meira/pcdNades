import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createRequire} from 'node:module';import type {MediaLimits} from './config.js';
const run=promisify(execFile);
const require=createRequire(import.meta.url);
export function probeBinaryPath(){
 if(process.platform==='linux'&&process.arch==='x64')return require.resolve('@ffprobe-installer/linux-x64/ffprobe');
 if(process.platform==='win32'&&process.arch==='x64')return require.resolve('@ffprobe-installer/win32-x64/ffprobe.exe');
 throw new Error('UNSUPPORTED_PROBE_PLATFORM');
}
export class MediaError extends Error{constructor(readonly code:string){super(code);}}
export async function probeOriginal(path:string,limits:MediaLimits,signal:AbortSignal){
 let info:any;
 try{const r=await run(probeBinaryPath(),['-v','error','-protocol_whitelist','file','-show_format','-show_streams','-of','json',path],{signal,timeout:20000,maxBuffer:1024*1024});info=JSON.parse(r.stdout);}
 catch(error){if(signal.aborted)throw new MediaError('PROCESSING_TIMEOUT');throw new MediaError('INVALID_MEDIA');}
 const video=info.streams?.filter((s:any)=>s.codec_type==='video')??[];const audio=info.streams?.filter((s:any)=>s.codec_type==='audio')??[];const duration=Number(info.format?.duration);
 if(!info.format?.format_name?.split(',').includes('mp4')||video.length!==1||!Number.isFinite(duration)||duration<=0||video[0].width<=0||video[0].height<=0||video[0].width>1920||video[0].height>1920)throw new MediaError('INVALID_MEDIA');
 if(duration>limits.maxDurationSeconds)throw new MediaError('DURATION_EXCEEDED');
 if(video[0].codec_name!=='h264'||video[0].pix_fmt!=='yuv420p'||audio.some((s:any)=>s.codec_name!=='aac')||info.streams.some((s:any)=>!['video','audio'].includes(s.codec_type)))throw new MediaError('UNSUPPORTED_CODEC');
 return {durationSeconds:duration,width:video[0].width,height:video[0].height,mimeType:'video/mp4'};
}
