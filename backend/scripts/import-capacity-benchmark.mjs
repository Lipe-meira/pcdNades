// Linux-only, offline benchmark. No DB, platform download, credentials or deployment.
// node script.mjs /backend/root /authorized/input.mp4 /new/results/directory [case-id]
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,appendFile,stat,statfs,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';

assert.equal(process.platform,'linux');
const [backendArg,inputArg,outputArg,only]=process.argv.slice(2);
assert(backendArg&&inputArg&&outputArg,'backend root, authorized input and NEW result directory required');
const backend=resolve(backendArg),input=resolve(inputArg),out=resolve(outputArg);
assert.notEqual(out,input);await mkdir(out,{recursive:false});
const require=createRequire(join(backend,'package.json')),run=promisify(execFile);
const ffmpeg=require.resolve('ffmpeg-static/ffmpeg');
const {encodeTemporaryArgs}=await import(pathToFileURL(join(backend,'dist/import-temporary.js')).href);
const {probeOriginal,probeBinaryPath}=await import(pathToFileURL(join(backend,'dist/probe.js')).href);
const {decodeVideo}=await import(pathToFileURL(join(backend,'dist/trimming.js')).href);
const sourceInfo=JSON.parse((await run(probeBinaryPath(),['-v','error','-show_format','-show_streams','-of','json',input],{timeout:20000,maxBuffer:1048576})).stdout);
const sourceVideo=sourceInfo.streams.find(s=>s.codec_type==='video');
await writeFile(join(out,'source.json'),JSON.stringify({durationSeconds:Number(sourceInfo.format.duration),bytes:(await stat(input)).size,width:sourceVideo.width,height:sourceVideo.height,fps:sourceVideo.avg_frame_rate,codec:sourceVideo.codec_name}));

