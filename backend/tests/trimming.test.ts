import {test} from 'node:test';import assert from 'node:assert/strict';import {clipSchema} from '../src/importers.js';import {checkClip} from '../src/trimming.js';import {readTrimmingEnabled} from '../src/config.js';
test('clip boundaries90s and source180s with explicit fractional selection',()=>{
 for(const clip of [{startSeconds:0,endSeconds:90},{startSeconds:90,endSeconds:180},{startSeconds:0.125,endSeconds:0.225}]){assert.equal(clipSchema.safeParse(clip).success,true);assert.ok(checkClip(clip,180,90)>0);}
 for(const clip of [{startSeconds:0,endSeconds:90.001},{startSeconds:90,endSeconds:180.001},{startSeconds:0,endSeconds:0.099},{startSeconds:0.0001,endSeconds:1}])assert.equal(clipSchema.safeParse(clip).success,false);
 assert.throws(()=>checkClip({startSeconds:0,endSeconds:10},180.001,90),(e:any)=>e.code==='SOURCE_DURATION_EXCEEDED');
 assert.throws(()=>checkClip({startSeconds:9,endSeconds:11},10,90),(e:any)=>e.code==='CLIP_OUT_OF_RANGE');
});
test('trimming flag defaultsfalse and rejects ambiguous values',()=>{assert.equal(readTrimmingEnabled({}),false);assert.equal(readTrimmingEnabled({MEDIA_TRIMMING_ENABLED:'true'}),true);for(const v of ['','1','TRUE'])assert.throws(()=>readTrimmingEnabled({MEDIA_TRIMMING_ENABLED:v}));});
