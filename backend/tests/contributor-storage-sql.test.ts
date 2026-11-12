// S1 (revisão do PR #19): orçamento de BYTES no banco (PostgreSQL real via PGlite). Cobre reserva atômica por mídia,
// limite de pendentes, orçamento por contribuidor e global, conciliação ao ficar pronta, abandonos e administrador isolado.
// Limite: PGlite é uma única conexão; a atomicidade multiconexão depende dos advisory locks e NÃO é provada aqui.
import {test,describe,before,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createPrADb,createDb,applyStorageMigration,asRole,ids,seedUsers,seedMap,rollbacksDir,STORAGE_MIGRATION,CONTRIBUTORS_MIGRATION} from './support/pg.js';

const MB=1_000_000;
const register=async(db:PGlite,uid:string,nick='Fulano')=>(await db.query<{id:string}>('select * from public.register_contributor($1,$2)',[uid,nick])).rows[0].id;
const clip={startSeconds:1,endSeconds:3};
type Opts={clip?:boolean};
const newMedia=async(db:PGlite,owner:string,o:Opts={})=>(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key,clip) values($1,$2,$3,$4) returning id,storage_charge_bytes',[owner,'upload',`${crypto.randomUUID()}/source.mp4`,o.clip?JSON.stringify(clip):null])).rows[0];
const toReady=async(db:PGlite,id:string,meta:Record<string,unknown>)=>{
 await db.query("update public.media_assets set status='queued' where id=$1",[id]);
 await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);
 await db.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[id,JSON.stringify({durationSeconds:10,mimeType:'video/mp4',...meta})]);
};
const toFailed=async(db:PGlite,id:string)=>{
 await db.query("update public.media_assets set status='queued' where id=$1",[id]);
 await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);
 await db.query("update public.media_assets set status='failed',locked_until=null,error='{\"code\":\"INVALID_MEDIA\"}' where id=$1",[id]);
};
/** Mídia pronta que ocupa `bytes` (reserva máxima na entrada, conciliada ao ficar pronta). */
const readyMedia=async(db:PGlite,owner:string,bytes:number)=>{const m=await newMedia(db,owner);await toReady(db,m.id,{bytes});return m.id;};
const charge=async(db:PGlite,id:string)=>Number((await db.query<any>('select storage_charge_bytes c from public.media_assets where id=$1',[id])).rows[0].c);
const total=async(db:PGlite)=>Number((await db.query<any>('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets where contributor_id is not null')).rows[0].t);
// media_state carimba updated_at=now() em todo UPDATE; para envelhecer a linha de verdade desligamos os triggers só neste UPDATE.
const age=async(db:PGlite,id:string,interval:string)=>{await db.exec('alter table public.media_assets disable trigger user');try{await db.query(`update public.media_assets set created_at=now()-interval '${interval}',updated_at=now()-interval '${interval}' where id=$1`,[id]);}finally{await db.exec('alter table public.media_assets enable trigger user');}};

