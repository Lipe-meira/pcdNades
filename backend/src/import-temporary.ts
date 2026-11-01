import type {Clip} from './importers.js';
import {checkImportSelection} from './tiktok.js';
import {importFailure,type ImportDiagnostic} from './import-network.js';
export function readDownloadMode(env:Record<string,string|undefined>=process.env){
 const mode=env.MEDIA_TIKTOK_DOWNLOAD_MODE??'range';
 if(mode!=='range'&&mode!=='temporary')throw new Error('MEDIA_TIKTOK_DOWNLOAD_MODE deve ser range ou temporary.');
 return mode;
}
export function temporaryDownloadArgs(info:string,output:string,proxy:string){
 return ['--ignore-config','--no-config-locations','--no-plugin-dirs','--no-js-runtimes','--no-remote-components','--no-update','--no-cache-dir','--no-playlist','--no-warnings','--no-progress','--quiet','--no-simulate','--downloader','native','--fixup','never','--no-part','--no-continue','--max-filesize','50000000','--retries','0','--fragment-retries','0','--extractor-retries','0','--socket-timeout','8','--proxy',proxy,'--load-info-json',info,'--output',output];
}
export function temporarySessionArgs(extractor:string[],formatId:string,output:string){
 if(!/^[a-zA-Z0-9_.-]{1,96}$/.test(formatId))throw importFailure('SOURCE_UNSUPPORTED');
 const args=extractor.filter(x=>!['--skip-download','--dump-single-json'].includes(x));
 const format=args.indexOf('--format'),separator=args.indexOf('--');
 if(format<0||separator<0)throw importFailure('SOURCE_UNSUPPORTED');
 args[format+1]=formatId;const tail=args.splice(separator);
 args.push('--downloader','native','--fixup','never','--no-part','--no-continue','--max-filesize','50000000','--quiet','--print','after_move:%(id)s','--no-simulate','--output',output,...tail);
 return args;
}
export function validateTemporarySource(info:any,duration:number,format:{width:number;height:number;videoCodec:string}){
 const streams=Array.isArray(info?.streams)?info.streams:[],video=streams.filter((s:any)=>s.codec_type==='video'),audio=streams.filter((s:any)=>s.codec_type==='audio');
 const actual=Number(info?.format?.duration),expected=/^(h265|hevc|hev1)/i.test(format.videoCodec)?'hevc':'h264';
 if(!info?.format?.format_name?.split(',').includes('mp4')||!Number.isFinite(actual)||actual<=0||actual>7200||video.length!==1||audio.length>1||streams.some((s:any)=>!['video','audio'].includes(s.codec_type))||audio.some((s:any)=>s.codec_name!=='aac'))throw importFailure('INVALID_MEDIA');
 if(Math.abs(actual-duration)>1||video[0].width!==format.width||video[0].height!==format.height||video[0].codec_name!==expected)throw importFailure('SOURCE_CHANGED',409);
}
export function encodeTemporaryArgs(input:string,output:string,clip:Clip,maxBytes:number){
 checkImportSelection(clip,7200);
 return ['-nostdin','-v','error','-xerror','-err_detect','explode','-protocol_whitelist','file','-format_whitelist','mov','-f','mov','-enable_drefs','0','-use_absolute_path','0','-ss',String(clip.startSeconds),'-threads','1','-i',input,'-t',String(clip.endSeconds-clip.startSeconds),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='if(gte(iw,ih),min(iw,1920),min(iw,1080))':h='if(gte(iw,ih),min(ih,1080),min(ih,1920))':force_original_aspect_ratio=decrease:force_divisible_by=2",'-fpsmax','30','-c:v','libx264','-preset','superfast','-crf','23','-threads','1','-filter_threads','1','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-fs',String(maxBytes+1048576),output];
}
export function processFailure(error:unknown,controller:AbortController,stage:ImportDiagnostic['stage']){
 const e=error as {killed?:boolean;code?:string;stderr?:string;statusCode?:number};
 if(controller.signal.aborted&&controller.signal.reason?.code==='FILE_TOO_LARGE')return importFailure('FILE_TOO_LARGE');
 if(controller.signal.aborted||e?.killed||e?.code==='ETIMEDOUT'||e?.code==='ABORT_ERR')return importFailure('IMPORT_TIMEOUT',422,{stage});
 if(e?.statusCode&&e?.code)return error as ReturnType<typeof importFailure>;
 if(e?.code&&['INVALID_MEDIA','UNSUPPORTED_CODEC','DURATION_EXCEEDED','PROCESSING_TIMEOUT','FILE_TOO_LARGE'].includes(e.code))return importFailure(e.code);
 const status=Number(e?.stderr?.match(/HTTP(?: Error| error)?[ :]+(\d{3})/i)?.[1]);
 return importFailure(status===401||status===403?'IMPORT_ACCESS_DENIED':status?'IMPORT_HTTP_ERROR':'IMPORT_FAILED',422,{stage,...(status?{httpStatus:status}:{})});
}
