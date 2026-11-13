// Segurança no banco (PostgreSQL real via PGlite): autoria, propriedade de mídia, RLS, cotas e legado.
import {test,describe,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createLegacyDb,applyContributorsMigration,createDb,asRole,ids,seedUsers,seedMap,readyMedia,grenadeSql,rollbacksDir,CONTRIBUTORS_MIGRATION,STORAGE_MIGRATION} from './support/pg.js';

const register=async(db:PGlite,uid:string,nick='Fulano')=>(await db.query<{id:string}>('select * from public.register_contributor($1,$2)',[uid,nick])).rows[0].id;
const rejects=(p:Promise<unknown>,re:RegExp)=>assert.rejects(p,re);
const legacyInsert=grenadeSql.replace(',author_id)',')').replace(',$3)',')'); // o que o backend anterior executava

describe('legado: a migration é aditiva e retrocompatível',()=>{
 test('registros e privilégios existentes ficam intactos; backend antigo continua inserindo',async()=>{
  const db=await createLegacyDb();await seedUsers(db);await seedMap(db);
  const media=await readyMedia(db,ids.admin);
  const legacy=(await db.query<any>(legacyInsert,['Granada antiga',media])).rows[0];
  const snap=async()=>({
   policies:(await db.query("select tablename,policyname,cmd,roles::text,qual,with_check from pg_policies where schemaname='public' order by 1,2")).rows,
   grants:(await db.query("select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('grenades','media_assets','maps','import_sources') order by 1,2,3")).rows,
   rls:(await db.query("select relname,relrowsecurity from pg_class where relname in ('grenades','media_assets','maps','import_sources') order by 1")).rows,
   admins:(await db.query('select user_id from private.administrators')).rows
  });
  const before=await snap();
  await applyContributorsMigration(db);
  const after=await snap();
  // única política alterada de propósito: INSERT de granada passa a exigir author_id nulo.
  const strip=(s:any)=>s.policies.filter((p:any)=>p.policyname!=='grenades_insert'&&!['contributors','contributor_links'].includes(p.tablename));
  assert.deepEqual(strip(after),strip(before));
  assert.deepEqual(after.rls,before.rls);assert.deepEqual(after.admins,before.admins);
  assert.deepEqual(after.grants,before.grants); // nenhum privilégio novo/removido nas tabelas existentes
  const row=(await db.query<any>('select * from public.grenades where id=$1',[legacy.id])).rows[0];
  const {author_id,...rest}=row;assert.equal(author_id,null);assert.deepEqual(rest,legacy);
  assert.equal((await db.query<any>('select contributor_id from public.media_assets where id=$1',[media])).rows[0].contributor_id,null);
  // backend anterior: insere sem conhecer as colunas novas
  const media2=await readyMedia(db,ids.admin);
  assert.equal((await db.query<any>(legacyInsert,['Nova pelo backend antigo',media2])).rows[0].author_id,null);
  await db.close();
 });
 test('o rollback devolve o esquema anterior sem perder granadas nem mídias',async()=>{
  const db=await createDb();await seedUsers(db);await seedMap(db);
  const cid=await register(db,ids.anonA);const media=await readyMedia(db,ids.anonA);
  await db.query(grenadeSql,['Autoral',media,cid]);
  await db.exec(await readFile(rollbacksDir+STORAGE_MIGRATION.replace('.sql','_rollback.sql'),'utf8')); // ordem inversa: primeiro a mais nova
  await db.exec(await readFile(rollbacksDir+CONTRIBUTORS_MIGRATION.replace('.sql','_rollback.sql'),'utf8'));
  assert.equal((await db.query<any>('select count(*)::int n from public.grenades')).rows[0].n,1);
  assert.equal((await db.query<any>('select count(*)::int n from public.media_assets')).rows[0].n,1);
  assert.equal((await db.query<any>("select count(*)::int n from information_schema.columns where table_name in ('grenades','media_assets') and column_name in ('author_id','contributor_id')")).rows[0].n,0);
  assert.equal((await db.query<any>("select count(*)::int n from pg_tables where tablename in ('contributors','contributor_links')")).rows[0].n,0);
  // política original restaurada: admin insere como antes
  const m=await readyMedia(db,ids.admin);
  await asRole(db,'authenticated',{sub:ids.admin},async()=>{await db.query(legacyInsert,['Pós-rollback',m]);});
  await db.close();
 });
});

