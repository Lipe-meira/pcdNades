import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/application.js';
import {body,createBody,patchBody,filters} from '../src/model.js';
test('health and capabilities work without credentials',async()=>{const app=buildApp();try{assert.equal((await app.inject('/health')).statusCode,200);assert.equal((await app.inject('/api/v1/media/capabilities')).json().data.importers.youtube.enabled,false);}finally{await app.close();}});
test('coordinates and unknown fields rejected',()=>{assert.equal(body.safeParse({title:'x',target:{x:1.1,y:0}}).success,false);});
test('unconfigured protected writes fail closed',async()=>{const app=buildApp();try{assert.equal((await app.inject({method:'POST',url:'/api/v1/grenades',payload:{}})).statusCode,503);}finally{await app.close();}});

const valid={title:'Smoke janela',mapId:'de_mirage',type:'smoke',side:'T',instructions:'Alinhe a mira',target:{x:0,y:1},videoId:'123e4567-e89b-42d3-a456-426614174000'};
test('accepts exact coordinate boundaries and rejects invalid values',()=>{
 assert.equal(body.safeParse(valid).success,true);
 for(const target of [{x:-0.01,y:0},{x:0,y:1.01},{x:NaN,y:0},{x:Infinity,y:0}])assert.equal(body.safeParse({...valid,target}).success,false);
 assert.equal(body.safeParse({...valid,createdAt:'2026-01-01'}).success,false);
 assert.equal(body.safeParse({...valid,type:'he'}).success,true);
 assert.equal(body.safeParse({...valid,type:'frag'}).success,false);
});

test('solo exec requires typed destinations and one common origin',()=>{
 const multi={...valid,type:'solo_exec',origin:{x:.2,y:.3},target:{x:.4,y:.5},destinations:[{x:.4,y:.5,type:'smoke'},{x:.6,y:.7,type:'flashbang'}]};
 assert.equal(createBody.safeParse(multi).success,true);
 assert.equal(createBody.safeParse({...multi,destinations:[]}).success,false);
 assert.equal(createBody.safeParse({...multi,origin:null}).success,false);
 assert.equal(createBody.safeParse({...valid,destinations:multi.destinations}).success,false);
 assert.equal(createBody.safeParse({...multi,destinations:[{x:2,y:.5,type:'smoke'}]}).success,false);
});


test('he is accepted as a grenade type, solo exec destination and list filter',()=>{
 assert.equal(createBody.safeParse({...valid,type:'he'}).success,true);
 assert.equal(patchBody.safeParse({type:'he'}).success,true);
 const solo={...valid,type:'solo_exec',origin:{x:.2,y:.3},target:{x:.4,y:.5},destinations:[{x:.4,y:.5,type:'he'}]};
 assert.equal(createBody.safeParse(solo).success,true);
 assert.equal(createBody.safeParse({...solo,destinations:[{x:.4,y:.5,type:'frag'}]}).success,false);
 assert.equal(filters.safeParse({type:'he'}).success,true);
 assert.equal(filters.safeParse({type:'frag'}).success,false);
});

test('solo exec patch rejects contradictory explicit fields',()=>{
 assert.equal(patchBody.safeParse({type:'solo_exec',destinations:null}).success,false);
 assert.equal(patchBody.safeParse({type:'solo_exec',origin:null}).success,false);
 assert.equal(patchBody.safeParse({type:'smoke',destinations:[{x:.1,y:.2,type:'smoke'}]}).success,false);
 assert.equal(patchBody.safeParse({instructions:'alteração sem mudar destinos'}).success,true);
});