describe('S1 — migration por cima do PR A',()=>{
 test('aditiva: nenhuma linha existente muda e o backend do PR A continua inserindo mídia',async()=>{
  const db=await createPrADb();await seedUsers(db);
  const cid=await register(db,ids.anonA);
  const old=(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key) values($1,$2,$3) returning id',[ids.anonA,'upload','a/source.mp4'])).rows[0].id;
  const adminOld=(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key) values($1,$2,$3) returning id',[ids.admin,'upload','b/source.mp4'])).rows[0].id;
  const before=(await db.query<any>('select * from public.media_assets order by id')).rows;
  await applyStorageMigration(db);
  const after=(await db.query<any>('select * from public.media_assets order by id')).rows;
  assert.equal(after.length,before.length);
  for(const b of before){const {storage_charge_bytes,...rest}=after.find((a:any)=>a.id===b.id);assert.equal(Number(storage_charge_bytes),0);assert.deepEqual(rest,b);}
  assert.ok(old&&adminOld&&cid);
  await db.close();
 });
 test('o rollback devolve as funções do PR A e preserva mídias',async()=>{
  const db=await createDb();await seedUsers(db);
  await register(db,ids.anonA);const id=await readyMedia(db,ids.anonA,2*MB);
  await db.exec(await readFile(rollbacksDir+STORAGE_MIGRATION.replace('.sql','_rollback.sql'),'utf8'));
  assert.equal((await db.query<any>("select count(*)::int n from information_schema.columns where table_name='media_assets' and column_name='storage_charge_bytes'")).rows[0].n,0);
  assert.equal((await db.query<any>('select count(*)::int n from public.media_assets where id=$1',[id])).rows[0].n,1);
  // volta ao comportamento do PR A: sem pendentes/bytes; a cota de quantidade segue valendo
  for(let i=0;i<3;i++)await db.query('insert into public.media_assets(owner_id,source_type,storage_key) values($1,$2,$3)',[ids.anonA,'upload',`${crypto.randomUUID()}/source.mp4`]);
  assert.equal((await db.query<any>("select count(*)::int n from pg_proc where proname in ('contributor_storage_report','contributor_reclaim_candidates','media_charge','import_limit')")).rows[0].n,0);
  // o rollback do PR A ainda se aplica depois (ordem inversa)
  await db.exec(await readFile(rollbacksDir+CONTRIBUTORS_MIGRATION.replace('.sql','_rollback.sql'),'utf8'));
  await db.close();
 });
});

describe('S1 — reserva e conciliação de bytes',()=>{
 let db:PGlite,a:string,b:string;
 before(async()=>{db=await createDb();await seedUsers(db);a=await register(db,ids.anonA,'Ana');b=await register(db,ids.anonB,'Bia');});
 beforeEach(async()=>{await db.exec('delete from public.media_assets');});

 test('reserva máxima na entrada: upload 50 MB; upload com corte 100 MB (fonte + trecho); administrador 0',async()=>{
  assert.equal(Number((await newMedia(db,ids.anonA)).storage_charge_bytes),50*MB);
  const c=await newMedia(db,ids.anonB,{clip:true});assert.equal(Number(c.storage_charge_bytes),100*MB);
  assert.equal(Number((await newMedia(db,ids.admin,{clip:true})).storage_charge_bytes),0);
 });
 test('o chamador não define nem altera a cobrança (nem service_role)',async()=>{
  const forged=(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key,storage_charge_bytes) values($1,$2,$3,1) returning id,storage_charge_bytes',[ids.anonA,'upload',`${crypto.randomUUID()}/source.mp4`])).rows[0];
  assert.equal(Number(forged.storage_charge_bytes),50*MB);
  await db.query('update public.media_assets set storage_charge_bytes=0 where id=$1',[forged.id]);
  assert.equal(await charge(db,forged.id),50*MB);
  const admin=(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key,storage_charge_bytes) values($1,$2,$3,5) returning id',[ids.admin,'upload',`${crypto.randomUUID()}/source.mp4`])).rows[0];
  assert.equal(await charge(db,admin.id),0);
 });
 test('ao ficar pronta a cobrança vira o tamanho real (nunca sobe acima da reserva)',async()=>{
  const m=await newMedia(db,ids.anonA);await toReady(db,m.id,{bytes:7*MB});
  assert.equal(await charge(db,m.id),7*MB);
  // não pode ser inflada depois
  await db.query("update public.media_assets set metadata=metadata||'{\"bytes\":49000000}' where id=$1",[m.id]);
  assert.equal(await charge(db,m.id),7*MB);
 });
 test('corte: trecho + fonte real (sourceBytes); sem sourceBytes assume a fonte máxima (50 MB)',async()=>{
  const c1=await newMedia(db,ids.anonA,{clip:true});await toReady(db,c1.id,{bytes:3*MB,sourceBytes:12*MB});
  assert.equal(await charge(db,c1.id),15*MB);
  const c2=await newMedia(db,ids.anonA,{clip:true});await toReady(db,c2.id,{bytes:3*MB});
  assert.equal(await charge(db,c2.id),53*MB);
  const c3=await newMedia(db,ids.anonB,{clip:true});await toReady(db,c3.id,{bytes:3*MB,sourceBytes:999*MB}); // valor absurdo: ignorado
  assert.equal(await charge(db,c3.id),53*MB);
 });
 test('mídia que falha mantém a reserva inteira: o objeto pode continuar no Storage',async()=>{
  const m=await newMedia(db,ids.anonA);await toFailed(db,m.id);
  assert.equal(await charge(db,m.id),50*MB);
 });
 test('importações (RPC) também são cobradas: 50 MB e vínculo ao contribuidor',async()=>{
  const src=(await db.query<any>("insert into public.import_sources(owner_id,metadata) values($1,$2) returning id",[ids.anonA,JSON.stringify({provider:'tiktok',sourceUrl:'https://www.tiktok.com/@c/video/1',videoId:'1',title:'t',author:'a',durationSeconds:100})])).rows[0].id;
  const m=(await db.query<any>('select * from public.create_tiktok_import($1,$2,$3)',[src,ids.anonA,JSON.stringify(clip)])).rows[0];
  assert.equal(Number(m.storage_charge_bytes),50*MB);assert.equal(m.contributor_id,a);
 });
});

