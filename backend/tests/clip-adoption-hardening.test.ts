// R1/R2 da revisão independente do PR #20 (docs/REVISAO-PR20-20261112.md).
// R1: o objeto ADOTADO era validado só por probe (cabeçalho/moov); um MP4 truncado passava e era publicado como ready.
// R2: qualquer falha temporária durante a adoção (assinatura, download, info, timeout) virava `failed` terminal, e `complete` não recuperava a mídia.
import {test,describe,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLab,type Lab,MB} from './support/clip-lab.js';
import {ffmpegBinaryPath,decodeVideoOutcome,decodeVideo} from '../src/trimming.js';
import {probeOriginal,MediaError} from '../src/probe.js';

const expireLease=(lab:Lab,id:string)=>lab.db.query("update public.media_assets set locked_until=now()-interval '1 second' where id=$1 and status='processing'",[id]);
/** Primeira tentativa perde o lease depois de gravar clip.mp4 (E03): a próxima retentativa cai na ADOÇÃO. */
async function leaveStoredClip(lab:Lab){const id=await lab.newClipMedia();await lab.loseLeaseAtStoring(id,1);await lab.complete(id);await lab.clearFault();return id;}
const ffmpeg=(()=>{try{const p=ffmpegBinaryPath();return existsSync(p)?p:null;}catch{return null;}})();
const needFfmpeg=ffmpeg?{}:{skip:process.env.CI?false:'binário ffmpeg-static ausente (rode node scripts/prepare-ffmpeg.mjs); no CI ele é obrigatório'};
const asNotFound={message:'Object not found',statusCode:'404'};

describe('R1: o objeto adotado precisa decodificar por inteiro',()=>{
 let lab:Lab;
 beforeEach(async()=>{lab=await createLab();});
 afterEach(async()=>{await lab.close();});

 test('decodificação integral reprovada no arquivo BAIXADO: mídia failed, objeto preservado, nada publicado',async()=>{
  const id=await leaveStoredClip(lab);const key=`${id}/clip.mp4`,before=lab.storage.objects.get(key);
  lab.deps.decode=async(path:string)=>{lab.decodeCalls.push(path);return path.endsWith('stored.mp4')?'invalid' as const:'ok' as const;};
  const r=await lab.complete(id);
  assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'STORED_CLIP_INVALID');assert.equal(r.asset.storage_key,`${id}/source.mp4`);
  assert.equal(lab.storage.objects.get(key),before,'objeto intacto');assert.deepEqual(lab.storage.removed,[]);
  assert.ok(lab.decodeCalls.length>0&&lab.decodeCalls.every(p=>p.endsWith('stored.mp4')),`decodificou ${lab.decodeCalls.join(',')}: precisa ser o arquivo baixado do Storage`);
  const a=await lab.accounting(id);assert.equal(a.charged,100*MB);assert.ok(a.physical<=a.charged);
 });

 test('o objeto só é adotado depois da decodificação integral (ordem: baixar, probe, decodificar, publicar)',async()=>{
  const id=await leaveStoredClip(lab);const order:string[]=[];
  const probe=lab.deps.probe;lab.deps.probe=async(...a:any[])=>{order.push('probe');return probe(...a);};
  lab.deps.decode=async()=>{order.push('decode');return 'ok' as const;};
  const r=await lab.complete(id);assert.equal(r.asset.status,'ready');assert.deepEqual(order,['probe','decode']);
 });

 test('a decodificação respeita o cancelamento do prazo da tentativa (recebe o AbortSignal)',async()=>{
  const id=await leaveStoredClip(lab);let received:unknown;
  lab.deps.decode=async(_p:string,signal:AbortSignal)=>{received=signal;return 'ok' as const;};
  await lab.complete(id);assert.ok(received instanceof AbortSignal);
 });

 describe('com FFmpeg real',needFfmpeg,()=>{
  let dir:string,good:Buffer,truncated:Buffer;
  beforeEach(async()=>{
   dir=await mkdtemp(join(tmpdir(),'pcdn-r1-'));const file=join(dir,'good.mp4');
   execFileSync(ffmpeg!,['-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=25','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart','-y',file]);
   good=await readFile(file);truncated=good.subarray(0,Math.floor(good.length*0.65));
  });
  afterEach(async()=>{await rm(dir,{recursive:true,force:true});});

  test('fixture: o probe aceita o MP4 truncado, a decodificação integral recusa',async()=>{
   const bad=join(dir,'truncated.mp4');await writeFile(bad,truncated);
   const meta=await probeOriginal(bad,{maxBytes:50*MB,maxDurationSeconds:90},new AbortController().signal);assert.equal(Math.round(meta.durationSeconds),2);
   assert.equal(await decodeVideoOutcome(bad,new AbortController().signal),'invalid');
   await assert.rejects(decodeVideo(bad,new AbortController().signal),(e:any)=>e.code==='INVALID_MEDIA');
   const ok=join(dir,'ok.mp4');await writeFile(ok,good);assert.equal(await decodeVideoOutcome(ok,new AbortController().signal),'ok');
  });

  test('MP4 de cabeçalho válido e conteúdo truncado NÃO é publicado na adoção; objeto original preservado',async()=>{
   const id=await leaveStoredClip(lab);const key=`${id}/clip.mp4`;lab.storage.objects.set(key,truncated.length);
   lab.deps.download=async(_u:string,path:string)=>{await writeFile(path,path.endsWith('stored.mp4')?truncated:Buffer.alloc(50_000));};
   lab.deps.probe=probeOriginal;lab.deps.decode=decodeVideoOutcome;
   const r=await lab.complete(id);
   assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'STORED_CLIP_INVALID');assert.equal(r.asset.storage_key,`${id}/source.mp4`);
   assert.equal(lab.storage.objects.get(key),truncated.length);assert.deepEqual(lab.storage.removed,[]);
   const a=await lab.accounting(id);assert.equal(a.charged,100*MB);
  });

  test('controle positivo: o mesmo caminho adota um MP4 íntegro e cobra os bytes do objeto',async()=>{
   const id=await leaveStoredClip(lab);const key=`${id}/clip.mp4`;lab.storage.objects.set(key,good.length);
   lab.deps.download=async(_u:string,path:string)=>{await writeFile(path,path.endsWith('stored.mp4')?good:Buffer.alloc(50_000));};
   lab.deps.probe=probeOriginal;lab.deps.decode=decodeVideoOutcome;lab.config.clipDuration=2;
   const r=await lab.complete(id);assert.equal(r.asset.status,'ready');assert.equal(r.asset.metadata.bytes,good.length);
  });
 });

 test('decodeVideoOutcome: cancelamento é transitório, nunca "conteúdo inválido"',async()=>{
  const c=new AbortController();c.abort();assert.equal(await decodeVideoOutcome('inexistente.mp4',c.signal),'transient');
 });
});

