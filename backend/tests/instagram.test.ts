import {test} from 'node:test';import assert from 'node:assert/strict';
import {allowedImportHost,pinnedAddress} from '../src/import-network.js';
import {instagramMetadata,instagramArgs,validateInstagramProbe} from '../src/instagram.js';
const raw={id:'DeILaFXzNvu',webpage_url:'https://www.instagram.com/reel/DeILaFXzNvu/',title:'Tutorial',uploader:'Autor'};
test('Instagram hosts are provider scoped; private and spoofed destinations are rejected',async()=>{
 assert.equal(allowedImportHost('www.instagram.com','instagram'),true);assert.equal(allowedImportHost('instagram.fnvt11-1.fna.fbcdn.net','instagram'),true);assert.equal(allowedImportHost('www.instagram.com','tiktok'),false);assert.equal(allowedImportHost('www.tiktok.com','instagram'),false);
 for(const h of ['fbcdn.net','evil.fbcdn.net','evil-instagram.com','www.instagram.com.evil.test','instagram.fnvt11-1.fna.fbcdn.net.evil.test','127.0.0.1'])assert.equal(allowedImportHost(h,'instagram'),false,h);
 await assert.rejects(pinnedAddress('www.instagram.com',async()=>['8.8.8.8','127.0.0.1'],'instagram'),/IMPORT_DESTINATION_DENIED/);
});
test('Reels metadata duration comes from validated source probe and canonical id',()=>{
 const m=instagramMetadata(raw,64.664717);assert.equal(m.durationSeconds,64.664717);assert.equal(m.provider,'instagram');
 for(const d of [NaN,0,-1,7201,Infinity])assert.throws(()=>instagramMetadata(raw,d));
 assert.throws(()=>instagramMetadata({...raw,id:'different'},64));assert.throws(()=>instagramMetadata({...raw,webpage_url:'https://instagram.com.evil.test/reel/DeILaFXzNvu/'},64));assert.throws(()=>instagramMetadata({...raw,is_live:true},64));
});
test('Instagram source probe rejects extra streams and unsupported codecs, oversized duration',()=>{
 const ok={format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2',duration:'64.664717'},streams:[{codec_type:'video',codec_name:'h264',width:1080,height:1920},{codec_type:'audio',codec_name:'aac'}]};assert.equal(validateInstagramProbe(ok),64.664717);
 assert.throws(()=>validateInstagramProbe({...ok,streams:[...ok.streams,{codec_type:'subtitle'}]}));assert.throws(()=>validateInstagramProbe({...ok,format:{...ok.format,duration:'7201'}}));assert.throws(()=>validateInstagramProbe({...ok,streams:[{...ok.streams[0],codec_name:'vp9'}]}));
});
test('Instagram extractor uses canonical source, proxy, restricted extractor and no login',()=>{
 const args=instagramArgs('https://www.instagram.com/reel/DeILaFXzNvu/?a=b','http://x:@127.0.0.1:1234');assert.equal(args.at(-1),'https://www.instagram.com/reel/DeILaFXzNvu/');assert.ok(args.includes('--ignore-config'));assert.ok(args.includes('--proxy'));assert.ok(args.includes('^instagram$'));assert.ok(!args.includes('--cookies'));assert.throws(()=>instagramArgs('https://www.tiktok.com/@a/video/1234567890','http://x:@127.0.0.1:1234'));
});

test('Instagram progressive format admits bounded canonical fbcdn without trusting headers', async()=>{
 const {instagramFormat}=await import('../src/instagram.js');const base={id:'DeILaFXzNvu',format_id:'3',protocol:'https',ext:'mp4',url:'https://instagram.fnvt11-1.fna.fbcdn.net/v/file.mp4'};assert.equal(instagramFormat(base),'3');
 for(const patch of [{format_id:'../escape'},{url:'https://www.instagram.com.evil.test/x'},{url:'http://instagram.fnvt11-1.fna.fbcdn.net/x'},{url:'https://evil.fbcdn.net/x'},{has_drm:true},{filesize:50000001}])assert.throws(()=>instagramFormat({...base,...patch}));
});


test('source probe disallows external references and non-file protocols',async()=>{
 const {instagramProbeArgs}=await import('../src/instagram.js');const args=instagramProbeArgs('source.mp4');
 assert.deepEqual(args.slice(args.indexOf('-protocol_whitelist'),args.indexOf('-protocol_whitelist')+2),['-protocol_whitelist','file']);
 assert.deepEqual(args.slice(args.indexOf('-format_whitelist'),args.indexOf('-format_whitelist')+2),['-format_whitelist','mov']);
 assert.deepEqual(args.slice(args.indexOf('-enable_drefs'),args.indexOf('-enable_drefs')+2),['-enable_drefs','0']);
 assert.deepEqual(args.slice(args.indexOf('-use_absolute_path'),args.indexOf('-use_absolute_path')+2),['-use_absolute_path','0']);
});

test('Instagram flag is independent and fails closed by default',async()=>{
 const {readInstagramEnabled}=await import('../src/import-runtime.js');
 assert.equal(readInstagramEnabled({}),false);assert.equal(readInstagramEnabled({MEDIA_INSTAGRAM_IMPORT_ENABLED:'false'}),false);assert.equal(readInstagramEnabled({MEDIA_INSTAGRAM_IMPORT_ENABLED:'true'}),true);assert.throws(()=>readInstagramEnabled({MEDIA_INSTAGRAM_IMPORT_ENABLED:'yes'}));
});
