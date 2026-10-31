import {test} from 'node:test';import assert from 'node:assert/strict';import Fastify from 'fastify';
import {registerImportPreflight} from '../src/import-preflight.js';
const token='controlled_preview_only_fixture_'.padEnd(64,'x');
const env={VERCEL_ENV:'preview',PCDNADES_PREFLIGHT_ENABLED:'true',PCDNADES_PREFLIGHT_TOKEN:token};
test('preflight absent by default and always absent in production',async()=>{
 for(const e of [{},{...env,VERCEL_ENV:'production'},{...env,PCDNADES_PREFLIGHT_TOKEN:'short'}]){const app=Fastify();registerImportPreflight(app,e);assert.equal((await app.inject({method:'POST',url:'/api/internal/import-preflight'})).statusCode,404);await app.close();}
});
test('preview preflight requires dedicated token and accepts no commands or URLs',async()=>{
 const app=Fastify();let calls=0;registerImportPreflight(app,env,async()=>{calls++;return {status:'pass'} as any;});
 try{assert.equal((await app.inject({method:'POST',url:'/api/internal/import-preflight'})).statusCode,401);assert.equal(calls,0);
 const headers={'x-pcdnades-preflight-token':token};assert.equal((await app.inject({method:'POST',url:'/api/internal/import-preflight',headers,payload:{url:'https://example.com'}})).statusCode,400);assert.equal(calls,0);
 assert.equal((await app.inject({method:'POST',url:'/api/internal/import-preflight',headers,payload:{}})).json().data.status,'pass');assert.equal(calls,1);
 }finally{await app.close();}
});
test('blocked executable yields sanitized failure and no successful preflight',async()=>{
 const app=Fastify();registerImportPreflight(app,env,async()=>{throw {stderr:'libz.so.1: failed to map segment from shared object secret'};});
 try{const r=await app.inject({method:'POST',url:'/api/internal/import-preflight',headers:{'x-pcdnades-preflight-token':token}});assert.equal(r.statusCode,422);assert.equal(r.json().data.code,'RUNTIME_EXECUTION_BLOCKED');assert.ok(!r.body.includes('secret'));}finally{await app.close();}
});
