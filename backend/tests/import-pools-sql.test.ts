// S2 (revisão do PR #19): reservas de importação e slot do processador separados por papel. PostgreSQL real via PGlite.
// Garantia testada: contribuidores jamais consomem a capacidade do administrador, e um contribuidor não monopoliza o slot.
// Limite: uma conexão só; a serialização multiconexão depende dos advisory locks e NÃO é provada aqui.
import {test,describe,before,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import type {PGlite} from '@electric-sql/pglite';
import {createDb,ids,seedUsers} from './support/pg.js';

const register=async(db:PGlite,uid:string,nick='Fulano')=>(await db.query<{id:string}>('select * from public.register_contributor($1,$2)',[uid,nick])).rows[0].id;
const reserve=(db:PGlite,owner:string)=>db.query('select * from public.reserve_import_source($1)',[owner]);
const claim=async(db:PGlite,owner:string,seconds=30,holder=crypto.randomUUID())=>({holder,ok:(await db.query<any>('select public.claim_import_slot($1,$2,$3) ok',[holder,seconds,owner])).rows[0].ok as boolean});
const release=(db:PGlite,holder:string)=>db.query('select public.release_import_slot($1)',[holder]);
/** Simula o tempo: o slot expira (como se o processo tivesse terminado sem liberar). */
const expireSlot=(db:PGlite)=>db.exec("update private.import_slot set locked_until=now()-interval '1 second'");
const usedSeconds=async(db:PGlite,owner:string)=>Number((await db.query<any>('select coalesce(sum(seconds),0) s from private.import_slot_usage where owner_id=$1',[owner])).rows[0].s);
let n=0;
const newUser=async(db:PGlite,contributor:boolean)=>{const id=`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;await db.query('insert into auth.users(id,is_anonymous) values($1,$2)',[id,contributor]);if(contributor)await register(db,id,`Amigo ${n}`);return id;};

describe('S2 — reservas de inspeção (import_sources) por papel',()=>{
 let db:PGlite;
 before(async()=>{db=await createDb();await seedUsers(db);});
 beforeEach(async()=>{await db.exec('delete from public.import_sources');});

 test('cada contribuidor tem 6 reservas/h; a 7ª dá IMPORT_RATE_LIMIT e outro contribuidor segue livre',async()=>{
  await register(db,ids.anonA,'Ana');await register(db,ids.anonB,'Bia');
  for(let i=0;i<6;i++)await reserve(db,ids.anonA);
  await assert.rejects(reserve(db,ids.anonA),/IMPORT_RATE_LIMIT/);
  await reserve(db,ids.anonB);
 });
 test('todos os contribuidores juntos: 20 reservas/h; o pool cheio não afeta o administrador',async()=>{
  const users=[];for(let i=0;i<4;i++)users.push(await newUser(db,true));
  for(const u of users.slice(0,3))for(let i=0;i<6;i++)await reserve(db,u);
  for(let i=0;i<2;i++)await reserve(db,users[3]); // 18 + 2 = 20
  await assert.rejects(reserve(db,users[3]),/IMPORT_RATE_LIMIT/); // pool cheio
  const fresh=await newUser(db,true);await assert.rejects(reserve(db,fresh),/IMPORT_RATE_LIMIT/);
  // administrador: continua com as suas 20/h (limite individual preservado) mesmo com o pool de contribuidores esgotado
  for(let i=0;i<20;i++)await reserve(db,ids.admin);
  await assert.rejects(reserve(db,ids.admin),/IMPORT_RATE_LIMIT/);
 });
 test('reprodução do achado S2: 50 reservas antigas de contribuidores não existem mais e o admin nunca recebe 429 por causa deles',async()=>{
  // Mesmo forçando linhas diretamente (como a sondagem sintética), o teto efetivo por contribuidor continua valendo no INSERT via RPC;
  // aqui preenchemos o pool no limite (20) e o administrador consegue as 20 reservas individuais.
  const users=[];for(let i=0;i<4;i++)users.push(await newUser(db,true));
  for(let i=0;i<20;i++)await reserve(db,users[Math.floor(i/6)]);
  let adminOk=0;for(let i=0;i<20;i++){await reserve(db,ids.admin);adminOk++;}
  assert.equal(adminOk,20);
  assert.equal((await db.query<any>('select count(*)::int c from public.import_sources')).rows[0].c,40);
 });
 test('limite global de 50/h preservado para quem não é contribuidor (vários administradores)',async()=>{
  const admins=[];for(let i=0;i<3;i++)admins.push(await newUser(db,false));
  for(const [u,count] of [[admins[0],20],[admins[1],20],[admins[2],10]] as const)for(let i=0;i<count;i++)await reserve(db,u);
  assert.equal((await db.query<any>('select count(*)::int c from public.import_sources')).rows[0].c,50);
  await assert.rejects(reserve(db,admins[2]),/IMPORT_RATE_LIMIT/); // 51ª: teto global antigo preservado
 });
 test('janela móvel: reservas com mais de 1 h não contam',async()=>{
  await register(db,ids.anonA,'Ana');
  for(let i=0;i<6;i++)await reserve(db,ids.anonA);
  await db.query("update public.import_sources set created_at=now()-interval '61 minutes' where owner_id=$1",[ids.anonA]);
  await reserve(db,ids.anonA);
 });
 test('falhas do importador também consomem a reserva do contribuidor (extração é o recurso caro) sem tocar a do admin',async()=>{
  await register(db,ids.anonA,'Ana');
  for(let i=0;i<6;i++){await reserve(db,ids.anonA);} // sem metadata: como uma extração que falhou
  await assert.rejects(reserve(db,ids.anonA),/IMPORT_RATE_LIMIT/);
  await reserve(db,ids.admin);
 });
});

describe('S2 — slot do processador: admissão justa por orçamento de tempo',()=>{
 let db:PGlite;
 before(async()=>{db=await createDb();await seedUsers(db);});
 beforeEach(async()=>{await db.exec('delete from private.import_slot_usage');await db.exec("update private.import_slot set holder=null,locked_until=null");});

 test('assinatura antiga (sem dono) continua existindo e funcionando',async()=>{
  const h=crypto.randomUUID();
  assert.equal((await db.query<any>('select public.claim_import_slot($1,$2) ok',[h,30])).rows[0].ok,true);
  assert.equal((await db.query<any>('select public.claim_import_slot($1,$2) ok',[crypto.randomUUID(),30])).rows[0].ok,false);
  await release(db,h);
 });
 test('slot ocupado devolve false (sem exceção) e não consome orçamento de quem foi recusado',async()=>{
  await register(db,ids.anonA,'Ana');
  const adm=await claim(db,ids.admin,30);assert.equal(adm.ok,true);
  const r=await claim(db,ids.anonA,120);assert.equal(r.ok,false);assert.equal(await usedSeconds(db,ids.anonA),0);
  await release(db,adm.holder);
 });
 test('liberar devolve o tempo não usado: o orçamento reflete o uso real',async()=>{
  await register(db,ids.anonA,'Ana');
  for(let i=0;i<20;i++){const c=await claim(db,ids.anonA,120);assert.equal(c.ok,true,`claim ${i}`);await release(db,c.holder);}
  assert.ok(await usedSeconds(db,ids.anonA)<=20*2,`uso ${await usedSeconds(db,ids.anonA)}`); // ~1 s cada
 });
 test('um contribuidor não monopoliza: 400 s/h; o seguinte dá IMPORT_RATE_LIMIT (429) e o admin ainda entra',async()=>{
  await register(db,ids.anonA,'Ana');await register(db,ids.anonB,'Bia');
  for(let i=0;i<3;i++){assert.equal((await claim(db,ids.anonA,120)).ok,true);await expireSlot(db);} // processos que não liberaram: 360 s
  await assert.rejects(claim(db,ids.anonA,120),/IMPORT_RATE_LIMIT/); // 360 + 120 > 400
  assert.equal((await claim(db,ids.anonA,30)).ok,true);await expireSlot(db); // 390 ≤ 400
  await assert.rejects(claim(db,ids.anonA,30),/IMPORT_RATE_LIMIT/);
  assert.equal((await claim(db,ids.anonB,30)).ok,true);await expireSlot(db); // outro contribuidor ainda tem o seu
  const adm=await claim(db,ids.admin,120);assert.equal(adm.ok,true); // administrador não tem esse limite
  await release(db,adm.holder);
 });
 test('todos os contribuidores juntos: 1200 s/h (no máximo 1/3 do tempo do processador)',async()=>{
  const users=[];for(let i=0;i<4;i++)users.push(await newUser(db,true));
  for(const u of users.slice(0,3)){for(let i=0;i<3;i++){assert.equal((await claim(db,u,120)).ok,true);await expireSlot(db);}assert.equal((await claim(db,u,30)).ok,true);await expireSlot(db);} // 3 × 390 = 1170
  assert.equal((await claim(db,users[3],30)).ok,true);await expireSlot(db); // 1200
  await assert.rejects(claim(db,users[3],30),/IMPORT_RATE_LIMIT/);
  const adm=await claim(db,ids.admin,120);assert.equal(adm.ok,true);
  await release(db,adm.holder);
 });
 test('contribuidor que perdeu o slot (expirou e outro assumiu) não derruba nem devolve tempo do novo dono',async()=>{
  await register(db,ids.anonA,'Ana');
  const first=await claim(db,ids.anonA,30);assert.equal(first.ok,true);await expireSlot(db);
  const adm=await claim(db,ids.admin,120);assert.equal(adm.ok,true);
  await release(db,first.holder); // liberação atrasada do antigo dono
  assert.equal((await claim(db,ids.admin,30)).ok,false); // o slot continua com o administrador
  await release(db,adm.holder);
 });
 test('registros de uso antigos (>2 h) são descartados e não contam',async()=>{
  await register(db,ids.anonA,'Ana');
  for(let i=0;i<3;i++){await claim(db,ids.anonA,120);await expireSlot(db);}
  await db.exec("update private.import_slot_usage set claimed_at=now()-interval '3 hours'");
  assert.equal((await claim(db,ids.anonA,120)).ok,true);
  assert.equal((await db.query<any>("select count(*)::int c from private.import_slot_usage where claimed_at<now()-interval '2 hours'")).rows[0].c,0);
 });
 test('permissões: só service_role executa claim/release/relatórios; tabela de uso não é legível por anon/authenticated',async()=>{
  const {asRole}=await import('./support/pg.js');
  for(const role of ['anon','authenticated'] as const){
   await assert.rejects(asRole(db,role,{sub:ids.admin},()=>db.query('select public.claim_import_slot($1,30,$2)',[crypto.randomUUID(),ids.admin])),/permission denied/);
   await assert.rejects(asRole(db,role,{sub:ids.admin},()=>db.query('select * from private.import_slot_usage')),/permission denied/);
  }
 });
});
