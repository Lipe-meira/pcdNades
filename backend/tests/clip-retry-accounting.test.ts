// Contabilidade física de cortes em retentativas (achado E03 da validação integrada do PR #19).
// Causa: a chave do objeto dependia da tentativa (`clip-N.mp4`) e o banco guarda UMA só chave pronta; o objeto de uma tentativa
// que perdeu o lease ficava no Storage sem linha, sem cobrança e sem inventário.
// Correção: chave única por mídia (`<id>/clip.mp4`), `upsert:false` e ADOÇÃO verificada do objeto que já existe. Nada é apagado.
import {test,describe,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createLab,type Lab,MB} from './support/clip-lab.js';
import {MediaError} from '../src/probe.js';

const expireLease=(lab:Lab,id:string)=>lab.db.query("update public.media_assets set locked_until=now()-interval '1 second' where id=$1 and status='processing'",[id]);

describe('retentativas de corte: bytes físicos x cobrança SQL',()=>{
 let lab:Lab;
 beforeEach(async()=>{lab=await createLab();});
 afterEach(async()=>{await lab.close();});

 test('E03: lease perdido depois de gravar o corte e nova tentativa não deixam objeto fora da cobrança',async()=>{
  const id=await lab.newClipMedia();await lab.loseLeaseAtStoring(id,1);
  const first=await lab.complete(id);
  assert.equal(first.status,202,'a confirmação fenciada da 1ª tentativa deve falhar sem publicar');
  assert.equal(first.asset.status,'processing');
  assert.equal(first.asset.storage_key,`${id}/source.mp4`,'a falha fenciada não troca a referência');
  await lab.clearFault();
  const second=await lab.complete(id);
  assert.equal(second.status,200);assert.equal(second.asset.status,'ready');
  assert.equal(second.asset.attempts,2);assert.equal(second.asset.storage_key,`${id}/clip.mp4`);
  const a=await lab.accounting(id);
  assert.equal(a.physical,a.charged,`físico ${a.physical} B (${a.keys.join(', ')}) x cobrado ${a.charged} B`);
  assert.deepEqual(a.keys,[`${id}/clip.mp4`,`${id}/source.mp4`]);
  assert.deepEqual(lab.storage.removed,[],'nenhuma exclusão');
 });

 test('retentativa com codificação diferente adota o objeto existente: cobra os bytes do objeto real, nunca sobrescreve',async()=>{
  lab.config.trimSizes=[20_000,21_500];
  const id=await lab.newClipMedia();await lab.loseLeaseAtStoring(id,1);await lab.complete(id);await lab.clearFault();
  const r=await lab.complete(id);
  assert.equal(r.asset.status,'ready');assert.equal(r.asset.metadata.bytes,20_000,'bytes do objeto armazenado, não do corte local descartado');
  assert.equal(lab.storage.objects.get(`${id}/clip.mp4`),20_000);
  const a=await lab.accounting(id);assert.equal(a.physical,a.charged);assert.equal(a.charged,70_000);
  assert.deepEqual(lab.storage.stores,[`${id}/clip.mp4`,`${id}/clip.mp4`],'a mesma chave nas duas tentativas');
 });

 test('Storage gravou o objeto mas a resposta se perdeu: a mesma tentativa adota e termina pronta com um só objeto',async()=>{
  const id=await lab.newClipMedia();
  lab.config.storeFault=async key=>{lab.storage.objects.set(key,20_000);throw new MediaError('STORAGE_UNAVAILABLE');};
  const r=await lab.complete(id);
  assert.equal(r.asset.status,'ready');
  const a=await lab.accounting(id);assert.equal(a.physical,a.charged);assert.equal(a.keys.length,2);
 });

 test('banco indisponível na confirmação (ready e failed): retentativa adota, uma só saída e sem exclusão',async()=>{
  const id=await lab.newClipMedia();
  await lab.db.exec(`create function private.lab_db_down() returns trigger language plpgsql as $$ begin if new.id='${id}'::uuid and new.status in ('ready','failed') and new.attempts=1 then raise exception 'lab_db_down'; end if; return new; end $$;
   create trigger zz_lab_down before update on public.media_assets for each row execute function private.lab_db_down();`);
  await assert.rejects(lab.complete(id),(e:any)=>e.statusCode===503);
  assert.equal((await lab.row(id)).status,'processing');assert.equal(lab.storage.keysOf(`${id}/`).length,2,'o corte da 1ª tentativa já está no Storage');
  await lab.db.exec('drop trigger zz_lab_down on public.media_assets');await expireLease(lab,id);
  const r=await lab.complete(id);assert.equal(r.asset.status,'ready');
  const a=await lab.accounting(id);assert.equal(a.physical,a.charged);assert.deepEqual(lab.storage.removed,[]);
 });

 test('falha ANTES da gravação não deixa objeto; a retentativa grava exatamente um',async()=>{
  const id=await lab.newClipMedia();let boom=true;
  lab.config.storeFault=async()=>{if(boom){boom=false;throw new MediaError('STORAGE_UNAVAILABLE');}};
  const first=await lab.complete(id);assert.equal(first.asset.status,'failed');
  assert.deepEqual(lab.storage.keysOf(`${id}/`),[`${id}/source.mp4`]);
  const a=await lab.accounting(id);assert.ok(a.physical<=a.charged,'falha mantém a reserva máxima');
 });

 test('objeto publicado: repetir o complete não baixa, não grava, não apaga nem altera nada',async()=>{
  const id=await lab.newClipMedia();assert.equal((await lab.complete(id)).asset.status,'ready');
  const before={objects:new Map(lab.storage.objects),counts:lab.counts(),stores:[...lab.storage.stores],row:await lab.row(id)};
  for(let i=0;i<3;i++){const r=await lab.complete(id);assert.equal(r.status,200);}
  assert.deepEqual(lab.storage.objects,before.objects);assert.deepEqual(lab.counts(),before.counts);assert.deepEqual(lab.storage.stores,before.stores);
  assert.deepEqual(lab.storage.removed,[]);assert.deepEqual((await lab.row(id)).metadata,before.row.metadata);
 });

 test('objeto existente corrompido: falha a mídia, preserva o objeto e a reserva máxima',async()=>{
  const id=await lab.newClipMedia();lab.storage.objects.set(`${id}/clip.mp4`,12_345);lab.config.probeError='INVALID_MEDIA';
  const r=await lab.complete(id);
  assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'STORED_CLIP_INVALID');assert.equal(r.asset.storage_key,`${id}/source.mp4`);
  assert.equal(lab.storage.objects.get(`${id}/clip.mp4`),12_345,'não sobrescreve nem apaga o que não conseguiu provar');
  assert.deepEqual(lab.storage.removed,[]);
  const a=await lab.accounting(id);assert.equal(a.charged,100*MB);assert.ok(a.physical<=a.charged);
 });

 test('objeto existente com duração incompatível com o intervalo da mídia não é adotado',async()=>{
  const id=await lab.newClipMedia();lab.storage.objects.set(`${id}/clip.mp4`,20_000);
  const real=lab.deps.probe;lab.deps.probe=async()=>({...(await real()),durationSeconds:7});
  const r=await lab.complete(id);assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'STORED_CLIP_INVALID');
 });

 test('objeto existente grande demais é recusado antes de qualquer publicação',async()=>{
  const id=await lab.newClipMedia();lab.storage.objects.set(`${id}/clip.mp4`,20_000);
  lab.deps.download=async(_u:string,path:string)=>{if(path.endsWith('stored.mp4'))throw new Error('FILE_TOO_LARGE');await writeFile(path,Buffer.alloc(50_000));};
  const r=await lab.complete(id);assert.equal(r.asset.status,'failed');assert.equal(r.asset.error.code,'STORED_CLIP_INVALID');
 });

 test('três leases perdidos seguidos: a ocupação física nunca passa da cobrança e esgota sem criar novo objeto',async()=>{
  const id=await lab.newClipMedia();
  await lab.db.exec(`create function private.lab_lose_every() returns trigger language plpgsql as $$ begin if new.id='${id}'::uuid and new.stage='storing' then new.locked_until=now()-interval '1 second'; end if; return new; end $$;
   create trigger zz_lab_every before update on public.media_assets for each row execute function private.lab_lose_every();`);
  for(let i=1;i<=3;i++){const r=await lab.complete(id);assert.equal(r.status,202,`tentativa ${i}`);const a=await lab.accounting(id);assert.ok(a.physical<=a.charged,`tentativa ${i}: ${a.physical} > ${a.charged}`);assert.equal(a.keys.length,2);}
  const last=await lab.complete(id);assert.equal(last.asset.status,'failed');assert.equal(last.asset.error.code,'ATTEMPTS_EXHAUSTED');
  const a=await lab.accounting(id);assert.ok(a.physical<=a.charged);assert.equal(a.keys.length,2);
 });

 test('chamadas simultâneas: uma instância processa, a outra recusa; só existe um corte e a mídia fica pronta',async()=>{
  const id=await lab.newClipMedia();
  const results=await Promise.allSettled([lab.complete(id),lab.complete(id),lab.complete(id)]);
  assert.ok(results.some(r=>r.status==='fulfilled'&&r.value.asset.status==='ready'));
  for(const r of results)if(r.status==='rejected')assert.equal((r.reason as any).code,'PROCESSOR_BUSY');
  const a=await lab.accounting(id);assert.equal(a.physical,a.charged);assert.equal(a.keys.length,2);
 });

 test('as chaves de cada tentativa são derivadas do id: nenhuma outra chave por mídia aparece em nenhum cenário acima',async()=>{
  const id=await lab.newClipMedia();await lab.loseLeaseAtStoring(id,1);await lab.complete(id);await lab.clearFault();await lab.complete(id);
  for(const key of lab.storage.stores)assert.equal(key,`${id}/clip.mp4`);
 });
});
