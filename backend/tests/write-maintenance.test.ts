import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {configureApp} from '../src/application.js';
test('manutenção API bloqueia toda escrita antes de clientes e preserva leitura',async()=>{
 const prior=process.env.API_WRITES_PAUSED;process.env.API_WRITES_PAUSED='true';
 const app=configureApp(Fastify({logger:false}));
 try{for(const [method,url] of [['POST','/api/v1/grenades'],['PATCH','/api/v1/grenades/fixture'],['DELETE','/api/v1/grenades/fixture'],['POST','/api/v1/media/uploads'],['POST','/api/v1/media/fixture/complete'],['POST','/api/v1/media/imports/inspect']] as const){const r=await app.inject({method,url,payload:{}});assert.equal(r.statusCode,503);assert.equal(r.json().error.code,'WRITES_PAUSED');assert.equal(r.headers['retry-after'],'60');}assert.equal((await app.inject({method:'GET',url:'/health'})).statusCode,200);}finally{await app.close();if(prior===undefined)delete process.env.API_WRITES_PAUSED;else process.env.API_WRITES_PAUSED=prior;}
});
test('manutenção inválida falha no startup',()=>{const prior=process.env.API_WRITES_PAUSED;process.env.API_WRITES_PAUSED='yes';try{assert.throws(()=>configureApp(Fastify({logger:false})),/API_WRITES_PAUSED/);}finally{if(prior===undefined)delete process.env.API_WRITES_PAUSED;else process.env.API_WRITES_PAUSED=prior;}});
