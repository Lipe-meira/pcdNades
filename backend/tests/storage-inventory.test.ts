// Inventário e dry-run de objetos do Storage x contabilidade SQL. SOMENTE LEITURA: não existe caminho de exclusão.
import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildInventory,loadSnapshot,type Snapshot,type MediaRow,type ObjectRow} from '../src/storage-inventory.js';
import {createDb,seedUsers,ids} from './support/pg.js';

const NOW=new Date('2026-11-12T20:00:00Z');
const TTL=60,GRACE=60+30+600; // ttl + tolerância + margem padrão = 690 s
const ago=(seconds:number)=>new Date(NOW.getTime()-seconds*1000).toISOString();
const A='aaaaaaaa-0000-4000-8000-000000000001',B='bbbbbbbb-0000-4000-8000-000000000002',C='cccccccc-0000-4000-8000-000000000003';
const media=(o:Partial<MediaRow>&{id:string}):MediaRow=>({status:'ready',source_type:'upload',storage_key:`${o.id}/source.mp4`,clip:null,attempts:1,locked_until:null,created_at:ago(7200),updated_at:ago(7200),storage_charge_bytes:0,contributor_id:null,...o});
const obj=(name:string,size:number,age=7200):ObjectRow=>({name,size,created_at:ago(age),updated_at:ago(age)});
const snap=(s:Partial<Snapshot>):Snapshot=>({media:[],objects:[],publishedMediaIds:[],liveImportSourceMediaIds:[],...s});
const opts={now:NOW,signedUploadTtlSeconds:TTL};
const item=(r:ReturnType<typeof buildInventory>,key:string)=>r.items.find(i=>i.key===key)!;

// Forma deixada pelo código ANTERIOR à correção (e ainda gerada por worker/importações): clip-1 sem referência.
const legacyE03=()=>snap({
 media:[media({id:A,storage_key:`${A}/clip-2.mp4`,contributor_id:'c1',clip:{startSeconds:1,endSeconds:3},attempts:2,storage_charge_bytes:231_586})],
 objects:[obj(`${A}/source.mp4`,175_766),obj(`${A}/clip-1.mp4`,55_820),obj(`${A}/clip-2.mp4`,55_820)]
});

