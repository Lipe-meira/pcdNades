// Feasibility only. Uses locally installed ffmpeg, not a Vercel-packaged transcoder.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';import {probeOriginal} from '../src/probe.js';
const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'pcdnades-clip-feasibility-'));
try{
 const input=join(dir,'source.mp4'),output=join(dir,'clip.mp4');
 await run('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=1920x1080:rate=25','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','45','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p','-c:a','aac',input],{timeout:120000,maxBuffer:1024*1024});
 const start=performance.now();
 await run('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file','-ss','5','-i',input,'-t','40','-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-threads','1','-filter_threads','1','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output],{timeout:110000,maxBuffer:1024*1024});
 const elapsedSeconds=(performance.now()-start)/1000;
 const metadata=await probeOriginal(output,{maxBytes:50000000,maxDurationSeconds:40},AbortSignal.timeout(30000));assert.ok(Math.abs(metadata.durationSeconds-40)<0.05);const bytes=(await stat(output)).size;assert.ok(bytes<=50000000);
 console.log(JSON.stringify({fixture:'synthetic1080p45s',explicitInterval:{startSeconds:5,endSeconds:45},elapsedSeconds,bytes,metadata,platform:process.platform,runtimeVercelTested:false}));
}finally{await rm(dir,{recursive:true,force:true});}
