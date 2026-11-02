import {guardImportFile} from './import-file-limit.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {accessSync,constants,readFileSync,statSync} from 'node:fs';
import {recognizeSource,type Clip} from './importers.js';
import {importFailure,allowedImportHost,safeHeaders,startMetadataProxy,startMediaRelay,TransferBudget} from './import-network.js';
import {sourceMetadata,checkImportSelection} from './tiktok.js';
import {instagramArgs,instagramFormat,instagramMetadata,validateInstagramProbe,instagramProbeArgs} from './instagram.js';
import {ffmpegBinaryPath,decodeVideo} from './trimming.js';
import {probeOriginal,probeBinaryPath} from './probe.js';
import {join} from 'node:path';
import {readDownloadMode,temporarySessionArgs,validateTemporarySource,encodeTemporaryArgs,processFailure} from './import-temporary.js';
import type {MediaLimits} from './config.js';
const require=createRequire(import.meta.url),run=promisify(execFile);
export const ytDlpVersion='2026.08.19';
const digests={linux:'58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a',win32:'66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a'};
export function ytDlpPath(){if(process.arch!=='x64')throw importFailure('IMPORT_UNAVAILABLE',503);if(process.platform==='linux')return require.resolve('../vendor/yt-dlp_linux');if(process.platform==='win32')return require.resolve('../vendor/yt-dlp.exe');throw importFailure('IMPORT_UNAVAILABLE',503);}
export function readTikTokEnabled(env:Record<string,string|undefined>=process.env){const v=env.MEDIA_TIKTOK_IMPORT_ENABLED;if(v===undefined||v==='false')return false;if(v==='true')return true;throw new Error('MEDIA_TIKTOK_IMPORT_ENABLED deve ser true ou false.');}
let verifiedRuntime:{path:string;mtime:number;size:number;valid:boolean}|undefined;
export function readInstagramEnabled(env:Record<string,string|undefined>=process.env){const v=env.MEDIA_INSTAGRAM_IMPORT_ENABLED;if(v===undefined||v==='false')return false;if(v==='true')return true;throw new Error('MEDIA_INSTAGRAM_IMPORT_ENABLED deve ser true ou false.');}
export function tikTokRuntimeAvailable(){try{
 if(!readTikTokEnabled())return false;readDownloadMode();return trustedBinaryAvailable();}catch{return false;}}
