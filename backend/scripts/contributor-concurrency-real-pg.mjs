// Concorrência com PostgreSQL REAL e VÁRIAS CONEXÕES (embedded-postgres 17), para as cotas/orçamentos de contribuidores.
// NÃO é Supabase (sem GoTrue, PostgREST nem Storage) e NÃO roda no CI: é uma verificação local e descartável.
// Como rodar (sem Docker; nada é instalado no repositório):
//   1. mkdir <pasta-temporária> && cd <pasta-temporária> && npm init -y && npm i embedded-postgres@17.5.0-beta.15 pg@8
//   2. copie este arquivo para lá e rode:  BACKEND_DIR=<repo>/backend node contributor-concurrency-real-pg.mjs
// Prova de sensibilidade: remover os `pg_advisory_xact_lock` de media_contributor faz A, B, C e F falharem (soma chegou a 1000 MB).
// Stubs de papéis/auth idênticos aos de tests/support/pg.ts.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {readFileSync,readdirSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const repo=(process.env.BACKEND_DIR??'../backend').split('\\').join('/').replace(/\/?$/,'/');
const dataDir=join(tmpdir(),`pcdnades-realpg-${process.pid}`);
const stubs=/const supabaseStubs=`([\s\S]*?)`;/.exec(readFileSync(repo+'tests/support/pg.ts','utf8'))[1];
const MB=1e6;
const results=[];
const check=(name,ok,detail='')=>{results.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name} ${detail}`);};

rmSync(dataDir,{recursive:true,force:true});
const server=new EmbeddedPostgres({databaseDir:dataDir,user:'postgres',password:'postgres',port:54329,persistent:false,initdbFlags:['--encoding=UTF8','--locale=C']});
await server.initialise();await server.start();
const admin=new pg.Client({host:'localhost',port:54329,user:'postgres',password:'postgres',database:'postgres'});
await admin.connect();
try{
 const version=(await admin.query('select version() v')).rows[0].v;console.log(version);
 await admin.query('create database t');
 await admin.end();
 const base={host:'localhost',port:54329,user:'postgres',password:'postgres',database:'t'};
 const su=new pg.Client(base);await su.connect();
 await su.query(stubs);
 for(const f of readdirSync(repo+'migrations').filter(f=>f.endsWith('.sql')).sort())await su.query(readFileSync(repo+'migrations/'+f,'utf8'));
 const pool=new pg.Pool({...base,max:40});
 // cada conexão do pool age como service_role (o backend usa a service key)
 pool.on('connect',c=>c.query('set role service_role'));
 const adminId=randomUUID();
 await su.query('insert into auth.users(id,is_anonymous) values($1,false)',[adminId]);await su.query('insert into private.administrators(user_id) values($1)',[adminId]);
 const newContributor=async()=>{const u=randomUUID();await su.query('insert into auth.users(id,is_anonymous) values($1,true)',[u]);await su.query('select public.register_contributor($1,$2)',[u,'Amigo '+u.slice(0,4)]);return u;};
 // Cada tentativa é uma transação própria que SEGURA o lock por ~30 ms antes do commit: sem os advisory locks as demais enxergam o estado antigo e passam do limite.
const insertMedia=async(owner,clip=false)=>{const c=await pool.connect();try{await c.query('begin');await c.query('insert into public.media_assets(owner_id,source_type,storage_key,clip) values($1,$2,$3,$4)',[owner,'upload',`${randomUUID()}/source.mp4`,clip?JSON.stringify({startSeconds:1,endSeconds:3}):null]);await c.query('select pg_sleep(0.03)');await c.query('commit');return 'ok';}catch(e){await c.query('rollback').catch(()=>{});return e.message;}finally{c.release();}};
 const reset=async()=>{await su.query('delete from public.media_assets');await su.query('delete from public.import_sources');await su.query('delete from private.import_slot_usage');await su.query('update private.import_slot set holder=null,locked_until=null');};
 const tally=a=>a.reduce((m,x)=>(m[x]=(m[x]??0)+1,m),{});

 // A) pendentes por contribuidor: 16 conexões disputando o mesmo contribuidor, 30 rodadas
 let badA=0,deadlocks=0;
 for(let r=0;r<30;r++){
  await reset();const u=await newContributor();
  const out=await Promise.all(Array.from({length:16},()=>insertMedia(u)));
  const t=tally(out);deadlocks+=out.filter(x=>/deadlock/i.test(x)).length;
  if(t.ok!==2||(t['CONTRIBUTOR_PENDING_LIMIT']??0)!==14)badA++;
 }
 check('A) 16 inserts simultâneos do mesmo contribuidor: exatamente 2 pendentes (30 rodadas)',badA===0,`rodadas fora do esperado=${badA}`);

 // B) orçamento global/pendentes globais: 20 contribuidores, 1 insert simultâneo cada, 30 rodadas → no máximo 8 (400 MB)
 let badB=0,maxCharge=0;
 for(let r=0;r<30;r++){
  await reset();const users=[];for(let i=0;i<20;i++)users.push(await newContributor());
  const out=await Promise.all(users.map(u=>insertMedia(u)));
  const ok=out.filter(x=>x==='ok').length;deadlocks+=out.filter(x=>/deadlock/i.test(x)).length;
  const total=Number((await su.query('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets where contributor_id is not null')).rows[0].t);
  maxCharge=Math.max(maxCharge,total);
  if(ok!==8||total!==400*MB||out.some(x=>x!=='ok'&&!/CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED/.test(x)))badB++;
 }
 check('B) 20 identidades simultâneas: exatamente 8 reservas (400 MB), nunca mais (30 rodadas)',badB===0,`rodadas fora do esperado=${badB}, maior soma=${maxCharge/MB} MB`);

 // C) cota por hora (10): contribuidor com 9 mídias já criadas, 8 inserts simultâneos → exatamente 1
 let badC=0;
 for(let r=0;r<20;r++){
  await reset();const u=await newContributor();
  const cid=(await su.query('select contributor_id from public.contributor_links where auth_user_id=$1',[u])).rows[0].contributor_id;
  await su.query('alter table public.media_assets disable trigger media_contributor');
  for(let i=0;i<9;i++){ // 9 mídias PRONTAS (não pendentes), criadas agora: contam na cota horária
   const id=(await su.query("insert into public.media_assets(owner_id,contributor_id,source_type,storage_key) values($1,$2,'upload',$3) returning id",[u,cid,`${randomUUID()}/s.mp4`])).rows[0].id;
   await su.query("update public.media_assets set status='queued' where id=$1",[id]);
   await su.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);
   await su.query("update public.media_assets set status='ready',locked_until=null,metadata='{\"durationSeconds\":10,\"bytes\":1000,\"mimeType\":\"video/mp4\"}' where id=$1",[id]);
  }
  await su.query('alter table public.media_assets enable trigger media_contributor');
  const out=await Promise.all(Array.from({length:8},()=>insertMedia(u)));
  if(out.filter(x=>x==='ok').length!==1)badC++;
 }
 check('C) cota de 10 mídias/h com 9 existentes e 8 inserts simultâneos: exatamente 1 (20 rodadas)',badC===0,`rodadas fora do esperado=${badC}`);

 // D) reservas de inspeção: 4 contribuidores × 12 simultâneas + admin 30 simultâneas
 let badD=0;
 for(let r=0;r<15;r++){
  await reset();const users=[];for(let i=0;i<4;i++)users.push(await newContributor());
  const calls=[];for(const u of users)for(let i=0;i<12;i++)calls.push(pool.query('select * from public.reserve_import_source($1)',[u]).then(()=> 'ok',e=>e.message));
  for(let i=0;i<30;i++)calls.push(pool.query('select * from public.reserve_import_source($1)',[adminId]).then(()=> 'ok',e=>e.message));
  const out=await Promise.all(calls);deadlocks+=out.filter(x=>/deadlock/i.test(x)).length;
  const per=(await su.query('select owner_id,count(*)::int c from public.import_sources group by 1')).rows;
  const contrib=per.filter(x=>x.owner_id!==adminId);const adm=per.find(x=>x.owner_id===adminId)?.c??0;
  const contribTotal=contrib.reduce((s,x)=>s+x.c,0);
  if(contrib.some(x=>x.c>6)||contribTotal>20||adm!==20)badD++;
 }
 check('D) reservas simultâneas: contribuidor ≤6 cada, ≤20 somados; administrador sempre chega às suas 20 (15 rodadas)',badD===0,`rodadas fora do esperado=${badD}`);

 // E) slot: 12 contribuidores e o admin disputam o slot ao mesmo tempo → exatamente 1 dono
 let badE=0;
 for(let r=0;r<20;r++){
  await reset();const users=[];for(let i=0;i<12;i++)users.push(await newContributor());
  const owners=[...users,adminId];
  const out=await Promise.all(owners.map(o=>pool.query('select public.claim_import_slot($1,30,$2) ok',[randomUUID(),o]).then(x=>x.rows[0].ok,e=>e.message)));
  deadlocks+=out.filter(x=>typeof x==='string'&&/deadlock/i.test(x)).length;
  if(out.filter(x=>x===true).length!==1)badE++;
  const usage=Number((await su.query('select count(*) c from private.import_slot_usage')).rows[0].c);if(usage!==1)badE++;
 }
 check('E) 13 pedidos simultâneos do slot: exatamente 1 dono e 1 registro de uso (20 rodadas)',badE===0,`rodadas fora do esperado=${badE}`);

 // F) carga mista sem deadlock: inserts de mídia + reservas + slot + cadastro simultâneos
 await reset();
 const users=[];for(let i=0;i<10;i++)users.push(await newContributor());
 const mixed=[];
 for(let k=0;k<5;k++)for(const u of users){mixed.push(insertMedia(u,k%2===0));mixed.push(pool.query('select * from public.reserve_import_source($1)',[u]).then(()=> 'ok',e=>e.message));mixed.push(pool.query('select public.claim_import_slot($1,10,$2)',[randomUUID(),u]).then(()=> 'ok',e=>e.message));}
 const out=await Promise.all(mixed);deadlocks+=out.filter(x=>typeof x==='string'&&/deadlock/i.test(x)).length;
 const total=Number((await su.query('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets where contributor_id is not null')).rows[0].t);
 check('F) carga mista simultânea: soma de bytes ≤ 400 MB',total<=400*MB,`soma=${total/MB} MB`);
 // H) R2: complete TARDIO simultâneo. Contribuidor com 6 mídias awaiting_upload já fora da janela de 150 min (não contam como pendentes)
 //    + 1 INSERT novo ao mesmo tempo: no máximo 2 pendentes ao final, nada apagado, reserva de bytes intacta. Também com 2 contribuidores.
 const completeLate=async id=>{const c=await pool.connect();try{await c.query('begin');await c.query("update public.media_assets set status='queued' where id=$1 and status='awaiting_upload'",[id]);await c.query('select pg_sleep(0.03)');await c.query('commit');return 'ok';}catch(e){await c.query('rollback').catch(()=>{});return e.message;}finally{c.release();}};
 const agedMedia=async(owner,n)=>{ // linhas antigas criadas com o trigger de cotas desligado (só aqui, como superusuário)
  const cid=(await su.query('select contributor_id from public.contributor_links where auth_user_id=$1',[owner])).rows[0].contributor_id;const out=[];
  await su.query('alter table public.media_assets disable trigger user');
  for(let i=0;i<n;i++)out.push((await su.query("insert into public.media_assets(owner_id,contributor_id,source_type,storage_key,storage_charge_bytes,created_at,updated_at) values($1,$2,'upload',$3,50000000,now()-interval '151 minutes',now()-interval '151 minutes') returning id",[owner,cid,`${randomUUID()}/source.mp4`])).rows[0].id);
  await su.query('alter table public.media_assets enable trigger user');return out;};
 let badH=0;
 for(let r=0;r<25;r++){
  await reset();const u=await newContributor();const v=await newContributor();
  const old=await agedMedia(u,3),oldV=await agedMedia(v,3);
  const out=await Promise.all([...old.map(completeLate),...oldV.map(completeLate),insertMedia(u),insertMedia(v)]);
  deadlocks+=out.filter(x=>/deadlock/i.test(x)).length;
  const per=(await su.query("select owner_id,count(*)::int n from public.media_assets where status in ('queued','processing') or (status='awaiting_upload' and created_at>now()-interval '150 minutes') group by 1")).rows;
  const rows=Number((await su.query('select count(*) c from public.media_assets')).rows[0].c);
  const charged=Number((await su.query('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets')).rows[0].t);
  const unexpected=out.filter(x=>x!=='ok'&&!/CONTRIBUTOR_PENDING_LIMIT|CONTRIBUTOR_STORAGE_EXCEEDED|CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED/.test(x));
  if(per.some(x=>x.n>2)||unexpected.length||rows<6||charged<300*MB)badH++;
 }
 check('H) R2: 6 completes tardios + inserts simultâneos de 2 contribuidores: nunca mais de 2 pendentes cada, nada apagado, bytes intactos (25 rodadas)',badH===0,`rodadas fora do esperado=${badH}`);
 check('G) nenhum deadlock em toda a bateria',deadlocks===0,`deadlocks=${deadlocks}`);
 await pool.end();await su.end();
}finally{await server.stop();}
const failed=results.filter(r=>!r.ok);
console.log(JSON.stringify({engine:'PostgreSQL embedded (multi-conexão)',checks:results.length,failed:failed.length}));
process.exit(failed.length?1:0);
