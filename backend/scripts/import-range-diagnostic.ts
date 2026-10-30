// ONE explicitly coordinated diagnostic. Never prints CDN URL, cookies or raw headers.
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {extractTikTok} from '../src/import-runtime.js';import {openRemote,TransferBudget,validateContentRange} from '../src/import-network.js';
const dir=await mkdtemp(join(tmpdir(),'pcdnades-range-diag-'));const extraction=new AbortController();let timer=setTimeout(()=>extraction.abort(),25000);timer.unref();
try{
 // Previous diagnostic deleted its private temp; resolve once again only for this authorized header request.
 const resolved=await extractTikTok(process.argv[2],extraction,dir);clearTimeout(timer);
 const controller=new AbortController(),budget=new TransferBudget(100000,4,controller);timer=setTimeout(()=>controller.abort(),10000);timer.unref();
 const response=await openRemote(resolved.format.url,budget,{...resolved.format.headers,Range:'bytes=0-1023','Accept-Encoding':'identity'});
 const length=response.headers['content-length'],range=response.headers['content-range'],encoding=response.headers['content-encoding'];
 let valid=false;try{validateContentRange('bytes=0-1023',range??'',length,undefined);valid=true;}catch{}
 response.destroy();
 console.log(JSON.stringify({httpStatus:response.statusCode,contentRangePresent:!!range,contentRangeValid:valid,contentLengthPresent:!!length,contentLength:Number.isSafeInteger(Number(length))?Number(length):null,contentEncoding:encoding===undefined?'absent':encoding==='identity'?'identity':'other',contentTypeMP4:response.headers['content-type']?.split(';')[0]==='video/mp4',bytesReceived:budget.bytes,requests:budget.requests,metadataBytes:resolved.metadataBytes,bodyConsumedByApplication:0,localOnly:true}));
}catch(error){console.log(JSON.stringify({code:error instanceof Error&&'code'in error?error.code:'IMPORT_FAILED',localOnly:true}));process.exitCode=1;}
finally{clearTimeout(timer);await rm(dir,{recursive:true,force:true});}
