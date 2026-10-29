// Local codec smoke only: no database, network or Storage.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import assert from 'node:assert/strict';
const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'pcdnades-codec-'));
try{
 const input=join(dir,'input.mp4'),output=join(dir,'output.mp4');
 await run('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x240:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',input],{timeout:30000});
 await run('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file','-i',input,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-t','20','-fs','50000000',output],{timeout:30000});
 const probe=JSON.parse((await run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',output],{timeout:30000})).stdout);
 assert.equal(probe.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');assert.ok(Number(probe.format.duration)>0&&Number(probe.format.duration)<=20);
 const bytes=await readFile(output);assert.ok(bytes.length<50000000);assert.ok(bytes.indexOf(Buffer.from('moov'))<bytes.indexOf(Buffer.from('mdat')));
 console.log(JSON.stringify({test:'local synthetic codec smoke',duration:probe.format.duration,bytes:bytes.length,codecs:['h264','aac'],faststart:true,storageTested:false}));
}finally{await rm(dir,{recursive:true,force:true});}