const cases=[
 ...[10,30,90].map(seconds=>({id:`1080-original-${seconds}`,seconds,preset:'veryfast',height:1920,fps:null})),
 {id:'1080-30fps-90',seconds:90,preset:'veryfast',height:1920,fps:30},
 ...[30,90].map(seconds=>({id:`1080-superfast30-${seconds}`,seconds,preset:'superfast',height:1920,fps:30})),
 ...[10,30,60,90].map(seconds=>({id:`720-30fps-${seconds}`,seconds,preset:'veryfast',height:1280,fps:30})),
 {id:'720-superfast30-90',seconds:90,preset:'superfast',height:1280,fps:30},
];
async function cpu(){try{return Number((await readFile('/sys/fs/cgroup/cpu.stat','utf8')).match(/usage_usec (\d+)/)?.[1]??0)/1000000;}catch{return null;}}
async function temporaryBytes(){const s=await statfs(tmpdir());return (s.blocks-s.bfree)*s.bsize;}
for(const c of cases.filter(c=>!only||c.id===only)){
 const dir=await mkdtemp(join(tmpdir(),'pcdnades-capacity-')),output=join(dir,'clip.mp4');
 const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),160000);
 let peakRssKiB=0,peakTmpBytes=0,peakCgroupBytes=0,sampler,child;
 const row={...c,crf:23,exploratoryEncodeTimeoutMs:120000,productionEncodeTimeoutMs:40000};
 try{
  const args=encodeTemporaryArgs(input,output,{startSeconds:0,endSeconds:c.seconds},50000000);
  args[args.indexOf('-v')+1]='info';args.splice(args.indexOf('-i'),0,'-stream_loop','-1');
  args[args.indexOf('-preset')+1]=c.preset;
  const filters=[];if(c.fps)filters.push(`fps=${c.fps}`);
  if(c.height<Math.max(sourceVideo.width,sourceVideo.height))filters.push(sourceVideo.width>=sourceVideo.height?`scale=${c.height}:-2:flags=lanczos`:`scale=-2:${c.height}:flags=lanczos`);
  if(filters.length)args.splice(args.indexOf('-c:v'),0,'-vf',filters.join(','));
  args.unshift('-hide_banner','-nostats','-benchmark');
  const beforeTmp=await temporaryBytes(),beforeCpu=await cpu(),started=performance.now();
  child=execFile(ffmpeg,args,{signal:controller.signal,timeout:120000,killSignal:'SIGKILL',maxBuffer:131072});
  sampler=setInterval(async()=>{try{const status=await readFile(`/proc/${child.pid}/status`,'utf8');peakRssKiB=Math.max(peakRssKiB,Number(status.match(/VmHWM:\s+(\d+)/)?.[1]??0));}catch{}try{peakTmpBytes=Math.max(peakTmpBytes,await temporaryBytes()-beforeTmp);peakCgroupBytes=Math.max(peakCgroupBytes,Number(await readFile('/sys/fs/cgroup/memory.current','utf8')));}catch{}},200);
  const encoded=await new Promise((resolve,reject)=>{let stderr='';child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('exit',(code,signal)=>code===0?resolve({stderr}):reject(Object.assign(new Error('ENCODE_FAILED'),{code,signal})));});
  row.encodeMs=Math.round(performance.now()-started);row.fitsProductionEncodeBudget=row.encodeMs<=40000;
  row.encodeCpuSeconds=beforeCpu===null?null:Number(((await cpu())-beforeCpu).toFixed(3));
  row.ffmpegUserCpuSeconds=Number(encoded.stderr.match(/utime=([\d.]+)s/)?.[1]??0);
  row.ffmpegSystemCpuSeconds=Number(encoded.stderr.match(/stime=([\d.]+)s/)?.[1]??0);
  row.peakFfmpegRssKiB=Math.max(peakRssKiB,Number(encoded.stderr.match(/maxrss=(\d+)Ki?B/)?.[1]??0));
  clearInterval(sampler);
  row.outputBytes=(await stat(output)).size;assert.ok(row.outputBytes<=50000000);
  const validationStarted=performance.now();const metadata=await probeOriginal(output,{maxBytes:50000000,maxDurationSeconds:90},controller.signal);
  assert.ok(Math.abs(metadata.durationSeconds-c.seconds)<=.1);await decodeVideo(output,controller.signal);
  row.validationMs=Math.round(performance.now()-validationStarted);row.encodeAndValidationMs=Math.round(performance.now()-started);
  row.validatedDuration=metadata.durationSeconds;row.outputWidth=metadata.width;row.outputHeight=metadata.height;row.integrity='probe+full-decode PASS';
  // A proxy quality metric on the first 10s, resampled to a common grid. Not an aim-legibility guarantee.
  const comparison=await run(ffmpeg,['-hide_banner','-nostats','-v','info','-threads','1','-i',input,'-threads','1','-i',output,'-t','10','-filter_complex_threads','1','-filter_complex',`[0:v]fps=30,scale=${sourceVideo.width}:${sourceVideo.height}:flags=lanczos,format=yuv420p[r];[1:v]fps=30,scale=${sourceVideo.width}:${sourceVideo.height}:flags=lanczos,format=yuv420p[d];[r][d]ssim`,'-an','-f','null','-'],{timeout:30000,maxBuffer:131072,signal:controller.signal});
  row.ssimFirst10Seconds=Number(comparison.stderr.match(/All:([\d.]+)/)?.[1]??0);
  if(['1080-original-10','1080-superfast30-30','720-30fps-10'].includes(c.id))await run(ffmpeg,['-v','error','-ss','3','-i',output,'-frames:v','1',join(out,c.id+'.png')],{timeout:10000,maxBuffer:65536});
  row.peakTmpBytesAboveBaseline=peakTmpBytes;row.peakContainerMemoryBytes=peakCgroupBytes;row.status='PASS';
 }catch(e){row.status='FAILED';row.failureCode=controller.signal.aborted?'BENCH_DEADLINE':String(e.code??e.name);}
 finally{clearTimeout(deadline);if(sampler)clearInterval(sampler);await rm(dir,{recursive:true,force:true});}
 await appendFile(join(out,'results.jsonl'),JSON.stringify(row)+'\n');console.log(JSON.stringify(row));
}
