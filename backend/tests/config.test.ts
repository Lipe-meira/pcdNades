import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readMediaLimits} from '../src/config.js';
import {buildApp} from '../src/app.js';
test('limits have documented defaults and accept explicit overrides',()=>{
 assert.deepEqual(readMediaLimits({}),{maxBytes:50000000,maxDurationSeconds:180});
 assert.deepEqual(readMediaLimits({MEDIA_MAX_BYTES:'1234',MEDIA_MAX_DURATION_SECONDS:'60'}),{maxBytes:1234,maxDurationSeconds:60});
});
test('invalid limits fail closed without exposing env values',()=>{
 for(const name of ['MEDIA_MAX_BYTES','MEDIA_MAX_DURATION_SECONDS'])for(const value of ['', '0','-1','1.2','Infinity','NaN','1e3',' 10','9007199254740992'])assert.throws(()=>readMediaLimits({[name]:value}),new RegExp(name));
});
test('capabilities publishes configured limits and startup rejects invalid env',async()=>{
 const before={bytes:process.env.MEDIA_MAX_BYTES,duration:process.env.MEDIA_MAX_DURATION_SECONDS};
 let app:ReturnType<typeof buildApp>|undefined;
 try{
 process.env.MEDIA_MAX_BYTES='1234';process.env.MEDIA_MAX_DURATION_SECONDS='60';app=buildApp();
 const upload=(await app.inject('/api/v1/media/capabilities')).json().data.upload;
 assert.equal(upload.maxBytes,1234);assert.equal(upload.maxDurationSeconds,60);
 process.env.MEDIA_MAX_BYTES='0';assert.throws(()=>buildApp(),/MEDIA_MAX_BYTES/);
 }finally{
 if(app)await app.close();
 for(const [name,value] of [['MEDIA_MAX_BYTES',before.bytes],['MEDIA_MAX_DURATION_SECONDS',before.duration]])if(value===undefined)delete process.env[name!];else process.env[name!]=value;
 }
});
