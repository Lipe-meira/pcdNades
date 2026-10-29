import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readMediaLimits} from '../src/config.js';
import {buildApp} from '../src/application.js';
test('limits have documented defaults and accept explicit overrides',()=>{
 assert.deepEqual(readMediaLimits({}),{maxBytes:50000000,maxDurationSeconds:40});
 assert.deepEqual(readMediaLimits({MEDIA_MAX_BYTES:'1234',MEDIA_MAX_DURATION_SECONDS:'10'}),{maxBytes:1234,maxDurationSeconds:10});
});
test('invalid limits fail closed without exposing env values',()=>{
 for(const name of ['MEDIA_MAX_BYTES','MEDIA_MAX_DURATION_SECONDS'])for(const value of ['', '0','-1','1.2','Infinity','NaN','1e3',' 10','9007199254740992'])assert.throws(()=>readMediaLimits({[name]:value}),new RegExp(name));
});
test('capabilities publishes configured limits and startup rejects invalid env',async()=>{
 const before={bytes:process.env.MEDIA_MAX_BYTES,duration:process.env.MEDIA_MAX_DURATION_SECONDS};
 let app:ReturnType<typeof buildApp>|undefined;
 try{
 process.env.MEDIA_MAX_BYTES='1234';process.env.MEDIA_MAX_DURATION_SECONDS='10';app=buildApp();
 const upload=(await app.inject('/api/v1/media/capabilities')).json().data.upload;
 assert.equal(upload.maxBytes,1234);assert.equal(upload.maxDurationSeconds,10);
 process.env.MEDIA_MAX_BYTES='0';assert.throws(()=>buildApp(),/MEDIA_MAX_BYTES/);
 }finally{
 if(app)await app.close();
 for(const [name,value] of [['MEDIA_MAX_BYTES',before.bytes],['MEDIA_MAX_DURATION_SECONDS',before.duration]])if(value===undefined)delete process.env[name!];else process.env[name!]=value;
 }
});

test('duration may be reduced but never exceed 40 seconds',()=>{
 assert.equal(readMediaLimits({MEDIA_MAX_DURATION_SECONDS:'40'}).maxDurationSeconds,40);
 assert.throws(()=>readMediaLimits({MEDIA_MAX_DURATION_SECONDS:'41'}),/MEDIA_MAX_DURATION_SECONDS/);
});

import {readUploadEnabled} from '../src/config.js';
test('upload flag defaults off and rejects ambiguous env',()=>{
 assert.equal(readUploadEnabled({}),false);assert.equal(readUploadEnabled({MEDIA_UPLOAD_ENABLED:'false'}),false);assert.equal(readUploadEnabled({MEDIA_UPLOAD_ENABLED:'true'}),true);
 for(const value of ['','1','0','TRUE',' false'])assert.throws(()=>readUploadEnabled({MEDIA_UPLOAD_ENABLED:value}),/MEDIA_UPLOAD_ENABLED/);
});

test('50 MB hard ceiling is preserved',()=>{assert.throws(()=>readMediaLimits({MEDIA_MAX_BYTES:'50000001'}),/MEDIA_MAX_BYTES/);assert.equal(readMediaLimits({MEDIA_MAX_DURATION_SECONDS:'40'}).maxDurationSeconds,40);});
