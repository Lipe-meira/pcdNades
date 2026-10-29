import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/application.js';
import {body} from '../src/model.js';
test('health and capabilities work without credentials',async()=>{const app=buildApp();try{assert.equal((await app.inject('/health')).statusCode,200);assert.equal((await app.inject('/api/v1/media/capabilities')).json().data.importers.youtube.enabled,false);}finally{await app.close();}});
test('coordinates and unknown fields rejected',()=>{assert.equal(body.safeParse({title:'x',target:{x:1.1,y:0}}).success,false);});
test('unconfigured protected writes fail closed',async()=>{const app=buildApp();try{assert.equal((await app.inject({method:'POST',url:'/api/v1/grenades',payload:{}})).statusCode,503);}finally{await app.close();}});

const valid={title:'Smoke janela',mapId:'de_mirage',type:'smoke',side:'T',instructions:'Alinhe a mira',target:{x:0,y:1},videoId:'123e4567-e89b-42d3-a456-426614174000'};
test('accepts exact coordinate boundaries and rejects invalid values',()=>{
 assert.equal(body.safeParse(valid).success,true);
 for(const target of [{x:-0.01,y:0},{x:0,y:1.01},{x:NaN,y:0},{x:Infinity,y:0}])assert.equal(body.safeParse({...valid,target}).success,false);
 assert.equal(body.safeParse({...valid,createdAt:'2026-01-01'}).success,false);
 assert.equal(body.safeParse({...valid,type:'he'}).success,false);
});