describe('R2: falha temporária durante a adoção não torna a mídia irrecuperável',()=>{
 let lab:Lab;
 beforeEach(async()=>{lab=await createLab();});
 afterEach(async()=>{await lab.close();});

 const recovers=async(id:string)=>{
  const mid=await lab.row(id);
  assert.equal(mid.status,'processing','nada de failed definitivo');assert.equal(Number(mid.storage_charge_bytes),100*MB,'reserva retida');assert.equal(mid.storage_key,`${id}/source.mp4`);
  assert.ok(lab.storage.objects.has(`${id}/clip.mp4`),'objeto preservado');assert.deepEqual(lab.storage.removed,[]);
  await expireLease(lab,id);
  const r=await lab.complete(id);assert.equal(r.status,200);assert.equal(r.asset.status,'ready');
  const a=await lab.accounting(id);assert.equal(a.physical,a.charged);assert.equal(a.keys.length,2);return r;
 };
 const transient=(e:any)=>e.statusCode===503&&e.code==='STORAGE_UNAVAILABLE';

 test('falha única ao assinar a leitura do objeto: 503 temporário e a próxima chamada conclui',async()=>{
  const id=await leaveStoredClip(lab);let fail=true;const api=lab.client.storage.from();
  const original=api.createSignedUrl;api.createSignedUrl=async(p:string)=>{if(fail&&p.endsWith('clip.mp4')){fail=false;return {data:null,error:{message:'boom'}};}return original(p);};
  await assert.rejects(lab.complete(id),transient);await recovers(id);api.createSignedUrl=original;
 });

 test('falha única no download do objeto: 503 temporário e a próxima chamada conclui',async()=>{
  const id=await leaveStoredClip(lab);const real=lab.deps.download;let fail=true;
  lab.deps.download=async(u:string,p:string)=>{if(fail&&p.endsWith('stored.mp4')){fail=false;throw new Error('STORAGE_UNAVAILABLE');}return real(u,p);};
  await assert.rejects(lab.complete(id),transient);await recovers(id);
 });

 test('falha de infraestrutura na decodificação (não conteúdo): 503 temporário e a próxima chamada conclui',async()=>{
  const id=await leaveStoredClip(lab);let fail=true;
  lab.deps.decode=async()=>{if(fail){fail=false;return 'transient' as const;}return 'ok' as const;};
  await assert.rejects(lab.complete(id),transient);await recovers(id);
 });

 test('info ambíguo (não é "objeto inexistente") ao decidir pela adoção: 503 temporário e a próxima chamada conclui',async()=>{
  const id=await leaveStoredClip(lab);const api=lab.client.storage.from();const original=api.info;let fail=true;
  api.info=async(p:string)=>{if(fail&&p.endsWith('clip.mp4')){fail=false;return {data:null,error:{message:'socket hang up',statusCode:'503'}};}return original(p);};
  await assert.rejects(lab.complete(id),transient);await recovers(id);api.info=original;
 });

 test('cancelamento por prazo durante a adoção também deixa a mídia recuperável',async()=>{
  const id=await leaveStoredClip(lab);const real=lab.deps.download;let fail=true;
  lab.deps.download=async(u:string,p:string)=>{if(fail&&p.endsWith('stored.mp4')){fail=false;throw new MediaError('PROCESSING_TIMEOUT');}return real(u,p);};
  await assert.rejects(lab.complete(id),transient);await recovers(id);
 });

 test('prazo de 110 s REALMENTE esgotado durante a adoção (sinal abortado): 503 temporário, sem failed, e a próxima chamada conclui',async t=>{
  const id=await leaveStoredClip(lab);const real=lab.deps.download;let fire=true;
  lab.deps.download=async(u:string,p:string)=>{if(fire&&p.endsWith('stored.mp4')){fire=false;t.mock.timers.tick(110_000);throw new Error('STORAGE_UNAVAILABLE');}return real(u,p);};
  t.mock.timers.enable({apis:['setTimeout']});
  try{await assert.rejects(lab.complete(id),transient);}finally{t.mock.timers.reset();}
  await recovers(id);
 });

 test('falha genuína de gravação (objeto inexistente) continua terminal, como antes',async()=>{
  const id=await lab.newClipMedia();lab.config.storeFault=async()=>{throw new MediaError('STORAGE_UNAVAILABLE');};
  const r=await lab.complete(id);assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'STORAGE_UNAVAILABLE');
 });

 test('conteúdo comprovadamente inválido continua terminal e `failed` não é reaberto por novas chamadas',async()=>{
  const id=await leaveStoredClip(lab);lab.config.probeError='INVALID_MEDIA';
  const first=await lab.complete(id);assert.equal(first.asset.status,'failed');assert.equal(first.asset.error.code,'STORED_CLIP_INVALID');
  lab.config.probeError=undefined;const before={counts:lab.counts(),decodes:lab.decodeCalls.length,stores:[...lab.storage.stores]};
  for(let i=0;i<3;i++){const r=await lab.complete(id);assert.equal(r.asset.status,'failed');}
  assert.deepEqual(lab.counts(),before.counts);assert.equal(lab.decodeCalls.length,before.decodes);assert.deepEqual(lab.storage.stores,before.stores);
 });

 test('retomada limitada: falhas temporárias repetidas esgotam as tentativas (ATTEMPTS_EXHAUSTED), sem novo objeto nem liberar reserva',async()=>{
  const id=await leaveStoredClip(lab);const real=lab.deps.download;
  lab.deps.download=async(u:string,p:string)=>{if(p.endsWith('stored.mp4'))throw new Error('STORAGE_UNAVAILABLE');return real(u,p);};
  await assert.rejects(lab.complete(id),transient);assert.equal((await lab.row(id)).attempts,2);
  await expireLease(lab,id);await assert.rejects(lab.complete(id),transient);assert.equal((await lab.row(id)).attempts,3);
  await expireLease(lab,id);const last=await lab.complete(id);
  assert.equal(last.asset.status,'failed');assert.equal(last.asset.error.code,'ATTEMPTS_EXHAUSTED');
  const a=await lab.accounting(id);assert.equal(a.charged,100*MB);assert.equal(a.keys.length,2);assert.ok(a.physical<=a.charged);assert.deepEqual(lab.storage.removed,[]);
 });

 test('lease ainda ativo: chamada seguinte à falha temporária devolve 202 sem trabalho; só depois do lease retoma',async()=>{
  const id=await leaveStoredClip(lab);const real=lab.deps.download;let fail=true;
  lab.deps.download=async(u:string,p:string)=>{if(fail&&p.endsWith('stored.mp4')){fail=false;throw new Error('STORAGE_UNAVAILABLE');}return real(u,p);};
  await assert.rejects(lab.complete(id),transient);const before=lab.counts();
  const busy=await lab.complete(id);assert.equal(busy.status,202);assert.deepEqual(lab.counts(),before);
 });

 test('tentativa antiga com falha temporária não altera a linha da tentativa nova',async()=>{
  const id=await leaveStoredClip(lab);let snapshot:any;
  lab.deps.download=async(_u:string,p:string)=>{
   if(p.endsWith('stored.mp4')){ // outra instância assume a mídia enquanto esta tentativa (antiga) lê o objeto
    await lab.db.query("update public.media_assets set attempts=attempts+1,locked_until=now()+interval '2 minutes' where id=$1",[id]);
    snapshot=await lab.row(id);throw new Error('STORAGE_UNAVAILABLE');
   }
   await writeFile(p,Buffer.alloc(50_000));
  };
  await assert.rejects(lab.complete(id),transient);
  assert.deepEqual(await lab.row(id),snapshot,'a tentativa antiga não escreveu nada');
 });
});
