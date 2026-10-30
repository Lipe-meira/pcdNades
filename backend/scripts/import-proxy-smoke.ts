// Offline: a rejecting local proxy proves CLI selection/auth-proxy path; NO upstream socket.
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ytDlpPath,extractorArgs} from '../src/import-runtime.js';
const run=promisify(execFile);let connects=0;
const server=createServer((_req,res)=>{res.writeHead(403);res.end();});
server.on('connect',(_req,socket)=>{connects++;socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address==='object');
const args=extractorArgs('https://vt.tiktok.com/NotARealLink/',`http://local:@127.0.0.1:${address.port}`);
try{
 const old=[...args];old[old.indexOf('--use-extractors')+1]='TikTok,TikTokVM';
 let oldNoExtractor=false;try{await run(ytDlpPath(),old,{timeout:10000,maxBuffer:65536});}catch(error){oldNoExtractor=/No suitable extractor/.test(String((error as any).stderr));}
 assert.equal(oldNoExtractor,true);assert.equal(connects,0,'old selector fails before any proxy/network');
 let rejected=false;try{await run(ytDlpPath(),args,{timeout:10000,maxBuffer:65536});}catch{rejected=true;}
 assert.equal(rejected,true);assert.ok(connects>0,'correct extractor must attempt only rejecting loopback proxy');
 console.log(JSON.stringify({offline:true,oldSelector:'NO_SUITABLE_EXTRACTOR_BEFORE_NETWORK',fixedSelectorProxyConnects:connects,upstreamConnections:0,result:'PASS'}));
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
