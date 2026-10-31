// Real pinned yt-dlp + FFmpeg against loopback-generated media. No platform/Supabase access.
import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdtemp,rm,writeFile,stat,readFile} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {createServer} from 'node:http';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createClient} from '@supabase/supabase-js';import {storeClip} from '../src/clip-storage.js';
import {temporaryDownloadArgs,encodeTemporaryArgs} from '../src/import-temporary.js';import {ytDlpPath} from '../src/import-runtime.js';import {ffmpegBinaryPath,decodeVideo} from '../src/trimming.js';import {probeOriginal} from '../src/probe.js';
const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'pcdnades-native-fixture-')),input=join(dir,'fixture.mp4'),download=join(dir,'source.mp4'),output=join(dir,'clip.mp4'),info=join(dir,'info.json');
let requests=0,sourceUnavailable=false,stored:Buffer|undefined,storedObjects=0;
const server=createServer((req,res)=>{void(async()=>{
 const route=new URL(req.url!,'http://fixture').pathname;
 if(req.method==='POST'&&route.startsWith('/storage/v1/object/upload/sign/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({url:route.replace('/storage/v1','')+'?token=controlled'}));return;}
 if(req.method==='PUT'&&route.startsWith('/storage/v1/object/upload/sign/')){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));stored=Buffer.concat(chunks);storedObjects++;res.setHeader('content-type','application/json');res.end('{}');return;}
 if(route==='/stored.mp4'&&stored){res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':stored.length});res.end(stored);return;}
 requests++;if(sourceUnavailable){res.writeHead(403);res.end();return;}
 const size=(await stat(input)).size;res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':size});createReadStream(input).pipe(res);
 })().catch(()=>res.destroy());});
try{
 await run(ffmpegBinaryPath(),['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=3:duration=30','-f','lavfi','-i','sine=frequency=440:duration=30','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',input],{timeout:20000,maxBuffer:65536});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const a=server.address();assert.ok(a&&typeof a==='object');
 await writeFile(info,JSON.stringify({id:'fixture',title:'fixture',extractor:'TikTok',extractor_key:'TikTok',url:`http://127.0.0.1:${a.port}/source.mp4`,protocol:'http',ext:'mp4',duration:30}),{mode:0o600});
 await run(ytDlpPath(),temporaryDownloadArgs(info,download,''),{cwd:dir,timeout:20000,maxBuffer:65536,windowsHide:true});
 assert.deepEqual(await readFile(download),await readFile(input));
 await run(ffmpegBinaryPath(),encodeTemporaryArgs(download,output,{startSeconds:10,endSeconds:20},50000000),{timeout:20000,maxBuffer:65536});
 const m=await probeOriginal(output,{maxBytes:50000000,maxDurationSeconds:90},new AbortController().signal);assert.equal(m.durationSeconds,10);await decodeVideo(output,new AbortController().signal);
 const sdk=createClient(`http://127.0.0.1:${a.port}`,'sb_secret_controlled_local_fixture',{auth:{persistSession:false,autoRefreshToken:false}});
 await storeClip(sdk,'fixture/import-1.mp4',output,new AbortController().signal);
 assert.equal(storedObjects,1);assert.deepEqual(stored,await readFile(output));assert.notDeepEqual(stored,await readFile(input));
 sourceUnavailable=true;assert.equal((await fetch(`http://127.0.0.1:${a.port}/source.mp4`)).status,403);const playback=await fetch(`http://127.0.0.1:${a.port}/stored.mp4`);assert.equal(playback.status,200);
 const replay=join(dir,'playback.mp4');await writeFile(replay,Buffer.from(await playback.arrayBuffer()));
 const replayMetadata=await probeOriginal(replay,{maxBytes:50000000,maxDurationSeconds:90},new AbortController().signal);assert.equal(replayMetadata.durationSeconds,10);await decodeVideo(replay,new AbortController().signal);
 const abort=new AbortController();abort.abort();await assert.rejects(run(ytDlpPath(),temporaryDownloadArgs(info,join(dir,'cancel.mp4'),''),{signal:abort.signal,maxBuffer:65536}),{name:'AbortError'});
 console.log(JSON.stringify({fixture:'local HTTP200 without Range support',download:'identical-to-source',requests,selected:{startSeconds:10,endSeconds:20},durationSeconds:m.durationSeconds,format:'MP4 H264 yuv420p AAC',fullDecode:'PASS',cancellation:'PASS',storageProtocol:'real SDK + local HTTP substitute',storedObjects,storedFinalOnly:true,playbackWithSourceUnavailable:'probe/decode PASS',supabase:false}));
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
