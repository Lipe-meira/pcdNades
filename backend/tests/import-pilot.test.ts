import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectiveImportLimits,importClipSchema} from '../src/tiktok.js';
import {encodeTemporaryArgs,temporarySessionArgs} from '../src/import-temporary.js';
import {guardImportFile} from '../src/import-file-limit.js';
import {beforeDeadline} from '../src/import-deadline.js';
import {selectProgressiveFormat} from '../src/import-runtime.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
test('pilot caps new TikTok selections independently of the historical 90s schema',()=>{
 assert.equal(effectiveImportLimits({maxBytes:50000000,maxDurationSeconds:90}).maxDurationSeconds,30);
 assert.equal(effectiveImportLimits().maxSourceBytes,50000000);
 assert.ok(importClipSchema.safeParse({startSeconds:3600,endSeconds:3690}).success);
});
test('known oversized source is rejected before downloading',()=>{
 const format={protocol:'https',ext:'mp4',vcodec:'h264',acodec:'aac',width:1080,height:1920,url:'https://v16.tiktokcdn.com/file',filesize:50000001};
 assert.throws(()=>selectProgressiveFormat(format),(e:any)=>e.code==='FILE_TOO_LARGE');
 assert.ok(selectProgressiveFormat({...format,filesize:50000000}));
});
test('unknown-length file growth aborts downloader without deleting unrelated files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pilot-test-')),path=join(dir,'source.mp4'),controller=new AbortController();
 const stop=guardImportFile(path,controller,8);
 try{
  await writeFile(path,'123456789');
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('guard did not abort')),2000);controller.signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
  assert.equal(controller.signal.reason.code,'FILE_TOO_LARGE');
 }finally{stop();await rm(dir,{recursive:true,force:true});}
});
test('deadline rejects a stalled auth/storage operation and observes late errors',async()=>{
 const controller=new AbortController();let rejectLate!:(e:Error)=>void;
 const waiting=beforeDeadline(new Promise<void>((_r,reject)=>{rejectLate=reject;}),controller.signal);
 controller.abort();await assert.rejects(waiting,(e:any)=>e.code==='IMPORT_TIMEOUT');rejectLate(new Error('late private response'));
});
test('an already-expired deadline still observes an operation rejected later',async()=>{
 const signal=AbortSignal.abort();
 await assert.rejects(beforeDeadline(Promise.reject(new Error('late private response')),signal),(e:any)=>e.code==='IMPORT_TIMEOUT');
});
test('pilot uses protected native download with 50MB limit and optimized compatible encoding',()=>{
 const download=temporarySessionArgs(['--format','best','--','https://www.tiktok.com/@a/video/123'],'chosen','input.mp4');
 assert.equal(download[download.indexOf('--max-filesize')+1],'50000000');
 const args=encodeTemporaryArgs('input.mp4','output.mp4',{startSeconds:100,endSeconds:130},50000000);
 assert.equal(args[args.indexOf('-preset')+1],'superfast');
 assert.ok(args.includes('-vf'));assert.ok(args.includes('-fpsmax'));
 assert.equal(args[args.indexOf('-ss')+1],'100');
});