describe('autoria e propriedade',()=>{
 let db:PGlite;
 before(async()=>{db=await createDb();await seedUsers(db);await seedMap(db);});

 test('register_contributor cria contribuidor + vínculo e é idempotente por sessão',async()=>{
  const a=await register(db,ids.anonA,'Ana');
  assert.equal(await register(db,ids.anonA,'Outro apelido'),a); // segunda chamada não cria nem renomeia
  assert.equal((await db.query<any>('select nickname from public.contributors where id=$1',[a])).rows[0].nickname,'Ana');
  const b=await register(db,ids.anonB,'Ana'); // mesmo apelido, outro contribuidor
  assert.notEqual(a,b);
  await rejects(db.query('select * from public.register_contributor($1,$2)',[ids.anonC,'x']),/contributors_nickname_check|violates check/);
 });
 test('mídia herda o contribuidor do dono pelo vínculo; imutável; admin/legado ficam sem contribuidor',async()=>{
  const a=await register(db,ids.anonA);
  const mine=await readyMedia(db,ids.anonA);const adm=await readyMedia(db,ids.admin);
  const get=async(id:string)=>(await db.query<any>('select contributor_id from public.media_assets where id=$1',[id])).rows[0].contributor_id;
  assert.equal(await get(mine),a);assert.equal(await get(adm),null);
  await rejects(db.query('update public.media_assets set contributor_id=null where id=$1',[mine]),/IMMUTABLE_OWNERSHIP/);
  await rejects(db.query('update public.media_assets set contributor_id=$2 where id=$1',[adm,a]),/IMMUTABLE_OWNERSHIP/);
 });
 test('author_id é imutável (inclusive NULL→valor e valor→NULL) mesmo para service_role',async()=>{
  const a=await register(db,ids.anonA);const b=await register(db,ids.anonB);
  const media=await readyMedia(db,ids.anonA);const g=(await db.query<any>(grenadeSql,['Minha',media,a])).rows[0];
  await asRole(db,'service_role',null,async()=>{
   await rejects(db.query('update public.grenades set author_id=$2 where id=$1',[g.id,b]),/IMMUTABLE_OWNERSHIP/);
   await rejects(db.query('update public.grenades set author_id=null where id=$1',[g.id]),/IMMUTABLE_OWNERSHIP/);
  });
  const am=await readyMedia(db,ids.admin);const legacy=(await db.query<any>(legacyInsert,['Histórica',am])).rows[0];
  await rejects(db.query('update public.grenades set author_id=$2 where id=$1',[legacy.id,a]),/IMMUTABLE_OWNERSHIP/); // ninguém reivindica registro histórico
  await db.query('update public.grenades set title=$2 where id=$1',[g.id,'Título novo']); // outros campos seguem editáveis
  assert.equal((await db.query<any>('select revision from public.grenades where id=$1',[g.id])).rows[0].revision,2);
 });
 test('granada com autor só nasce com vídeo do próprio autor (nem alheio, nem legado)',async()=>{
  const a=await register(db,ids.anonA);await register(db,ids.anonB);
  const mediaB=await readyMedia(db,ids.anonB);const legacyMedia=await readyMedia(db,ids.admin);const mine=await readyMedia(db,ids.anonA);
  await rejects(db.query(grenadeSql,['Roubada',mediaB,a]),/VIDEO_NOT_OWNED/);
  await rejects(db.query(grenadeSql,['Vídeo do admin',legacyMedia,a]),/VIDEO_NOT_OWNED/);
  await db.query(grenadeSql,['Ok',mine,a]);
 });
 test('trocar o vídeo de granada com autor: nunca vídeo de outro contribuidor; próprio e de admin (reedição) podem',async()=>{
  const a=await register(db,ids.anonA);await register(db,ids.anonB);
  const mine=await readyMedia(db,ids.anonA),mine2=await readyMedia(db,ids.anonA),mediaB=await readyMedia(db,ids.anonB),adm=await readyMedia(db,ids.admin);
  const g=(await db.query<any>(grenadeSql,['G',mine,a])).rows[0];
  await rejects(db.query('update public.grenades set video_id=$2 where id=$1',[g.id,mediaB]),/VIDEO_NOT_OWNED/);
  await db.query('update public.grenades set video_id=$2 where id=$1',[g.id,mine2]);
  await db.query('update public.grenades set video_id=$2 where id=$1',[g.id,adm]); // admin refez o corte
 });
 test('contribuidor inexistente é recusado por chave estrangeira',async()=>{
  const media=await readyMedia(db,ids.anonA);
  await rejects(db.query(grenadeSql,['Fantasma',media,'00000000-0000-4000-8000-00000000ffff']),/foreign key|VIDEO_NOT_OWNED/);
 });
});

