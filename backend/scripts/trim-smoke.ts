// Real packaged binaries, synthetic files only. No network/provider/database.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';import {trimVideo,ffmpegBinaryPath} from '../src/trimming.js';import {probeBinaryPath} from '../src/probe.js';
const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'packaged-trim-'));const limits={maxDurationSeconds:90,maxBytes:50000000};
try{
 const input=join(dir,'source.mp4');
 await run(ffmpegBinaryPath(),['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x240:r=25','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','94','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p','-c:a','aac',input],{timeout:30000});
 const started=performance.now();const output=join(dir,'clip.mp4');const result=await trimVideo(input,output,{startSeconds:4,endSeconds:94},limits,AbortSignal.timeout(110000));assert.equal(result.durationSeconds,90);assert.ok(result.bytes<=50000000);
 const fraction=await trimVideo(input,join(dir,'fraction.mp4'),{startSeconds:1.125,endSeconds:2.375},limits,AbortSignal.timeout(30000));assert.ok(Math.abs(fraction.durationSeconds-1.25)<=0.1);
 await assert.rejects(trimVideo(input,join(dir,'too-large.mp4'),{startSeconds:0,endSeconds:10},{...limits,maxBytes:100},AbortSignal.timeout(30000)),(e:any)=>e.code==='FILE_TOO_LARGE');
 const corrupt=join(dir,'broken.mp4');await writeFile(corrupt,'broken');await assert.rejects(trimVideo(corrupt,join(dir,'broken-out.mp4'),{startSeconds:0,endSeconds:1},limits,AbortSignal.timeout(30000)));
 const beforeAbort=new AbortController();beforeAbort.abort();await assert.rejects(trimVideo(input,join(dir,'aborted.mp4'),{startSeconds:0,endSeconds:1},limits,beforeAbort.signal),(e:any)=>e.code==='PROCESSING_TIMEOUT');
 const long=join(dir,'long.mp4');await run(ffmpegBinaryPath(),['-nostdin','-v','error','-f','lavfi','-i','color=c=black:s=16x16:r=25','-t','180','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',long],{timeout:30000});const end=await trimVideo(long,join(dir,'end.mp4'),{startSeconds:179,endSeconds:180},limits,AbortSignal.timeout(30000));assert.ok(end.durationSeconds>0);
 console.log(JSON.stringify({fixture:'synthetic320x240AAC',sourceBytes:(await stat(input)).size,outputBytes:result.bytes,finalSeconds:result.durationSeconds,elapsedSeconds:(performance.now()-started)/1000,source180:true,platform:process.platform,ffmpegBytes:(await stat(ffmpegBinaryPath())).size,ffprobeBytes:(await stat(probeBinaryPath())).size,remoteStorageTested:false,vercelRuntimeTested:false}));
}finally{await rm(dir,{recursive:true,force:true});}