export function instagramRuntimeAvailable(){try{return readInstagramEnabled()&&trustedBinaryAvailable();}catch{return false;}}
function trustedBinaryAvailable(){try{
 const path=ytDlpPath(),file=statSync(path);accessSync(path,constants.X_OK);
 if(verifiedRuntime?.path===path&&verifiedRuntime.mtime===file.mtimeMs&&verifiedRuntime.size===file.size)return verifiedRuntime.valid;
 const valid=createHash('sha256').update(readFileSync(path)).digest('hex')===digests[process.platform as keyof typeof digests];verifiedRuntime={path,mtime:file.mtimeMs,size:file.size,valid};return valid;
}catch{return false;}}
async function verifyBinary(){const platform=process.platform as keyof typeof digests;const path=ytDlpPath();if(createHash('sha256').update(await readFile(path)).digest('hex')!==digests[platform])throw importFailure('IMPORT_UNAVAILABLE',503);return path;}
export function extractorArgs(url:string,proxy:string){
 const source=recognizeSource(url);if(source.provider!=='tiktok')throw importFailure('SOURCE_UNSUPPORTED');
 return ['--ignore-config','--no-config-locations','--no-plugin-dirs','--no-js-runtimes','--no-remote-components','--no-update','--no-cache-dir','--no-playlist','--skip-download','--format','best[ext=mp4]/best','--dump-single-json','--no-warnings','--no-progress','--use-extractors','^tiktok$,^vm\\.tiktok$','--retries','0','--fragment-retries','0','--extractor-retries','0','--socket-timeout','8','--proxy',proxy,'--',source.canonicalUrl];
}
export function selectProgressiveFormat(raw:any){
 const formats=Array.isArray(raw.formats)?raw.formats:[raw];
 const acceptable=(f:any)=>{
  if(f.has_drm||f.protocol!=='https'||f.ext!=='mp4'||typeof f.vcodec!=='string'||!/^(h264|h265|hevc|avc1(?:\.[a-z0-9]+)?|hev1(?:\.[a-z0-9.]+)?)$/i.test(f.vcodec)||typeof f.acodec!=='string'||!/^(aac|mp4a(?:\.[a-z0-9.]+)?)$/i.test(f.acodec)||![f.width,f.height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=1920))return false;
  try{const u=new URL(f.url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&allowedImportHost(u.hostname);}catch{return false;}
 };
 // yt-dlp already ranks formats worst -> best. Pixel count loses preference/tie ordering.
 // If a format was explicitly selected by yt-dlp, do not silently substitute a different URL.
 const selected=typeof raw.url==='string'?{...formats.find((f:any)=>f.url===raw.url),...raw}:undefined;
 const f=selected??formats.filter(acceptable).at(-1);
 if(!f||!acceptable(f))throw importFailure('SOURCE_UNSUPPORTED');
 if(typeof f.filesize==='number'&&f.filesize>50000000)throw importFailure('FILE_TOO_LARGE');
 return {url:f.url as string,headers:safeHeaders(raw.http_headers,f.http_headers),formatId:typeof f.format_id==='string'?f.format_id.replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,96):null,width:f.width as number,height:f.height as number,videoCodec:f.vcodec as string,audioCodec:f.acodec as string};
}
export async function extractTikTok(url:string,controller:AbortController,dir:string){
 const budget=new TransferBudget(8000000,16,controller),proxy=await startMetadataProxy(budget);
 try{
  const binary=await verifyBinary();
  const result=await run(binary,extractorArgs(url,proxy.url),{cwd:dir,signal:controller.signal,timeout:24000,killSignal:'SIGKILL',maxBuffer:2097152,windowsHide:true,env:{PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,TEMP:dir,TMP:dir,TMPDIR:dir,YTDLP_NO_PLUGINS:'1'}});
  const raw=JSON.parse(result.stdout);const metadata=sourceMetadata(raw);const format=selectProgressiveFormat(raw);
  return {metadata,format,metadataBytes:budget.bytes};
 }catch(error){throw budget.error??(controller.signal.aborted?importFailure('IMPORT_TIMEOUT'):error instanceof Error&&'statusCode' in error?error:importFailure('IMPORT_FAILED'));}
 finally{await proxy.close();}
}
/** Reels may omit metadata duration. Download an exclusively temporary, bounded
 * source via the provider-scoped proxy and derive duration with ffprobe. Caller
 * owns the directory and must remove it on both success and failure. */
