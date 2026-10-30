import {BlockList,isIPv4,isIPv6,connect, type Socket} from 'node:net';
import type {Duplex} from 'node:stream';
import {lookup} from 'node:dns/promises';
import {createServer, type IncomingMessage} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {randomBytes} from 'node:crypto';

export const importFailure=(code:string,statusCode=422)=>Object.assign(new Error(code),{code,statusCode});
const denied=new BlockList();
for(const [network,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]] as const)denied.addSubnet(network,prefix,'ipv4');
export const publicIPv4=(ip:string)=>isIPv4(ip)&&!denied.check(ip,'ipv4');
const globalIPv6=new BlockList(),specialIPv6=new BlockList();globalIPv6.addSubnet('2000::',3,'ipv6');
for(const [ip,prefix]of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const)specialIPv6.addSubnet(ip,prefix,'ipv6');
const publicDNSAddress=(ip:string)=>publicIPv4(ip)||(isIPv6(ip)&&globalIPv6.check(ip,'ipv6')&&!specialIPv6.check(ip,'ipv6'));
const domains=['tiktok.com','tiktokv.com','tiktokcdn.com','tiktokcdn-us.com','tiktokv.us','byteoversea.com','ibytedtos.com','ibyteimg.com','muscdn.com','ttwstatic.com','akamaized.net'];
export function allowedImportHost(host:string){return /^[a-z0-9.-]+$/.test(host)&&domains.some(d=>host===d||host.endsWith(`.${d}`));}
// Inspect ALL A/AAAA answers, then connect only to a validated IPv4 address.
export async function pinnedAddress(host:string,resolve:(host:string)=>Promise<string[]>=async h=>(await lookup(h,{all:true,verbatim:true})).map(a=>a.address)){
 if(!allowedImportHost(host))throw importFailure('IMPORT_DESTINATION_DENIED');
 const addresses=await resolve(host);if(!addresses.length||addresses.some(ip=>!publicDNSAddress(ip)))throw importFailure('IMPORT_DESTINATION_DENIED');
 const selected=addresses.find(publicIPv4);if(!selected)throw importFailure('IMPORT_DESTINATION_DENIED');return selected;
}
export class TransferBudget {
 bytes=0;requests=0;error:Error|undefined;
 constructor(readonly maxBytes:number,readonly maxRequests:number,readonly controller:AbortController){}
 fail(code:string):never{this.error??=importFailure(code);this.controller.abort(this.error);throw this.error;}
 request(){if(++this.requests>this.maxRequests)this.fail('IMPORT_NETWORK_LIMIT');if(this.controller.signal.aborted)throw this.error??importFailure('IMPORT_TIMEOUT');}
 consume(bytes:number){this.bytes+=bytes;if(this.bytes>this.maxBytes)this.fail('IMPORT_NETWORK_LIMIT');}
}
function sourceUrl(raw:string){let u:URL;try{u=new URL(raw);}catch{throw importFailure('IMPORT_DESTINATION_DENIED');}if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!allowedImportHost(u.hostname))throw importFailure('IMPORT_DESTINATION_DENIED');return u;}
export type ImportHeaders={ 'User-Agent'?:string;Referer?:string };
export function validateContentRange(request:string,response:string,length:string|undefined,previousTotal:number|undefined){
 const wanted=request.match(/^bytes=(\d+)-(\d*)$/),actual=response.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
 if(!wanted||!actual)throw importFailure('IMPORT_RANGE_UNSUPPORTED');
 const [start,end,total]=actual.slice(1).map(Number),requestedStart=Number(wanted[1]),requestedEnd=wanted[2]?Number(wanted[2]):undefined;
 if(![start,end,total,requestedStart,...(requestedEnd===undefined?[]:[requestedEnd])].every(Number.isSafeInteger)||start!==requestedStart||end<start||end>=total||total>8000000000||(requestedEnd!==undefined&&end>requestedEnd)||(previousTotal!==undefined&&previousTotal!==total)||length===undefined||!/^\d+$/.test(length)||Number(length)!==end-start+1)throw importFailure('IMPORT_RANGE_UNSUPPORTED');
 return total;
}
export function safeHeaders(raw:unknown):ImportHeaders{
 const out:ImportHeaders={};if(!raw||typeof raw!=='object')return out;
 for(const name of ['User-Agent','Referer'] as const){const v=(raw as Record<string,unknown>)[name];if(typeof v==='string'&&v.length<=2048&&!/[\r\n\x00-\x1f]/.test(v)){if(name==='Referer')sourceUrl(v);out[name]=v;}}
 return out;
}
// DNS is pinned to the validated IP; TLS still verifies the original hostname.
export async function openRemote(raw:string,budget:TransferBudget,headers:Record<string,string>={},redirects=0):Promise<IncomingMessage>{
 budget.request();const u=sourceUrl(raw),ip=await pinnedAddress(u.hostname);
 if(budget.controller.signal.aborted)throw budget.error??importFailure('IMPORT_TIMEOUT');
 const response=await new Promise<IncomingMessage>((resolve,reject)=>{
  const req=httpsRequest(u,{method:'GET',agent:false,family:4,headers,servername:u.hostname,lookup:(_h,_opts,cb)=>cb(null,ip,4),signal:budget.controller.signal,timeout:10000},resolve);
  req.on('socket',socket=>{socket.on('data',(chunk:Buffer)=>{try{budget.consume(chunk.length);}catch{req.destroy(budget.error);}});});
  req.on('timeout',()=>req.destroy(importFailure('IMPORT_TIMEOUT')));req.on('error',reject);req.end();
 });
 if([301,302,303,307,308].includes(response.statusCode??0)){
  const location=response.headers.location;response.destroy();if(!location||redirects>=3)throw importFailure('IMPORT_REDIRECT_LIMIT');
  const next=sourceUrl(new URL(location,u).href);return openRemote(next.href,budget,headers,redirects+1);
 }
 return response;
}

