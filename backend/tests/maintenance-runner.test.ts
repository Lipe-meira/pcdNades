import {test} from 'node:test';import assert from 'node:assert/strict';import {maintenanceRunner,maintenanceHealthy} from '../src/maintenance-runner.js';
test('independent health probe detects a dead process despite a previously healthy file',()=>{
 const now=Date.now(),h={status:'healthy',consecutiveFailures:0,lastSuccessAt:new Date(now).toISOString(),lastAttemptAt:new Date(now).toISOString()};
 assert.equal(maintenanceHealthy(h,now),true);assert.equal(maintenanceHealthy(h,now+240001),false);assert.equal(maintenanceHealthy({...h,status:'degraded'},now),false);assert.equal(maintenanceHealthy(null,now),false);
});
test('runner serializes cycles and reports failure then recovery without losing last success',async()=>{
 const controller=new AbortController(),reports:any[]=[];let clock=0,calls=0,active=0,max=0;
 await maintenanceRunner({now:()=>clock,sweep:async()=>{active++;max=Math.max(max,active);clock+=100;active--;if(++calls===2)throw Error('fixture');},report:async h=>{reports.push(h);if(reports.length===3)controller.abort();},sleep:async ms=>{assert.ok(ms<=180000);clock+=ms;}},controller.signal);
 assert.equal(max,1);assert.deepEqual(reports.map(h=>h.status),['healthy','degraded','healthy','stopped']);assert.equal(reports[1].lastSuccessAt,reports[0].lastSuccessAt);assert.equal(reports[2].consecutiveFailures,0);
});
test('cancellation stops waiting even when an adapter never settles',async()=>{
 const c=new AbortController();let stopped=false;
 await maintenanceRunner({now:()=>0,sweep:async()=>{queueMicrotask(()=>c.abort());return new Promise(()=>{});},report:async h=>{stopped=h.status==='stopped';},sleep:async()=>{}},c.signal);assert.equal(stopped,true);
});
test('leased expired backlog prevents a successful maintenance heartbeat',async()=>{
 const {runSourcePreviewMaintenance}=await import('../src/source-preview-supabase.js');let marked=0;
 const db:any={storage:{from:()=>({list:async()=>({data:[],error:null})})},rpc:(name:string)=>{if(name==='finish_preview_sweep')marked++;return {abortSignal:async()=>({data:name==='claim_preview_sweep'?true:null,error:null})};},from:()=>{const q:any={select:()=>q,lte:()=>q,limit:()=>q,abortSignal:async()=>({data:[{source_id:'leased-fixture'}],error:null})};return q;}};
 await assert.rejects(runSourcePreviewMaintenance(db,'https://project.supabase.test',new AbortController().signal),/PREVIEW_UNAVAILABLE/);assert.equal(marked,0);
});
test('shutdown abort is propagated and never becomes a success',async()=>{
 const c=new AbortController(),reports:any[]=[];
 await maintenanceRunner({now:()=>0,sweep:async signal=>{c.abort();assert.equal(signal.aborted,true);throw Error('cancelled');},report:async h=>{reports.push(h);},sleep:async()=>{throw Error('must not wait');}},c.signal);
 assert.equal(reports[0].status,'stopped');assert.equal(reports[0].lastSuccessAt,null);assert.equal(reports[0].overdue,true);
});
test('shutdown during the waiting period must not leave a healthy status behind',async()=>{
 const c=new AbortController(),reports:any[]=[];
 await maintenanceRunner({now:()=>1000000,sweep:async()=>{},report:async h=>{reports.push(h);},sleep:async()=>{c.abort();throw new Error('cancelled wait');}},c.signal);
 assert.equal(reports[0].status,'healthy');assert.equal(reports.at(-1).status,'stopped');assert.equal(maintenanceHealthy(reports.at(-1),1000000),false);
});
