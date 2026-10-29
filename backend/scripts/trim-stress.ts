// Packaged-binary stress fixture; no user video, database, or remote Storage.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';import {ffmpegBinaryPath,trimVideo} from '../src/trimming.js';
const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'trim-stress-'));
try{
 const source=join(dir,'source.mp4'),output=join(dir,'output.mp4');
 await run(ffmpegBinaryPath(),['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=1920x1080:rate=25','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','95','-c:v','libx264','-preset','ultrafast','-crf','35','-maxrate','2500k','-bufsize','5000k','-threads','1','-pix_fmt','yuv420p','-c:a','aac',source],{timeout:120000,maxBuffer:65536});
 const sourceBytes=(await stat(source)).size;assert.ok(sourceBytes<=50000000,'synthetic source must obey50MB');
 const start=performance.now();const result=await trimVideo(source,output,{startSeconds:5,endSeconds:95},{maxBytes:50000000,maxDurationSeconds:90},AbortSignal.timeout(110000));
 assert.ok(result.bytes<=50000000);assert.equal(result.durationSeconds,90);
 console.log(JSON.stringify({fixture:'synthetic1080p95sAAC',sourceBytes,outputBytes:result.bytes,finalSeconds:result.durationSeconds,processingWallSeconds:(performance.now()-start)/1000,tempBytes:sourceBytes+result.bytes,platform:process.platform,vercelTested:false}));
}finally{await rm(dir,{recursive:true,force:true});}
