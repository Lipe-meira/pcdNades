import {test} from 'node:test';import assert from 'node:assert/strict';
import {extractorArgs,selectProgressiveFormat,readTikTokEnabled,encodeSectionArgs} from '../src/import-runtime.js';
test('extractor uses only metadata, fixed extractors and an explicit authenticated proxy',()=>{
 const args=extractorArgs('https://vt.tiktok.com/Abcdef/','http://token:@127.0.0.1:1234');
 assert.ok(args.includes('--ignore-config'));assert.ok(args.includes('--no-plugin-dirs'));assert.ok(args.includes('--skip-download'));assert.ok(args.includes('--dump-single-json'));
 assert.equal(args[args.indexOf('--proxy')+1],'http://token:@127.0.0.1:1234');assert.equal(args.at(-2),'--');
 assert.equal(args[args.indexOf('--use-extractors')+1],'^tiktok$,^vm\\.tiktok$');
 assert.throws(()=>extractorArgs('https://evil.test/','http://token:@127.0.0.1:1234'));
});
test('selects a bounded progressive MP4; rejects manifests, DRM, credentials and external hosts',()=>{
 const f={url:'https://v16.tiktokcdn.com/video.mp4?secret=1',protocol:'https',ext:'mp4',vcodec:'h264',acodec:'aac',width:576,height:1024};
 assert.equal(selectProgressiveFormat({formats:[f]}).url,f.url);
 for(const patch of [{protocol:'m3u8_native'},{has_drm:true},{url:'https://127.0.0.1/x'},{url:'https://a:b@v16.tiktokcdn.com/x'},{url:'http://v16.tiktokcdn.com/x'},{width:4000},{acodec:'none'},{width:undefined},{height:NaN},{width:0.5},{vcodec:7},{vcodec:'unknown'}])assert.throws(()=>selectProgressiveFormat({formats:[{...f,...patch}]}));
});
test('encoder receives loopback only, fixed MOV demuxer, no external references and fixed output',()=>{
 const args=encodeSectionArgs('http://127.0.0.1:1234/random.mp4','C:/temp/out.mp4',{startSeconds:1800,endSeconds:1810},50000000);
 assert.equal(args[args.indexOf('-ss')+1],'1800');assert.ok(args.includes('mov'));assert.equal(args[args.indexOf('-enable_drefs')+1],'0');assert.equal(args[args.indexOf('-protocol_whitelist')+1],'http,tcp');
 assert.throws(()=>encodeSectionArgs('https://v16.tiktokcdn.com/x','out.mp4',{startSeconds:0,endSeconds:2},50000000));
});
test('TikTok opt-in defaults off and rejects ambiguous values',()=>{
 assert.equal(readTikTokEnabled({}),false);assert.equal(readTikTokEnabled({MEDIA_TIKTOK_IMPORT_ENABLED:'true'}),true);assert.throws(()=>readTikTokEnabled({MEDIA_TIKTOK_IMPORT_ENABLED:'1'}));
});