export async function extractInstagram(url:string,controller:AbortController,dir:string){
 const started=performance.now(),budget=new TransferBudget(60000000,32,controller),proxy=await startMetadataProxy(budget,'instagram');
 const env={PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,TEMP:dir,TMP:dir,TMPDIR:dir,YTDLP_NO_PLUGINS:'1'};
 try{
  const binary=await verifyBinary(),args=instagramArgs(url,proxy.url);
  const result=await run(binary,args,{cwd:dir,signal:controller.signal,timeout:24000,killSignal:'SIGKILL',maxBuffer:2097152,windowsHide:true,env});
  const raw=JSON.parse(result.stdout);instagramMetadata(raw,1);const formatId=instagramFormat(raw),input=join(dir,'instagram-source.mp4');
  const stop=guardImportFile(input,controller);let downloaded;
  try{downloaded=await run(binary,temporarySessionArgs(args,formatId,input),{cwd:dir,signal:controller.signal,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true,env});}finally{stop();}
  if(downloaded.stdout.trim()!==raw.id)throw importFailure('SOURCE_CHANGED',409);
  const size=(await stat(input)).size;if(size<=0||size>50000000)throw importFailure('FILE_TOO_LARGE');
  const sourceProbe=await run(probeBinaryPath(),instagramProbeArgs(input),{signal:controller.signal,timeout:10000,maxBuffer:1048576,windowsHide:true});
  const duration=validateInstagramProbe(JSON.parse(sourceProbe.stdout));
  return {metadata:instagramMetadata(raw,duration),localSource:input,formatId,metadataBytes:budget.bytes,elapsedMs:Math.round(performance.now()-started)};
 }catch(error){throw budget.error??processFailure(error,controller,'downloading');}
 finally{await proxy.close();}
}
/** Entire bounded source for a private preview; never a published final asset. */
export async function preparePreviewSource(source:{provider:string;sourceUrl:string;videoId:string;durationSeconds:number},controller:AbortController,dir:string){
 let file:string;
 if(source.provider==='instagram'){
  if(!instagramRuntimeAvailable())throw importFailure('PREVIEW_UNAVAILABLE',503);
  const resolved=await extractInstagram(source.sourceUrl,controller,dir);
  if(resolved.metadata.videoId!==source.videoId||Math.abs(resolved.metadata.durationSeconds-source.durationSeconds)>1)throw importFailure('SOURCE_CHANGED',409);
  file=resolved.localSource;
 }else if(source.provider==='tiktok'){
  if(!tikTokRuntimeAvailable())throw importFailure('PREVIEW_UNAVAILABLE',503);
  const resolved=await extractTikTok(source.sourceUrl,controller,dir);
  if(resolved.metadata.videoId!==source.videoId||Math.abs(resolved.metadata.durationSeconds-source.durationSeconds)>1)throw importFailure('SOURCE_CHANGED',409);
  const budget=new TransferBudget(60000000,32,controller),proxy=await startMetadataProxy(budget);file=join(dir,'preview-source.mp4');const stop=guardImportFile(file,controller);
  try{const downloaded=await run(await verifyBinary(),temporarySessionArgs(extractorArgs(source.sourceUrl,proxy.url),resolved.format.formatId??'',file),{cwd:dir,signal:controller.signal,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true,env:{PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,TEMP:dir,TMP:dir,TMPDIR:dir,YTDLP_NO_PLUGINS:'1'}});if(downloaded.stdout.trim()!==source.videoId)throw importFailure('SOURCE_CHANGED',409);}finally{stop();await proxy.close();}
 }else throw importFailure('SOURCE_UNSUPPORTED');
 const size=(await stat(file)).size;if(size<1||size>50000000)throw importFailure('FILE_TOO_LARGE');
 let metadata;
 try{metadata=await probeOriginal(file,{maxBytes:50000000,maxDurationSeconds:7200},controller.signal);}catch(error){
  if((error as {code?:string}).code!=='UNSUPPORTED_CODEC'||source.durationSeconds>90)throw importFailure('PREVIEW_UNAVAILABLE',422);
  const output=join(dir,'browser-preview.mp4'),stop=guardImportFile(output,controller);
  try{await run(ffmpegBinaryPath(),encodeTemporaryArgs(file,output,{startSeconds:0,endSeconds:source.durationSeconds},50000000),{signal:controller.signal,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true});}finally{stop();}
  if((await stat(output)).size>50000000)throw importFailure('FILE_TOO_LARGE');
  metadata=await probeOriginal(output,{maxBytes:50000000,maxDurationSeconds:90},controller.signal);file=output;
 }
 if(Math.abs(metadata.durationSeconds-source.durationSeconds)>1)throw importFailure('SOURCE_CHANGED',409);
 return file;
}
export function encodeSectionArgs(url:string,output:string,clip:Clip,maxBytes:number){
 const u=new URL(url);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.username||u.password)throw importFailure('IMPORT_DESTINATION_DENIED');
 checkImportSelection(clip,7200);
 return ['-nostdin','-v','error','-xerror','-err_detect','explode','-protocol_whitelist','http,tcp','-format_whitelist','mov','-f','mov','-enable_drefs','0','-use_absolute_path','0','-rw_timeout','10000000','-ss',String(clip.startSeconds),'-threads','1','-i',url,'-t',String(clip.endSeconds-clip.startSeconds),'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-crf','23','-threads','1','-filter_threads','1','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-fs',String(maxBytes+1048576),output];
}
export async function importSection(source:ReturnType<typeof sourceMetadata>,clip:Clip,output:string,dir:string,limits:MediaLimits,controller:AbortController,stage:(stage:string)=>Promise<void>){
 checkImportSelection(clip,source.durationSeconds);
 await stage('resolving');const resolved=await extractTikTok(source.sourceUrl,controller,dir);
 if(resolved.metadata.videoId!==source.videoId||Math.abs(resolved.metadata.durationSeconds-source.durationSeconds)>0.1)throw importFailure('SOURCE_CHANGED',409);
 const budget=new TransferBudget(60000000,32,controller);let close:()=>Promise<void>=async()=>{};
 let phase:'downloading'|'transcoding'='downloading';
 try{
  await stage('downloading');
  if(readDownloadMode()==='temporary'){
   const proxy=await startMetadataProxy(budget);close=()=>proxy.close();
   const input=join(dir,'source.mp4'),f=resolved.format;
   // Extraction and native download share one ephemeral extractor context.
   // No external cookies/config; all connections still cross the pinned proxy.
   const stopGuard=guardImportFile(input,controller);
   let downloaded;try{downloaded=await run(await verifyBinary(),temporarySessionArgs(extractorArgs(source.sourceUrl,proxy.url),f.formatId??'',input),{cwd:dir,signal:controller.signal,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true,env:{PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,TEMP:dir,TMP:dir,TMPDIR:dir,YTDLP_NO_PLUGINS:'1'}});
   }finally{stopGuard();}
   if(downloaded.stdout.trim()!==source.videoId)throw importFailure('SOURCE_CHANGED',409);
   const size=(await stat(input)).size;if(size<=0||size>50000000)throw importFailure('FILE_TOO_LARGE');
   await close();close=async()=>{};phase='transcoding';
   const sourceProbe=await run(probeBinaryPath(),['-v','error','-protocol_whitelist','file','-show_format','-show_streams','-of','json',input],{signal:controller.signal,timeout:10000,maxBuffer:1048576,windowsHide:true});
   validateTemporarySource(JSON.parse(sourceProbe.stdout),source.durationSeconds,f);
   await stage('transcoding');
   await run(ffmpegBinaryPath(),encodeTemporaryArgs(input,output,clip,limits.maxBytes),{signal:controller.signal,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true});
  }else{
   const relay=await startMediaRelay(resolved.format.url,resolved.format.headers,budget);close=()=>relay.close();
   await run(ffmpegBinaryPath(),encodeSectionArgs(relay.url,output,clip,limits.maxBytes),{signal:controller.signal,timeout:65000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true});
  }
  await stage('validating');const bytes=(await stat(output)).size;if(bytes>limits.maxBytes)throw importFailure('FILE_TOO_LARGE');
  const metadata=await probeOriginal(output,limits,controller.signal);
  if(Math.abs(metadata.durationSeconds-(clip.endSeconds-clip.startSeconds))>0.1)throw importFailure('INVALID_MEDIA');
  await decodeVideo(output,controller.signal);
  return {...metadata,bytes,clip,sourceDurationSeconds:source.durationSeconds,provenance:source,extractorVersion:ytDlpVersion,transfer:{metadataBytes:resolved.metadataBytes,mediaBytes:budget.bytes,mediaRequests:budget.requests}};
 }catch(error){throw budget.error??processFailure(error,controller,phase);}
 finally{await close();}
}

