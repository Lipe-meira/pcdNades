// Authorized local diagnostic only: no DB, Storage or production capability changes.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdtemp,rm,stat} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {extractTikTok,importSection,ytDlpPath,extractorArgs} from '../src/import-runtime.js';
import {encodeTemporaryArgs,processFailure} from '../src/import-temporary.js';
import {ffmpegBinaryPath,decodeVideo} from '../src/trimming.js';import {probeOriginal,probeBinaryPath} from '../src/probe.js';
const url=process.argv[2];if(!url)throw new Error('Authorized URL required');
const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'pcdnades-compare-')),limits={maxBytes:50000000,maxDurationSeconds:90};
const report=(x:object)=>console.log(JSON.stringify(x));
try{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);let resolved;
 try{resolved=await extractTikTok(url,controller,dir);}finally{clearTimeout(timer);}
 report({stage:'inspection',durationSeconds:resolved.metadata.durationSeconds,formatId:resolved.format.formatId,codecs:[resolved.format.videoCodec,resolved.format.audioCodec],headerNames:Object.keys(resolved.format.headers)});
 for(const mode of ['range','temporary']){
  process.env.MEDIA_TIKTOK_DOWNLOAD_MODE=mode;const c=new AbortController(),t=setTimeout(()=>c.abort(),110000);
  try{const m=await importSection(resolved.metadata,{startSeconds:10,endSeconds:20},join(dir,`${mode}.mp4`),dir,limits,c,async stage=>report({mode,stage}));report({mode,durationSeconds:m.durationSeconds,code:'VALIDATED',localOnly:true});}
  catch(e){const f=processFailure(e,c,'downloading');report({mode,code:f.code,diagnostic:f.diagnostic});}finally{clearTimeout(t);}
 }
 const input=join(dir,'direct.mp4'),output=join(dir,'direct-clip.mp4'),c=new AbortController();
 const args=extractorArgs(url,'').filter(x=>!['--skip-download','--dump-single-json'].includes(x));const pi=args.indexOf('--proxy');args.splice(pi,2);args[args.indexOf('--format')+1]=resolved.format.formatId!;
 const tail=args.splice(args.indexOf('--'));args.push('--downloader','native','--fixup','never','--no-part','--no-continue','--max-filesize','100000000','--quiet','--output',input,...tail);
 try{
  await run(ytDlpPath(),args,{cwd:dir,timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true});
  const bytes=(await stat(input)).size;if(bytes<=0||bytes>100000000)throw new Error('size');
  const info=JSON.parse((await run(probeBinaryPath(),['-v','error','-show_format','-show_streams','-of','json',input],{timeout:20000,maxBuffer:1048576})).stdout);
  await decodeVideo(input,c.signal);report({mode:'direct',stage:'source-validated',durationSeconds:Number(info.format.duration),codecs:info.streams.map((s:any)=>s.codec_name),format:info.format.format_name});
  await run(ffmpegBinaryPath(),encodeTemporaryArgs(input,output,{startSeconds:10,endSeconds:20},limits.maxBytes),{timeout:40000,killSignal:'SIGKILL',maxBuffer:65536,windowsHide:true});
  const metadata=await probeOriginal(output,limits,c.signal);await decodeVideo(output,c.signal);report({mode:'direct',stage:'clip-validated',durationSeconds:metadata.durationSeconds,format:'MP4 H264 yuv420p AAC',storageValidated:false,playbackInSiteValidated:false});
 }catch(e){const f=processFailure(e,c,'downloading');report({mode:'direct',code:f.code,diagnostic:f.diagnostic});}
}catch(e){const f=processFailure(e,new AbortController(),'metadata');report({code:f.code,diagnostic:f.diagnostic});process.exitCode=1;}
finally{await rm(dir,{recursive:true,force:true});}
