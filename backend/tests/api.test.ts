import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.js';
import {body} from '../src/model.js';
test('health and capabilities work without credentials',async()=>{const app=buildApp();try{assert.equal((await app.inject('/health')).statusCode,200);assert.equal((await app.inject('/api/v1/media/capabilities')).json().data.importers.youtube.enabled,false);}finally{await app.close();}});
test('coordinates and unknown fields rejected',()=>{assert.equal(body.safeParse({title:'x',target:{x:1.1,y:0}}).success,false);});
test('unconfigured protected writes fail closed',async()=>{const app=buildApp();try{assert.equal((await app.inject({method:'POST',url:'/api/v1/grenades',payload:{}})).statusCode,503);}finally{await app.close();}});
