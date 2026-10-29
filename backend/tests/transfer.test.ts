import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {downloadBounded} from '../src/transfer.js';
test('download bounds streamed content even without content-length',async()=>{
 const previous=globalThis.fetch;const dir=await mkdtemp(join(tmpdir(),'transfer-test-'));
 try{
 globalThis.fetch=async()=>new Response(new Uint8Array(11));
 await assert.rejects(downloadBounded('https://storage.example',join(dir,'large'),10),/FILE_TOO_LARGE/);
 globalThis.fetch=async()=>new Response(new Uint8Array([1,2]));
 await downloadBounded('https://storage.example',join(dir,'small'),10);assert.equal((await readFile(join(dir,'small'))).length,2);
 }finally{globalThis.fetch=previous;await rm(dir,{recursive:true,force:true});}
});
