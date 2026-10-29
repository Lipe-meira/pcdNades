// Integration with local binaries only, never Storage/Auth/network.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';import {probeOriginal} from '../src/probe.js';
const run=promisify(execFile);const dir=await mkdtemp(join(tmpdir(),'probe-fixtures-'));const limits={maxBytes:50000000,maxDurationSeconds:40};
try{
 for(const [name,duration,codec,accepted] of [['boundary',40,'libx264',true],['short',2,'libx264',true],['too-long',41,'libx264',false],['wrong-codec',2,'mpeg4',false]] as const){
 const path=join(dir,`${name}.mp4`);await run('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=340x240:r=25','-t',String(duration),'-c:v',codec,'-pix_fmt','yuv420p',path],{timeout:30000});
 if(accepted)assert.equal((await probeOriginal(path,limits,AbortSignal.timeout(30000))).durationSeconds,duration);
 else await assert.rejects(probeOriginal(path,limits,AbortSignal.timeout(30000)),(e:any)=>e.code===(name==='too-long'?'DURATION_EXCEEDED':'UNSUPPORTED_CODEC'));
 }
 const corrupt=join(dir,'broken.mp4');await writeFile(corrupt,'not mp4');await assert.rejects(probeOriginal(corrupt,limits,AbortSignal.timeout(30000)),(e:any)=>e.code==='INVALID_MEDIA');
 console.log('PASS packaged ffprobe: synthetic MP4 2s/40s, reject41s,wrong codec,corrupt; no Storage');
}finally{await rm(dir,{recursive:true,force:true});}