describe('RLS e privilégios: papel authenticated sozinho não autoriza nada',()=>{
 let db:PGlite,a:string,gA:string;
 before(async()=>{db=await createDb();await seedUsers(db);await seedMap(db);a=await register(db,ids.anonA);const m=await readyMedia(db,ids.anonA);gA=(await db.query<any>(grenadeSql,['Da A',m,a])).rows[0].id;});
 const anon=(uid:string)=>({sub:uid,anonymous:true});

 test('is_admin é falso para sessões anônimas e verdadeiro para o admin',async()=>{
  assert.equal(await asRole(db,'authenticated',anon(ids.anonA),async()=>(await db.query<any>('select public.is_admin() v')).rows[0].v),false);
  assert.equal(await asRole(db,'authenticated',{sub:ids.admin},async()=>(await db.query<any>('select public.is_admin() v')).rows[0].v),true);
 });
 test('usuário anônimo autenticado não insere, edita nem exclui granadas direto pela API de dados',async()=>{
  const m=await readyMedia(db,ids.anonB);
  await asRole(db,'authenticated',anon(ids.anonB),async()=>{
   await rejects(db.query(legacyInsert,['Direta',m]),/Video must be ready|row-level security/); // o trigger só enxerga a mídia se o papel puder lê-la
   await rejects(db.query('update public.grenades set title=$2 where id=$1',[gA,'x']),/permission denied/);
   assert.equal((await db.query('delete from public.grenades where id=$1',[gA])).affectedRows,0);
  });
  // A política de INSERT sozinha também nega: desliga os triggers de usuário para que a RLS seja a única barreira avaliada.
  await db.exec('alter table public.grenades disable trigger user');
  try{await asRole(db,'authenticated',anon(ids.anonB),async()=>{await rejects(db.query(legacyInsert,['Direta',m]),/row-level security/);});}
  finally{await db.exec('alter table public.grenades enable trigger user');}
  assert.equal((await db.query<any>('select count(*)::int n from public.grenades where id=$1',[gA])).rows[0].n,1);
 });
 test('o dono anônimo também não exclui a própria granada direto',async()=>{
  await asRole(db,'authenticated',anon(ids.anonA),async()=>assert.equal((await db.query('delete from public.grenades where id=$1',[gA])).affectedRows,0));
  assert.equal((await db.query<any>('select count(*)::int n from public.grenades where id=$1',[gA])).rows[0].n,1);
 });
 test('admin insere pela API de dados, mas não forja autoria',async()=>{
  const m=await readyMedia(db,ids.admin);
  await asRole(db,'authenticated',{sub:ids.admin},async()=>{
   assert.equal((await db.query<any>(legacyInsert,['Do admin',m])).rows[0].author_id,null);
   await rejects(db.query(grenadeSql,['Forjada',m,a]),/VIDEO_NOT_OWNED/); // trigger (vídeo não é do autor forjado)
  });
  // Só a política: mesmo com o trigger fora do caminho, author_id não nulo é negado pela RLS.
  await db.exec('alter table public.grenades disable trigger user');
  try{await asRole(db,'authenticated',{sub:ids.admin},async()=>{await rejects(db.query(grenadeSql,['Forjada',m,a]),/row-level security/);});}
  finally{await db.exec('alter table public.grenades enable trigger user');}
 });
 test('contribuidores, vínculos e register_contributor são inacessíveis a anon/authenticated; mídia só o admin lê',async()=>{
  for(const [role,claims] of [['anon',null],['authenticated',anon(ids.anonA)]] as const){
   await asRole(db,role,claims,async()=>{
    await rejects(db.query('select * from public.contributors'),/permission denied/);
    await rejects(db.query('select * from public.contributor_links'),/permission denied/);
    await rejects(db.query("update public.contributors set nickname='Hack'"),/permission denied/);
    await rejects(db.query('insert into public.contributor_links(auth_user_id,contributor_id) values($1,$2)',[ids.anonB,a]),/permission denied/);
    await rejects(db.query("select * from public.register_contributor($1,'Intruso')",[ids.anonB]),/permission denied/);
   });
  }
  await asRole(db,'authenticated',anon(ids.anonA),async()=>assert.equal((await db.query<any>('select count(*)::int n from public.media_assets')).rows[0].n,0));
 });
 test('qualquer um ainda lê granadas (biblioteca pública)',async()=>{
  await asRole(db,'anon',null,async()=>assert.ok((await db.query<any>('select count(*)::int n from public.grenades')).rows[0].n>=1));
 });
 test('uma sessão só pode pertencer a um contribuidor',async()=>{
  await register(db,ids.anonB);
  await rejects(db.query('insert into public.contributor_links(auth_user_id,contributor_id) values($1,$2)',[ids.anonB,a]),/duplicate key|unique/);
 });
});

