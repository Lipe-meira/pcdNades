import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicIPv4, allowedImportHost, TransferBudget, pinnedAddress} from '../src/import-network.js';
import {importClipSchema, sourceMetadata, checkImportSelection} from '../src/tiktok.js';

test('egress denies private, reserved, mapped IPv6 and mixed DNS responses',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','192.0.0.1','198.18.0.1','224.0.0.1','255.255.255.255','::1','::ffff:8.8.8.8'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('8.8.8.8'),true);
 await assert.rejects(pinnedAddress('www.tiktok.com',async()=>['8.8.8.8','127.0.0.1']),/IMPORT_DESTINATION_DENIED/);
 let calls=0;const resolver=async()=>++calls===1?['8.8.8.8']:['127.0.0.1'];
 assert.equal(await pinnedAddress('www.tiktok.com',resolver),'8.8.8.8');
 await assert.rejects(pinnedAddress('www.tiktok.com',resolver),/IMPORT_DESTINATION_DENIED/);
});
test('host allowlist has label boundaries and disallows addresses and alternate ports',()=>{
 assert.equal(allowedImportHost('v16.tiktokcdn.com'),true);
 for(const h of ['localhost','127.0.0.1','tiktok.com.evil.test','evil-tiktok.com','www.tiktok.com:443','tiktok.com.'])assert.equal(allowedImportHost(h),false,h);
});
test('network budget aggregates retries, counts requests and aborts whole task on exhaustion',()=>{
 const c=new AbortController(),b=new TransferBudget(10,2,c);
 b.request();b.consume(6);b.request();b.consume(4);
 assert.throws(()=>b.consume(1),/IMPORT_NETWORK_LIMIT/);assert.equal(c.signal.aborted,true);
 const d=new TransferBudget(100,1,new AbortController());d.request();assert.throws(()=>d.request(),/IMPORT_NETWORK_LIMIT/);
});
test('import selection handles long sources without relaxing uploaded file rules',()=>{
 assert.equal(importClipSchema.safeParse({startSeconds:3600,endSeconds:3690}).success,true);
 for(const clip of [{startSeconds:0,endSeconds:90.001},{startSeconds:0,endSeconds:0.01},{startSeconds:NaN,endSeconds:2},{startSeconds:2.0001,endSeconds:3},{startSeconds:0,endSeconds:7201}])assert.equal(importClipSchema.safeParse(clip).success,false);
 assert.equal(checkImportSelection({startSeconds:3600,endSeconds:3690},4000),90);
 assert.throws(()=>checkImportSelection({startSeconds:3990,endSeconds:4001},4000),/CLIP_OUT_OF_RANGE/);
});
test('metadata requires finite bounded VOD and does not leak CDN URLs or raw extractor fields',()=>{
 const input={id:'7701366996495125766',title:'Tutorial',uploader:'Autor',duration:4000,webpage_url:'https://www.tiktok.com/@creator/video/7701366996495125766',url:'https://cdn.example/secret',http_headers:{Cookie:'secret'}};
 const m=sourceMetadata(input);assert.equal(m.durationSeconds,4000);assert.equal(m.author,'Autor');assert.ok(!JSON.stringify(m).includes('secret'));
 for(const extra of [{duration:7201},{duration:Infinity},{is_live:true},{live_status:'is_live'},{_type:'playlist'},{duration:0}])assert.throws(()=>sourceMetadata({...input,...extra}));
});