export async function startMetadataProxy(budget:TransferBudget){
 const sockets=new Set<Duplex>();const token=randomBytes(24).toString('hex');
 const server=createServer((_req,res)=>{res.writeHead(403);res.end();});
 server.maxConnections=8;server.headersTimeout=5000;server.requestTimeout=10000;
 server.on('connect',(req,client,head)=>{
  sockets.add(client);client.on('error',()=>{});client.on('close',()=>sockets.delete(client));
  void (async()=>{
   if(req.headers['proxy-authorization']!==`Basic ${Buffer.from(`${token}:`).toString('base64')}`||!req.url||!/^([a-z0-9.-]+):443$/.test(req.url))throw importFailure('IMPORT_DESTINATION_DENIED');
   budget.request();const host=req.url.slice(0,-4),ip=await pinnedAddress(host);
   if(budget.controller.signal.aborted)throw budget.error??importFailure('IMPORT_TIMEOUT');
   const upstream=connect({host:ip,port:443});sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));
   upstream.on('error',()=>client.destroy());upstream.setTimeout(10000,()=>upstream.destroy());
   const count=(chunk:Buffer)=>{try{budget.consume(chunk.length);}catch{client.destroy();upstream.destroy();}};
   client.on('data',count);upstream.on('data',count);
   upstream.once('connect',()=>{if(budget.controller.signal.aborted){upstream.destroy();return;}client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length){count(head);upstream.write(head);}client.pipe(upstream).pipe(client);});
  })().catch(error=>{budget.error??=error instanceof Error?error:importFailure('IMPORT_DESTINATION_DENIED');client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');budget.controller.abort(budget.error);});
 });
 const stop=()=>{for(const s of sockets)s.destroy();server.close();};budget.controller.signal.addEventListener('abort',stop,{once:true});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();if(!address||typeof address==='string')throw importFailure('IMPORT_FAILED');
 return {url:`http://${token}:@127.0.0.1:${address.port}`,close:async()=>{budget.controller.signal.removeEventListener('abort',stop);stop();}};
}

// FFmpeg sees ONE opaque loopback MOV resource. It cannot choose a CDN URL or headers.
export async function startMediaRelay(remote:string,headers:ImportHeaders,budget:TransferBudget,open:typeof openRemote=openRemote){
 sourceUrl(remote);const token=randomBytes(24).toString('hex'),connections=new Set<Socket>();let total:number|undefined;
 const server=createServer((req,res)=>{void(async()=>{
  if(req.url!==`/${token}.mp4`||req.method!=='GET')throw importFailure('IMPORT_DESTINATION_DENIED');
  const range=req.headers.range;if(!range||!/^bytes=\d+-\d*$/.test(range))throw importFailure('IMPORT_RANGE_REQUIRED');
  const response=await open(remote,budget,{...headers,Range:range,'Accept-Encoding':'identity'});
  try{if([401,403].includes(response.statusCode??0))throw importFailure('IMPORT_ACCESS_DENIED');if(response.statusCode!==206||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity')throw importFailure('IMPORT_RANGE_UNSUPPORTED');total=validateContentRange(range,response.headers['content-range']??'',response.headers['content-length'],total);}catch(error){response.destroy();throw error;}
  res.writeHead(206,{'Content-Type':'video/mp4','Content-Range':response.headers['content-range']!,'Accept-Ranges':'bytes',...(response.headers['content-length']?{'Content-Length':response.headers['content-length']}:{})});
  res.on('close',()=>response.destroy());response.on('error',()=>res.destroy());response.pipe(res);
 })().catch(error=>{budget.error??=error instanceof Error?error:importFailure('IMPORT_FAILED');if(!res.headersSent)res.writeHead(502);res.end();});});
 server.maxConnections=4;server.headersTimeout=5000;server.requestTimeout=10000;
 server.on('connection',s=>{connections.add(s);s.on('close',()=>connections.delete(s));});
 const stop=()=>{for(const s of connections)s.destroy();server.close();};budget.controller.signal.addEventListener('abort',stop,{once:true});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const addr=server.address();if(!addr||typeof addr==='string')throw importFailure('IMPORT_FAILED');
 return {url:`http://127.0.0.1:${addr.port}/${token}.mp4`,close:async()=>{budget.controller.signal.removeEventListener('abort',stop);stop();}};
}