describe('cotas por contribuidor (anti-abuso, atômicas no banco)',()=>{
 test('mídias: 10 por hora com janela móvel; admin e outros contribuidores não são afetados',async()=>{
  const db=await createDb();await seedUsers(db);
  await register(db,ids.anonA);await register(db,ids.anonB);
  for(let i=0;i<10;i++)await readyMedia(db,ids.anonA);
  await rejects(readyMedia(db,ids.anonA),/CONTRIBUTOR_QUOTA_EXCEEDED/);
  await readyMedia(db,ids.anonB);await readyMedia(db,ids.admin);
  await db.query("update public.media_assets set created_at=now()-interval '61 minutes' where contributor_id=(select contributor_id from public.contributor_links where auth_user_id=$1)",[ids.anonA]);
  await readyMedia(db,ids.anonA); // a janela móvel liberou
  await db.close();
 });
 test('mídias: 30 por dia',async()=>{
  const db=await createDb();await seedUsers(db);await register(db,ids.anonA);
  const old=new Date(Date.now()-3*3600e3).toISOString();
  for(let i=0;i<30;i++)await readyMedia(db,ids.anonA,{createdAt:old});
  await rejects(readyMedia(db,ids.anonA),/CONTRIBUTOR_QUOTA_EXCEEDED/);
  await db.close();
 });
 test('granadas: 30 por dia por autor',async()=>{
  const db=await createDb();await seedUsers(db);await seedMap(db);const a=await register(db,ids.anonA);
  const m=await readyMedia(db,ids.anonA);
  for(let i=0;i<30;i++)await db.query(grenadeSql,[`G${i}`,m,a]);
  await rejects(db.query(grenadeSql,['G31',m,a]),/CONTRIBUTOR_QUOTA_EXCEEDED/);
  await db.close();
 });
 test('teto global de 200 mídias/dia de contribuidores',async()=>{
  const db=await createDb();await seedUsers(db);await register(db,ids.anonA);
  // Linhas semeadas com o trigger de contribuidor desligado (cobrança 0): aqui só importa a cota de QUANTIDADE; os bytes têm testes próprios.
  await db.exec('alter table public.media_assets disable trigger media_contributor');
  await db.exec(`do $$ declare u uuid; c uuid; begin for i in 1..200 loop
    u:=gen_random_uuid(); insert into auth.users(id,is_anonymous) values(u,true);
    perform public.register_contributor(u,'Bot'||i);
    select contributor_id into c from public.contributor_links where auth_user_id=u;
    insert into public.media_assets(owner_id,contributor_id,source_type,storage_key) values(u,c,'upload',gen_random_uuid()||'/s.mp4');
   end loop; end $$`);
  await db.exec('alter table public.media_assets enable trigger media_contributor');
  assert.equal((await db.query<any>('select count(*)::int n from public.media_assets where contributor_id is not null')).rows[0].n,200);
  await rejects(readyMedia(db,ids.anonA),/CONTRIBUTOR_QUOTA_EXCEEDED/);
  await readyMedia(db,ids.admin); // admin não conta nem é barrado
  await db.close();
 });
});
