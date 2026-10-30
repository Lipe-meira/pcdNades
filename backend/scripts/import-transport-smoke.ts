// OFFLINE: compare Node/packaged FFmpeg HTTP serialization on a rejecting loopback fixture.
import assert from 'node:assert/strict';import {createServer,get} from 'node:http';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ffmpegBinaryPath} from '../src/trimming.js';import {safeHeaders} from '../src/import-network.js';
const requests:Array<{url:string;headers:Record<string,string|string[]|undefined>}>=[];
const server=createServer((req,res)=>{requests.push({url:req.url!,headers:req.headers});res.writeHead(404,{'Content-Length':'0'});res.end();});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address==='object');
const path='/test%2Fvideo.mp4?token=fixture%2Bonly&x=a+b&x=c%2Fd';const url=`http://127.0.0.1:${address.port}${path}`;
const headers=safeHeaders({'user-agent':'Fixture agent','Referer':'https://www.tiktok.com/',Accept:'*/*','Accept-Language':'en-US','Sec-Fetch-Mode':'navigate'});
try{
 await new Promise<void>((resolve,reject)=>{get(new URL(url),{headers:{...headers,Range:'bytes=0-','Accept-Encoding':'identity'},agent:false,family:4},res=>{res.resume();res.on('end',resolve);}).on('error',reject);});
 try{await promisify(execFile)(ffmpegBinaryPath(),['-nostdin','-v','error','-protocol_whitelist','http,tcp','-f','mov','-headers',Object.entries(headers).map(([k,v])=>`${k}: ${v}\r\n`).join(''),'-i',url,'-t','0.1','-f','null','-'],{timeout:10000,maxBuffer:65536});}catch{/* Fixture deliberately returns404; never a real platform. */}
 assert.equal(requests.length,2);assert.equal(requests[0].url,path);assert.equal(requests[1].url,path);
 for(const name of Object.keys(headers))assert.equal(requests[0].headers[name.toLowerCase()],requests[1].headers[name.toLowerCase()]);
 assert.equal(requests[0].headers.range,requests[1].headers.range);
 const differences=[...new Set([...Object.keys(requests[0].headers),...Object.keys(requests[1].headers)])].filter(k=>requests[0].headers[k]!==requests[1].headers[k]);
 console.log(JSON.stringify({offline:true,upstreamConnections:0,exactEncodedPathAndQueryEqual:true,inheritedHeaderValuesEqual:true,rangeEqual:true,transportHeaderNamesDifferent:differences,result:'PASS'}));
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