describe('classificação e contabilidade',()=>{
 test('reproduz a diferença do E03: 55.820 B físicos fora da cobrança, com o objeto exato apontado',()=>{
  const r=buildInventory(legacyE03(),opts);
  assert.equal(r.accounting.contributor.physicalBytes,287_406);assert.equal(r.accounting.contributor.chargedBytes,231_586);assert.equal(r.accounting.contributor.unaccountedBytes,55_820);
  assert.deepEqual(r.accounting.contributor.mediaWithGap.map(m=>({id:m.mediaId,gap:m.gapBytes})),[{id:A,gap:55_820}]);
  assert.equal(item(r,`${A}/clip-1.mp4`).class,'attempt_output_unreferenced');
  assert.equal(item(r,`${A}/clip-2.mp4`).class,'current_reference');assert.equal(item(r,`${A}/clip-2.mp4`).verdict,'keep');
  assert.equal(item(r,`${A}/source.mp4`).class,'source_retained');assert.equal(item(r,`${A}/source.mp4`).verdict,'keep');
 });

 test('uma leitura só nunca confirma candidato; duas leituras idênticas confirmam',()=>{
  const first=buildInventory(legacyE03(),opts);
  assert.equal(item(first,`${A}/clip-1.mp4`).verdict,'candidate_unconfirmed');
  assert.ok(!first.items.some(i=>i.verdict==='candidate'),'sem segunda leitura não há candidato confirmado');
  const second=buildInventory(legacyE03(),{...opts,previous:legacyE03()});
  assert.equal(item(second,`${A}/clip-1.mp4`).verdict,'candidate');assert.equal(second.totals.candidateBytes,55_820);
 });

 test('objeto que mudou entre as duas leituras fica bloqueado',()=>{
  const before=legacyE03();before.objects.find(o=>o.name===`${A}/clip-1.mp4`)!.size=1;
  const r=buildInventory(legacyE03(),{...opts,previous:before});
  assert.equal(item(r,`${A}/clip-1.mp4`).verdict,'blocked');assert.ok(item(r,`${A}/clip-1.mp4`).reasons.includes('changed_between_reads'));
  const gone=legacyE03();gone.objects=gone.objects.filter(o=>o.name!==`${A}/clip-1.mp4`);
  assert.ok(item(buildInventory(legacyE03(),{...opts,previous:gone}),`${A}/clip-1.mp4`).reasons.includes('changed_between_reads'));
  const rowChanged=legacyE03();rowChanged.media[0].updated_at=ago(10);
  assert.ok(item(buildInventory(legacyE03(),{...opts,previous:rowChanged}),`${A}/clip-1.mp4`).reasons.includes('changed_between_reads'));
 });

 test('objeto dentro da janela da URL assinada (TTL + tolerância + margem) está bloqueado; fora dela não',()=>{
  const young=(age:number)=>{const s=legacyE03();s.objects.find(o=>o.name===`${A}/clip-1.mp4`)!.created_at=ago(age);s.objects.find(o=>o.name===`${A}/clip-1.mp4`)!.updated_at=ago(age);return s;};
  assert.ok(item(buildInventory(young(GRACE-1),opts),`${A}/clip-1.mp4`).reasons.includes('inside_signed_url_window'));
  assert.equal(item(buildInventory(young(GRACE+1),opts),`${A}/clip-1.mp4`).verdict,'candidate_unconfirmed');
  // mesma idade, TTL maior: a janela acompanha o TTL MEDIDO (nenhum valor é fixo)
  assert.ok(item(buildInventory(young(GRACE+1),{...opts,signedUploadTtlSeconds:7200}),`${A}/clip-1.mp4`).reasons.includes('inside_signed_url_window'));
 });

 test('atividade recente na linha da mídia bloqueia, mesmo com o objeto antigo',()=>{
  const s=legacyE03();s.media[0].updated_at=ago(5);
  assert.ok(item(buildInventory(s,opts),`${A}/clip-1.mp4`).reasons.includes('inside_signed_url_window'));
 });

 for(const [name,patch,reason] of [
  ['fila','queued','media_in_progress'],['processamento','processing','media_in_progress'],['aguardando upload','awaiting_upload','awaiting_upload']
 ] as const)test(`mídia em ${name} bloqueia qualquer candidato`,()=>{
  const s=legacyE03();s.media[0].status=patch;
  const r=buildInventory(s,opts);assert.equal(item(r,`${A}/clip-1.mp4`).verdict,'blocked');assert.ok(item(r,`${A}/clip-1.mp4`).reasons.includes(reason));
  assert.equal(r.totals.candidateBytes,0);
 });

 test('lease ativo e fonte de importação válida bloqueiam',()=>{
  const leased=legacyE03();leased.media[0].locked_until=new Date(NOW.getTime()+60000).toISOString();
  assert.ok(item(buildInventory(leased,opts),`${A}/clip-1.mp4`).reasons.includes('lease_active'));
  const imp=legacyE03();imp.liveImportSourceMediaIds=[A];
  assert.ok(item(buildInventory(imp,opts),`${A}/clip-1.mp4`).reasons.includes('import_source_live'));
 });

 test('objeto referenciado (publicado ou não) nunca é candidato, em nenhum estado da linha',()=>{
  for(const status of ['ready','failed','queued','processing','awaiting_upload']){
   const s=snap({media:[media({id:B,status,storage_key:`${B}/clip.mp4`})],objects:[obj(`${B}/clip.mp4`,10),obj(`${B}/source.mp4`,20)],publishedMediaIds:status==='ready'?[B]:[]});
   const r=buildInventory(s,{...opts,previous:s});
   assert.equal(item(r,`${B}/clip.mp4`).verdict,'keep',status);assert.equal(r.totals.candidateBytes,0,status);
  }
 });

 test('mídia publicada: só o objeto extra e sem referência pode ser candidato; o publicado é preservado',()=>{
  const s=legacyE03();s.publishedMediaIds=[A];
  const r=buildInventory(s,{...opts,previous:legacyE03()});
  assert.equal(item(r,`${A}/clip-2.mp4`).verdict,'keep');assert.equal(item(r,`${A}/clip-1.mp4`).verdict,'candidate');
  assert.ok(item(r,`${A}/clip-1.mp4`).reasons.includes('media_published_other_object'));
 });

 test('saída determinística sem referência (mídia failed) é candidata só depois da janela; a fonte nunca',()=>{
  const s=snap({media:[media({id:A,status:'failed',storage_key:`${A}/source.mp4`,contributor_id:'c1',storage_charge_bytes:100_000_000})],objects:[obj(`${A}/source.mp4`,50_000),obj(`${A}/clip.mp4`,20_000)]});
  const r=buildInventory(s,opts);
  assert.equal(item(r,`${A}/clip.mp4`).class,'deterministic_output_unreferenced');assert.equal(item(r,`${A}/clip.mp4`).verdict,'candidate_unconfirmed');
  assert.equal(item(r,`${A}/source.mp4`).verdict,'keep');
  assert.equal(r.accounting.contributor.unaccountedBytes,0,'reserva máxima retida cobre fonte + saída');
 });

 test('objeto sem linha, fonte sem referência e nome fora do padrão ficam para revisão humana, nunca candidatos',()=>{
  const s=snap({media:[media({id:B,storage_key:`${B}/clip.mp4`})],objects:[obj(`${C}/clip-1.mp4`,5),obj(`${C}/source.mp4`,6),obj('solto.mp4',7),obj(`${B}/clip.mp4`,8),obj(`${B}/source.mp4`,9),obj(`${B}/outro.bin`,10)]});
  const r=buildInventory(s,{...opts,previous:s});
  for(const k of [`${C}/clip-1.mp4`,`${C}/source.mp4`,'solto.mp4',`${B}/outro.bin`])assert.equal(item(r,k).verdict,'review',k);
  assert.equal(item(r,`${C}/clip-1.mp4`).class,'no_media_row');assert.equal(item(r,'solto.mp4').class,'unrecognized_name');
  assert.equal(r.accounting.noRowBytes,11);assert.equal(r.totals.candidateBytes,0);
 });

 test('mídia de administrador não entra na cobrança colaborativa e é reportada à parte',()=>{
  const s=snap({media:[media({id:B,storage_key:`${B}/playback-2.mp4`,contributor_id:null,storage_charge_bytes:0})],objects:[obj(`${B}/source.mp4`,100),obj(`${B}/playback-1.mp4`,40),obj(`${B}/playback-2.mp4`,40)]});
  const r=buildInventory(s,opts);
  assert.equal(r.accounting.contributor.physicalBytes,0);assert.equal(r.accounting.contributor.unaccountedBytes,0);assert.equal(r.accounting.adminPhysicalBytes,180);
  assert.equal(item(r,`${B}/playback-1.mp4`).class,'attempt_output_unreferenced');
 });

 test('tamanhos vindos do banco como texto/bigint são somados corretamente',()=>{
  const s=snap({media:[media({id:A,contributor_id:'c1',storage_charge_bytes:'100000000' as any})],objects:[{name:`${A}/source.mp4`,size:'175766' as any,created_at:ago(7200),updated_at:ago(7200)}]});
  const r=buildInventory(s,opts);assert.equal(r.accounting.contributor.physicalBytes,175_766);assert.equal(r.accounting.contributor.chargedBytes,100_000_000);
 });

 test('o relatório declara dry-run, zero ações destrutivas e que totais por classe fecham com o total',()=>{
  const r=buildInventory(legacyE03(),opts);
  assert.equal(r.dryRun,true);assert.equal(r.destructiveActions,0);
  assert.equal(Object.values(r.totals.byClass).reduce((n,c)=>n+c.bytes,0),r.totals.bytes);assert.equal(r.totals.bytes,287_406);
  assert.equal(r.parameters.graceSeconds,GRACE);
 });

 test('exige o TTL efetivo MEDIDO: sem ele (ou inválido) não gera relatório',()=>{
  for(const ttl of [undefined,0,-5,NaN,'60'])assert.throws(()=>buildInventory(legacyE03(),{now:NOW,signedUploadTtlSeconds:ttl as any}),/TTL/);
 });
});