/** Process the authorized Reel independently of an ephemeral preview: every
 * request re-downloads through the scoped proxy and validates the source. */
export async function importInstagramSection(source:ReturnType<typeof instagramMetadata>,clip:Clip,output:string,dir:string,limits:MediaLimits,controller:AbortController,stage:(stage:string)=>Promise<void>){
 checkImportSelection(clip,source.durationSeconds);
 try{
  await stage('resolving');const resolved=await extractInstagram(source.sourceUrl,controller,dir);
  if(resolved.metadata.videoId!==source.videoId||Math.abs(resolved.metadata.durationSeconds-source.durationSeconds)>1)throw importFailure('SOURCE_CHANGED',409);
  await stage('transcoding');await run(ffmpegBinaryPath(),encodeTemporaryArgs(resolved.localSource,output,clip,limits.maxBytes),{signal:controller.signal,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true});
  await stage('validating');const bytes=(await stat(output)).size;if(bytes<=0||bytes>limits.maxBytes)throw importFailure('FILE_TOO_LARGE');
  const metadata=await probeOriginal(output,limits,controller.signal);if(Math.abs(metadata.durationSeconds-(clip.endSeconds-clip.startSeconds))>0.1)throw importFailure('INVALID_MEDIA');await decodeVideo(output,controller.signal);
  return {...metadata,bytes,clip,sourceDurationSeconds:source.durationSeconds,provenance:source,extractorVersion:ytDlpVersion,transfer:{totalBytes:resolved.metadataBytes}};
 }catch(error){throw processFailure(error,controller,'transcoding');}
}
