import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDownloadMode,temporaryDownloadArgs,processFailure,encodeTemporaryArgs} from '../src/import-temporary.js';

test('temporary download is explicit, native-only, pinned to one info file and output',()=>{
 assert.equal(readDownloadMode({}),'range');assert.equal(readDownloadMode({MEDIA_TIKTOK_DOWNLOAD_MODE:'temporary'}),'temporary');
 assert.throws(()=>readDownloadMode({MEDIA_TIKTOK_DOWNLOAD_MODE:'auto'}));
 const args=temporaryDownloadArgs('private-info.json','source.mp4','http://token:@127.0.0.1:1234');
 assert.equal(args[args.indexOf('--downloader')+1],'native');
 assert.equal(args[args.indexOf('--load-info-json')+1],'private-info.json');
 assert.equal(args[args.indexOf('--output')+1],'source.mp4');assert.ok(args.includes('--no-part'));assert.ok(args.includes('--no-continue'));
 assert.equal(args[args.indexOf('--max-filesize')+1],'50000000');
 assert.ok(!args.includes('--cookies'));assert.ok(!args.includes('--exec'));assert.ok(!args.includes('--download-sections'));
});

test('temporary encoder cannot open network references and honors late selection',()=>{
 const args=encodeTemporaryArgs('source.mp4','clip.mp4',{startSeconds:1800,endSeconds:1810},50000000);
 assert.equal(args[args.indexOf('-protocol_whitelist')+1],'file');assert.equal(args[args.indexOf('-f')+1],'mov');
 assert.equal(args[args.indexOf('-enable_drefs')+1],'0');assert.equal(args[args.indexOf('-ss')+1],'1800');assert.equal(args[args.indexOf('-t')+1],'10');
});

test('process diagnostics never expose URLs, cookies, signed queries or raw stderr',()=>{
 const privateMessage='ERROR: HTTP Error 403: forbidden https://signed.tiktokcdn.com/file?token=secret Cookie=private';
 const error=processFailure({stderr:privateMessage},new AbortController(), 'downloading');
 assert.equal(error.code,'IMPORT_ACCESS_DENIED');assert.equal(error.diagnostic?.httpStatus,403);
 assert.ok(!JSON.stringify(error).includes('secret'));assert.ok(!JSON.stringify(error).includes('private'));
 assert.equal(processFailure({killed:true},new AbortController(),'transcoding').code,'IMPORT_TIMEOUT');
 assert.equal(processFailure({stderr:'HTTP Error 500'},new AbortController(),'downloading').code,'IMPORT_HTTP_ERROR');
 const c=new AbortController();c.abort();assert.equal(processFailure({},c,'downloading').code,'IMPORT_TIMEOUT');
});

test('validation failures retain their public code without leaking raw error details',()=>{
 assert.equal(processFailure({code:'UNSUPPORTED_CODEC',message:'private path'},new AbortController(),'transcoding').code,'UNSUPPORTED_CODEC');
});
import {temporarySessionArgs,validateTemporarySource} from '../src/import-temporary.js';
test('native session retains protected extractor arguments, format and identity output',()=>{
 const args=temporarySessionArgs(['--skip-download','--dump-single-json','--proxy','http://token:@127.0.0.1:1234','--format','best','--','https://www.tiktok.com/@a/video/123'],'chosen-1','source.mp4');
 assert.ok(!args.includes('--skip-download'));assert.ok(!args.includes('--dump-single-json'));assert.ok(!args.includes('--load-info-json'));
 assert.equal(args[args.indexOf('--proxy')+1],'http://token:@127.0.0.1:1234');assert.equal(args[args.indexOf('--format')+1],'chosen-1');assert.equal(args[args.indexOf('--print')+1],'after_move:%(id)s');
 assert.throws(()=>temporarySessionArgs(['--format','best','--','url'],'best/other','file'));
});
test('temporary source validates rounded duration, codecs and matching selected dimensions',()=>{
 const info={format:{format_name:'mov,mp4',duration:'33.320635'},streams:[{codec_type:'video',codec_name:'hevc',width:1080,height:1920},{codec_type:'audio',codec_name:'aac'}]};
 validateTemporarySource(info,33,{width:1080,height:1920,videoCodec:'h265'});
 assert.throws(()=>validateTemporarySource(info,30,{width:1080,height:1920,videoCodec:'h265'}));
 assert.throws(()=>validateTemporarySource(info,33,{width:576,height:1024,videoCodec:'h265'}));
 assert.throws(()=>validateTemporarySource({...info,streams:[...info.streams,{codec_type:'attachment'}]},33,{width:1080,height:1920,videoCodec:'h265'}));
});
