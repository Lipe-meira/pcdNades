import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
test('Vercel entrypoint exports a working HTTP adapter without binding its own port',async()=>{
 const originalEnv=process.env.VERCEL,listen=http.Server.prototype.listen;process.env.VERCEL='1';let captured=false;
 http.Server.prototype.listen=function(){captured=true;return this;} as typeof listen;
 let module;
 try{module=await import('../src/server.js');await new Promise(resolve=>setImmediate(resolve));}
 finally{http.Server.prototype.listen=listen;if(originalEnv===undefined)delete process.env.VERCEL;else process.env.VERCEL=originalEnv;}
 assert.equal(typeof (module as any).default,'function');assert.equal(captured,false);
 const server=http.createServer((module as any).default);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const address=server.address() as {port:number};const r=await fetch(`http://127.0.0.1:${address.port}/health`);assert.equal(r.status,200);assert.equal((await r.json()).data.status,'ok');}
 finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
