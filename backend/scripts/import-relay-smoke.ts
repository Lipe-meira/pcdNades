// Real packaged FFmpeg + loopback fixture only. Never contacts a platform/CDN.
import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,rm,stat} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createServer,get,type IncomingMessage} from 'node:http';
import {startMediaRelay,TransferBudget,type openRemote} from '../src/import-network.js';import {encodeSectionArgs} from '../src/import-runtime.js';import {ffmpegBinaryPath,decodeVideo} from '../src/trimming.js';import {probeOriginal} from '../src/probe.js';
const run=promisify(execFile),binary=ffmpegBinaryPath(),dir=await mkdtemp(join(tmpdir(),'pcdnades-relay-smoke-'));
const input=join(dir,'two-hours.mp4'),output=join(dir,'selected.mp4');let bytes=0,requests=0,noRange=false;
const source=createServer((req,res)=>{void(async()=>{
 requests++;const total=(await stat(input)).size;
 if(noRange){res.writeHead(200,{'Content-Length':total});createReadStream(input).pipe(res);return;}
 const match=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(!match){res.writeHead(416);res.end();return;}
 const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),total-1):total-1;
 if(start>=total||end<start){res.writeHead(416);res.end();return;}
 res.writeHead(206,{'Content-Type':'video/mp4','Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${total}`,'Accept-Ranges':'bytes'});
 const stream=createReadStream(input,{start,end,highWaterMark:4096});stream.on('data',chunk=>bytes+=chunk.length);res.on('close',()=>stream.destroy());stream.pipe(res);
})().catch(()=>res.destroy());});
await new Promise<void>(r=>source.listen(0,'127.0.0.1',r));const addr=source.address();assert.ok(addr&&typeof addr==='object');
const open:typeof openRemote=async(_url,budget,headers)=>{budget.request();return new Promise<IncomingMessage>((resolve,reject)=>{const q=get(`http://127.0.0.1:${addr.port}/source.mp4`,{headers,signal:budget.controller.signal},res=>{res.on('data',(chunk:Buffer)=>{try{budget.consume(chunk.length);}catch{res.destroy(budget.error);}});res.pause();resolve(res);});q.on('error',reject);});};
try{
 await run(binary,['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=160x90:r=2:d=1800','-f','lavfi','-i','color=c=red:s=160x90:r=2:d=5400','-f','lavfi','-i','sine=frequency=440:sample_rate=8000:duration=7200','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-map','2:a:0','-c:v','libx264','-preset','ultrafast','-crf','28','-threads','1','-g','4','-c:a','aac','-b:a','16k','-movflags','+faststart',input],{timeout:120000,maxBuffer:65536});
 const sourceBytes=(await stat(input)).size;const controller=new AbortController(),budget=new TransferBudget(100000000,32,controller);
 const relay=await startMediaRelay('https://v16.tiktokcdn.com/fixture.mp4',{},budget,open);
 const started=Date.now();try{await run(binary,encodeSectionArgs(relay.url,output,{startSeconds:1800,endSeconds:1810},50000000),{signal:controller.signal,timeout:65000,maxBuffer:65536});}finally{await relay.close();}
 const metadata=await probeOriginal(output,{maxBytes:50000000,maxDurationSeconds:90},new AbortController().signal);assert.ok(Math.abs(metadata.durationSeconds-10)<=0.1);await decodeVideo(output,new AbortController().signal);
 const frame=await run(binary,['-v','error','-i',output,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','-'],{encoding:'buffer',maxBuffer:65536});assert.ok(frame.stdout[0]>150&&frame.stdout[2]<100,'selected frame must be red, not initial blue');
 assert.ok(budget.bytes<sourceBytes/2,'noninitial clip must not transfer full fixture');
 console.log(JSON.stringify({fixture:'local-only',sourceDurationSeconds:7200,selected:{startSeconds:1800,endSeconds:1810},sourceBytes,receivedBytes:budget.bytes,servedBytes:bytes,requests,outputBytes:(await stat(output)).size,outputDurationSeconds:metadata.durationSeconds,elapsedMilliseconds:Date.now()-started,decode:'PASS',noninitialRedFrame:'PASS'}));
 noRange=true;const deniedBudget=new TransferBudget(100000000,32,new AbortController()),denied=await startMediaRelay('https://v16.tiktokcdn.com/fixture.mp4',{},deniedBudget,open);
 try{const result=await fetch(denied.url,{headers:{Range:'bytes=0-'}});assert.equal(result.status,502);assert.equal(deniedBudget.error?.message,'IMPORT_RANGE_UNSUPPORTED');}finally{await denied.close();}
 console.log('No-Range source: explicit rejection PASS');
}finally{source.closeAllConnections();await new Promise<void>(r=>source.close(()=>r()));await rm(dir,{recursive:true,force:true});}