describe('S1 — limites (pendentes, por contribuidor, global)',()=>{
 let db:PGlite,a:string,b:string,c:string;
 before(async()=>{db=await createDb();await seedUsers(db);a=await register(db,ids.anonA,'Ana');b=await register(db,ids.anonB,'Bia');c=await register(db,ids.anonC,'Caio');});
 beforeEach(async()=>{await db.exec('delete from public.media_assets');});

 test('no máximo 2 pendentes por contribuidor; o terceiro é recusado e nada é criado',async()=>{
  await newMedia(db,ids.anonA);await newMedia(db,ids.anonA);
  await assert.rejects(newMedia(db,ids.anonA),/CONTRIBUTOR_PENDING_LIMIT/);
  assert.equal((await db.query<any>('select count(*)::int n from public.media_assets where contributor_id=$1',[a])).rows[0].n,2);
  await newMedia(db,ids.anonB); // outro contribuidor não é afetado
 });
 test('pronta ou falha liberam o slot de pendente, mas os bytes continuam cobrados',async()=>{
  const m1=await newMedia(db,ids.anonA);const m2=await newMedia(db,ids.anonA);
  await toReady(db,m1.id,{bytes:4*MB});await toFailed(db,m2.id);
  await newMedia(db,ids.anonA); // slot livre
  assert.equal(await charge(db,m1.id)+await charge(db,m2.id),54*MB);
 });
 test('upload abandonado: o slot libera após a janela das URLs assinadas (150 min), a reserva de bytes NÃO',async()=>{
  const m1=await newMedia(db,ids.anonA);const m2=await newMedia(db,ids.anonA);
  await age(db,m1.id,'149 minutes');
  await assert.rejects(newMedia(db,ids.anonA),/CONTRIBUTOR_PENDING_LIMIT/); // URL ainda pode estar válida
  await age(db,m1.id,'151 minutes');await age(db,m2.id,'151 minutes');
  await newMedia(db,ids.anonA); // slot reaberto
  assert.equal(await charge(db,m1.id),50*MB); // objeto pode existir: reserva mantida até limpeza comprovada
 });
 test('mídia em fila/processamento continua pendente mesmo antiga (nunca some do limite)',async()=>{
  const m1=await newMedia(db,ids.anonA);await db.query("update public.media_assets set status='queued' where id=$1",[m1.id]);await age(db,m1.id,'5 hours');
  const m2=await newMedia(db,ids.anonA);await db.query("update public.media_assets set status='queued' where id=$1",[m2.id]);
  await assert.rejects(newMedia(db,ids.anonA),/CONTRIBUTOR_PENDING_LIMIT/);
 });
 test('orçamento por contribuidor (150 MB): a reserva do novo upload precisa caber',async()=>{
  for(let i=0;i<3;i++)await readyMedia(db,ids.anonA,49*MB); // 147 MB reais
  await assert.rejects(newMedia(db,ids.anonA),/CONTRIBUTOR_STORAGE_EXCEEDED/); // 147 + reserva de 50 > 150
  await newMedia(db,ids.anonB); // outro contribuidor tem o seu próprio orçamento
 });
 test('orçamento por contribuidor conta fonte + trecho de corte',async()=>{
  await readyMedia(db,ids.anonA,49*MB);await readyMedia(db,ids.anonA,49*MB);
  const m=await newMedia(db,ids.anonA,{clip:true}).catch(e=>e);
  assert.match(String(m.message??''),/CONTRIBUTOR_STORAGE_EXCEEDED/); // 98 + 100 > 150
 });
 test('orçamento GLOBAL (400 MB) vale entre identidades; administrador não é afetado',async()=>{
  // 8 mídias reais de 45 MB (3 identidades) = 360 MB; a próxima reserva (50 MB) estoura 400 MB.
  const owners=[ids.anonA,ids.anonA,ids.anonA,ids.anonB,ids.anonB,ids.anonB,ids.anonC,ids.anonC];
  for(const o of owners)await readyMedia(db,o,45*MB);
  assert.equal(await total(db),360*MB);
  await assert.rejects(newMedia(db,ids.anonC),/CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED/);
  // identidades novas não ampliam o orçamento
  await db.query('insert into auth.users(id,is_anonymous) values($1,true)',['00000000-0000-4000-8000-0000000000d1']);
  await register(db,'00000000-0000-4000-8000-0000000000d1','Novo');
  await assert.rejects(newMedia(db,'00000000-0000-4000-8000-0000000000d1'),/CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED/);
  // administrador: upload (inclusive com corte) segue permitido e não é contabilizado
  const adm=await newMedia(db,ids.admin,{clip:true});assert.equal(Number(adm.storage_charge_bytes),0);
  assert.equal(await total(db),360*MB);
 });
 test('o limite global de pendentes (10) vale entre identidades',async()=>{
  // 10 pendentes distintos: cada contribuidor tem 2 → precisa de 5 contribuidores
  const extra:string[]=[];
  for(let i=1;i<=3;i++){const u=`00000000-0000-4000-8000-0000000000e${i}`;await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[u]);await register(db,u,`Extra ${i}`);extra.push(u);}
  const owners=[ids.anonA,ids.anonB,ids.anonC,...extra];
  let pending=0;
  for(const o of owners){for(let i=0;i<2;i++){try{await newMedia(db,o);pending++;}catch(e:any){assert.match(e.message,/CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED|CONTRIBUTOR_PENDING_LIMIT/);}}}
  assert.ok(pending<=8,`pendentes aceitos: ${pending}`); // 8 × 50 MB = 400 MB: o orçamento global também limita
  assert.ok(await total(db)<=400*MB);
 });
 test('limpeza manual comprovada devolve o orçamento: apagar a linha libera os bytes',async()=>{
  const m=await newMedia(db,ids.anonA);await toFailed(db,m.id);
  assert.equal(await total(db),50*MB);
  await db.query('delete from public.media_assets where id=$1',[m.id]);
  assert.equal(await total(db),0);
 });
 test('a soma nunca passa do orçamento global nem por sequências de tentativas (propriedade)',async()=>{
  const users=[ids.anonA,ids.anonB,ids.anonC];
  let seed=7;const rnd=(n:number)=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n;};
  for(let i=0;i<120;i++){
   const u=users[rnd(3)];
   try{
    const m=await newMedia(db,u,{clip:rnd(2)===0});
    const r=rnd(4);
    if(r===0)await toReady(db,m.id,{bytes:(1+rnd(49))*MB,...(rnd(2)?{sourceBytes:(1+rnd(49))*MB}:{})});
    else if(r===1)await toFailed(db,m.id);
    else if(r===2)await age(db,m.id,'200 minutes');
   }catch(e:any){assert.match(e.message,/CONTRIBUTOR_/);}
   assert.ok(await total(db)<=400*MB,`global ${await total(db)} na iteração ${i}`);
   for(const x of [a,b,c])assert.ok(Number((await db.query<any>('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets where contributor_id=$1',[x])).rows[0].t)<=150*MB);
  }
 });
});

