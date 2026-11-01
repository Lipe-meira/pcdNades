// Offline Linux/Windows: use only an authorized fixture; all outputs stay in a NEW directory.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {resolve,join} from 'node:path';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {encodeTemporaryArgs} from '../dist/import-temporary.js';
import {probeOriginal,probeBinaryPath} from '../dist/probe.js';import {decodeVideo,ffmpegBinaryPath} from '../dist/trimming.js';
const run=promisify(execFile);
const [inputArg,outArg]=process.argv.slice(2);assert.ok(inputArg&&outArg);
const input=resolve(inputArg),out=resolve(outArg);await mkdir(out,{recursive:false});
const source=join(out,'offline-source.mp4');
await run(ffmpegBinaryPath(),['-v','error','-stream_loop','3','-i',input,'-t','40','-map','0:v:0','-map','0:a:0?','-c','copy',source],{timeout:20000,maxBuffer:65536});
const rows=[];
for(const clip of [{startSeconds:0,endSeconds:30},{startSeconds:5,endSeconds:15},{startSeconds:29,endSeconds:39}]){
 const output=join(out,`clip-${clip.startSeconds}.mp4`),started=performance.now();
 const args=encodeTemporaryArgs(source,output,clip,50000000);args.unshift('-benchmark');
 const {stderr}=await run(ffmpegBinaryPath(),args,{timeout:40000,killSignal:'SIGKILL',maxBuffer:65536});
 const encodeMs=Math.round(performance.now()-started),limits={maxBytes:50000000,maxDurationSeconds:30};
 const metadata=await probeOriginal(output,limits,AbortSignal.timeout(20000));
 const streams=JSON.parse((await run(probeBinaryPath(),['-v','error','-show_streams','-of','json',output],{timeout:10000})).stdout).streams;
 const rate=streams.find(s=>s.codec_type==='video').avg_frame_rate.split('/').map(Number);
 assert.ok(rate[0]/rate[1]<=30);
 await decodeVideo(output,AbortSignal.timeout(20000));
 assert.ok(Math.abs(metadata.durationSeconds-(clip.endSeconds-clip.startSeconds))<=.1);
 assert.ok(Math.max(metadata.width,metadata.height)<=1920&&Math.min(metadata.width,metadata.height)<=1080);
 rows.push({clip,encodeMs,totalMs:Math.round(performance.now()-started),bytes:(await stat(output)).size,...metadata});
}
const low=join(out,'24fps.mp4'),lowOutput=join(out,'24fps-final.mp4');
await run(ffmpegBinaryPath(),['-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=24','-t','1','-c:v','libx264','-pix_fmt','yuv420p',low],{timeout:10000});
await run(ffmpegBinaryPath(),encodeTemporaryArgs(low,lowOutput,{startSeconds:0,endSeconds:1},50000000),{timeout:10000});
const lowInfo=JSON.parse((await run(probeBinaryPath(),['-v','error','-show_streams','-of','json',lowOutput],{timeout:10000})).stdout);
assert.equal(lowInfo.streams[0].avg_frame_rate,'24/1');
await writeFile(join(out,'results.json'),JSON.stringify({offline:true,platform:process.platform,rows},null,2));
console.log(JSON.stringify({offline:true,platform:process.platform,rows}));