describe('leitura do banco',()=>{
 test('loadSnapshot lê tudo em uma transação somente leitura e não escreve nada',async()=>{
  const db=await createDb();await seedUsers(db);
  await db.exec("create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now())");
  await db.query('select * from public.register_contributor($1,$2)',[ids.anonA,'Ana']);
  const id=crypto.randomUUID();
  await db.query("insert into public.media_assets(id,owner_id,source_type,storage_key) values($1,$2,'upload',$3)",[id,ids.anonA,`${id}/source.mp4`]);
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('videos-staging',$1,'{\"size\":175766}'),('outro-bucket',$2,'{\"size\":1}')",[`${id}/source.mp4`,`${id}/x.mp4`]);
  const before=(await db.query<any>('select count(*)::int n from storage.objects')).rows[0].n;
  const snapshot=await loadSnapshot(db as any);
  assert.equal(snapshot.objects.length,1,'só o bucket videos-staging');assert.equal(Number(snapshot.objects[0].size),175_766);
  assert.equal(snapshot.media.length,1);assert.equal(snapshot.media[0].id,id);assert.equal(Number(snapshot.media[0].storage_charge_bytes),50_000_000);
  assert.equal((await db.query<any>('select count(*)::int n from storage.objects')).rows[0].n,before);
  await db.close();
 });

 test('o inventário não contém nenhum caminho de exclusão ou escrita',async()=>{
  for(const file of ['../src/storage-inventory.ts','../scripts/storage-inventory.ts']){
   const text=await readFile(new URL(file,import.meta.url),'utf8');
   for(const forbidden of [/\.remove\(/,/\bunlink\b/,/\brm\(/,/delete\s+from/i,/\binsert\s+into/i,/\bupdate\s+public/i,/\btruncate\b/i,/\bdrop\s+/i])assert.ok(!forbidden.test(text),`${file} contém ${forbidden}`);
   assert.match(text,/read only/i,`${file} deve declarar a transação somente leitura`);
  }
 });
});