describe('S1 — abandonados: listagem somente leitura e relatório',()=>{
 let db:PGlite,a:string;
 before(async()=>{db=await createDb();await seedUsers(db);await seedMap(db);a=await register(db,ids.anonA,'Ana');await register(db,ids.anonB,'Bia');});
 beforeEach(async()=>{await db.exec('delete from public.grenades');await db.exec('delete from public.media_assets');});

 test('candidatos: só awaiting_upload/failed antigos de contribuidor; nunca pronta, recente nem administrativa',async()=>{
  const old=await newMedia(db,ids.anonA);await age(db,old.id,'4 hours');
  const failed=await newMedia(db,ids.anonA);await toFailed(db,failed.id);await age(db,failed.id,'4 hours');
  const recent=await newMedia(db,ids.anonB);
  const ready=await readyMedia(db,ids.anonB,3*MB);await age(db,ready,'4 hours');
  const adminOld=await newMedia(db,ids.admin);await age(db,adminOld.id,'4 hours');
  const r=(await db.query<any>('select * from public.contributor_reclaim_candidates()')).rows;
  assert.deepEqual(r.map((x:any)=>x.media_id).sort(),[old.id,failed.id].sort());
  assert.ok(!r.some((x:any)=>[recent.id,ready,adminOld.id].includes(x.media_id)));
  // carência mínima: nunca antes das URLs assinadas expirarem, mesmo se o operador pedir menos
  const tooSoon=(await db.query<any>('select * from public.contributor_reclaim_candidates(1)')).rows.map((x:any)=>x.media_id);
  assert.ok(!tooSoon.includes(recent.id));
  const middle=await newMedia(db,ids.anonB);await age(db,middle.id,'100 minutes');
  assert.ok(!(await db.query<any>('select * from public.contributor_reclaim_candidates(1)')).rows.some((x:any)=>x.media_id===middle.id));
 });
 test('a listagem não altera nada (cobrança e linhas idênticas)',async()=>{
  const m=await newMedia(db,ids.anonA);await age(db,m.id,'5 hours');
  const before=(await db.query<any>('select * from public.media_assets order by id')).rows;
  await db.query('select * from public.contributor_reclaim_candidates()');await db.query('select public.contributor_storage_report()');
  assert.deepEqual((await db.query<any>('select * from public.media_assets order by id')).rows,before);
 });
 test('relatório: orçamento, cobrado, pendentes e bytes de não finalizados',async()=>{
  const m=await newMedia(db,ids.anonA);const f=await newMedia(db,ids.anonA);await toFailed(db,f.id);
  const rep=(await db.query<any>('select public.contributor_storage_report() r')).rows[0].r;
  assert.equal(rep.budgetBytes,400*MB);assert.equal(rep.chargedBytes,100*MB);assert.equal(rep.pending,1);assert.equal(rep.unfinishedBytes,100*MB);
  assert.ok(m);
 });
 test('anon/authenticated não executam as funções; service_role sim',async()=>{
  for(const role of ['anon','authenticated'] as const)for(const fn of ['select * from public.contributor_reclaim_candidates()','select public.contributor_storage_report()','select private.media_charge(\'upload\',null)'])
   await assert.rejects(asRole(db,role,{sub:ids.admin},()=>db.query(fn)),/permission denied/);
  await asRole(db,'service_role',null,()=>db.query('select * from public.contributor_reclaim_candidates()'));
 });
});
