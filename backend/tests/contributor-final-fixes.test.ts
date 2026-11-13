// Correções finais R1/R2/R3 do PR #19 (segunda revisão independente, SHA cd627de), sobre PostgreSQL REAL em WASM (PGlite).
// Limites: uma única conexão (a concorrência multiconexão está em scripts/contributor-concurrency-real-pg.mjs, PostgreSQL 17 descartável),
// adaptador no lugar de PostgREST/GoTrue/Storage e nenhum FFmpeg/upload físico. Nada aqui toca Supabase.
import {test,describe,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {buildApp} from '../src/application.js';
import {claimNextUpload,failContributorUploads} from '../src/worker-queue.js';
import {createDb,applyStorageMigration,createPrADb,asRole,ids,seedUsers,seedMap,rollbacksDir,STORAGE_MIGRATION,CONTRIBUTORS_MIGRATION} from './support/pg.js';
import {createSupabaseOverPg} from './support/supabase-pg.js';

const MB=1_000_000;
const tokens={admin:{sub:ids.admin,anonymous:false},ta:{sub:ids.anonA,anonymous:true},tb:{sub:ids.anonB,anonymous:true}};
const envKeys=['CONTRIBUTORS_ENABLED','CONTRIBUTOR_IMPORTS_ENABLED','CONTRIBUTOR_UPLOADS_ENABLED','MEDIA_UPLOAD_ENABLED','MEDIA_TRIMMING_ENABLED','MEDIA_PROCESSOR_MODE','MEDIA_TIKTOK_ADMIN_USER_ID','FRONTEND_URL'];
let started=false;
let db:PGlite,app:ReturnType<typeof buildApp>,saved:Record<string,string|undefined>,objects:Set<string>;
async function start(env:Record<string,string|undefined>={}){
 started=true;
 saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 for(const k of envKeys)delete process.env[k];
 Object.assign(process.env,{CONTRIBUTORS_ENABLED:'true',CONTRIBUTOR_UPLOADS_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'true',MEDIA_TRIMMING_ENABLED:'true',MEDIA_TIKTOK_ADMIN_USER_ID:ids.admin,FRONTEND_URL:'http://localhost:5173'},env);
 for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];
 db=await createDb();await seedUsers(db);await seedMap(db);
 const sb=createSupabaseOverPg(db,tokens);objects=sb.objects;
 app=buildApp(sb.clients,{available:()=>false,extract:async()=>({metadata:{} as any})});
}
async function stop(){if(!started)return;started=false;await app.close();await db.close();for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
const call=async(token:string,method:'GET'|'POST',url:string,payload?:unknown)=>{
 const r=await app.inject({method,url,headers:{authorization:`Bearer ${token}`},...(payload!==undefined?{payload:payload as any}:{})});
 let json:any;try{json=r.json();}catch{json=null;}return {status:r.statusCode,json,text:r.body};
};
const register=async(db:PGlite,uid:string,nick='Fulano')=>(await db.query<{id:string}>('select * from public.register_contributor($1,$2)',[uid,nick])).rows[0].id;
const key=()=>`${crypto.randomUUID()}/source.mp4`;
const clip=JSON.stringify({startSeconds:1,endSeconds:3});
const newMedia=async(db:PGlite,owner:string,o:{clip?:boolean}={})=>(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key,clip) values($1,$2,$3,$4) returning id,storage_key',[owner,'upload',key(),o.clip?clip:null])).rows[0];
const status=async(db:PGlite,id:string)=>(await db.query<any>('select status,storage_charge_bytes::bigint c from public.media_assets where id=$1',[id])).rows[0];
const total=async(db:PGlite)=>Number((await db.query<any>('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets where contributor_id is not null')).rows[0].t);
// media_state carimba updated_at; para envelhecer a linha de verdade desligamos os triggers só neste UPDATE (como o teste S1).
const age=async(db:PGlite,id:string,interval:string)=>{await db.exec('alter table public.media_assets disable trigger user');try{await db.query(`update public.media_assets set created_at=now()-interval '${interval}',updated_at=now()-interval '${interval}' where id=$1`,[id]);}finally{await db.exec('alter table public.media_assets enable trigger user');}};
const queue=(db:PGlite,id:string)=>db.query("update public.media_assets set status='queued' where id=$1 and status='awaiting_upload'",[id]);
const toProcessing=async(db:PGlite,id:string)=>{await db.query("update public.media_assets set status='queued' where id=$1",[id]);await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);};
/** Imita a conclusão do worker-transcode: playback-N.mp4 com bytes só da saída, sem sourceBytes. */
const workerReady=(db:PGlite,id:string,outBytes:number,newKey=`${id}/playback-1.mp4`)=>db.query("update public.media_assets set status='ready',locked_until=null,storage_key=$2,metadata=$3 where id=$1",[id,newKey,JSON.stringify({bytes:outBytes,durationSeconds:10,mimeType:'video/mp4'})]);

describe('R1 — worker-transcode não pode subcontabilizar fonte + saída',()=>{
 afterEach(stop);
 test('reprodução do achado: sem a trava, o worker deixava 50 MB de fonte + 7 MB de saída cobrados como 7 MB',async()=>{
  // Sensibilidade: prova que o cenário do Codex existe em SQL puro e que agora o banco o recusa (nenhum estado "pronto e subcobrado").
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const m=await newMedia(d,ids.anonA);await toProcessing(d,m.id);
  await assert.rejects(workerReady(d,m.id,7*MB),/CONTRIBUTOR_STORAGE_UNACCOUNTED/);
  const row=await status(d,m.id);assert.equal(row.status,'processing');assert.equal(Number(row.c),50*MB); // reserva intacta, nunca 7 MB
  await d.close();
 });
 test('banco: sem corte, mídia de contribuidor só fica pronta mantendo a storage_key da fonte (cobrança real = tamanho do arquivo)',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const m=await newMedia(d,ids.anonA);await toProcessing(d,m.id);
  await d.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[m.id,JSON.stringify({bytes:8*MB,durationSeconds:10,mimeType:'video/mp4'})]);
  assert.equal(Number((await status(d,m.id)).c),8*MB);
  await d.close();
 });
 test('banco: com corte, fonte + trecho continuam cobrados (storage_key nova do trecho é legítima), com ou sem sourceBytes',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const a=await newMedia(d,ids.anonA,{clip:true});await toProcessing(d,a.id);
  await d.query("update public.media_assets set status='ready',locked_until=null,storage_key=$2,metadata=$3 where id=$1",[a.id,`${a.id}/clip-1.mp4`,JSON.stringify({bytes:2*MB,sourceBytes:30*MB,durationSeconds:2,mimeType:'video/mp4'})]);
  assert.equal(Number((await status(d,a.id)).c),32*MB);
  const b=await newMedia(d,ids.anonA,{clip:true});await toProcessing(d,b.id);
  await d.query("update public.media_assets set status='ready',locked_until=null,storage_key=$2,metadata=$3 where id=$1",[b.id,`${b.id}/clip-1.mp4`,JSON.stringify({bytes:2*MB,durationSeconds:2,mimeType:'video/mp4'})]);
  assert.equal(Number((await status(d,b.id)).c),52*MB); // sem sourceBytes: assume a fonte inteira (50 MB)
  await d.close();
 });
 test('banco: transições de estado — falha mantém a reserva inteira e administrador não é afetado',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const m=await newMedia(d,ids.anonA);await toProcessing(d,m.id);
  await d.query("update public.media_assets set status='failed',locked_until=null,error='{\"code\":\"X\"}' where id=$1",[m.id]);
  assert.equal(Number((await status(d,m.id)).c),50*MB);
  // administrador com worker-transcode: troca de storage_key sem corte segue permitida e fora do orçamento
  const am=await newMedia(d,ids.admin);await toProcessing(d,am.id);await workerReady(d,am.id,7*MB);
  const row=await status(d,am.id);assert.equal(row.status,'ready');assert.equal(Number(row.c),0);
  await d.close();
 });
 test('API: worker-transcode — contribuidor não obtém URL de upload (com ou sem corte) e nada é reservado; capability informa',async()=>{
  await start({MEDIA_PROCESSOR_MODE:'worker-transcode'});await register(db,ids.anonA,'Ana');
  assert.equal((await call('ta','POST','/api/v1/contributors',{nickname:'Ana'})).status,200);
  const caps=(await call('ta','GET','/api/v1/media/capabilities')).json.data;assert.equal(caps.contributors.uploads,false);
  for(const body of [{},{clip:{startSeconds:1,endSeconds:3}}]){
   const r=await call('ta','POST','/api/v1/media/uploads',body);
   assert.equal(r.status,403,r.text);assert.equal(r.json.error.code,'CONTRIBUTOR_UPLOADS_UNSUPPORTED');
  }
  assert.equal((await db.query<any>('select count(*)::int n from public.media_assets')).rows[0].n,0);
  assert.equal(await total(db),0);
 });
 test('API: worker-transcode — administrador continua enviando e finalizando; contribuidor não finaliza mídia pendente',async()=>{
  await start({MEDIA_PROCESSOR_MODE:'worker-transcode'});await register(db,ids.anonA,'Ana');
  const up=await call('admin','POST','/api/v1/media/uploads',{});assert.equal(up.status,201,up.text);
  assert.equal(Number((await status(db,up.json.data.mediaId)).c),0);
  const path=`${up.json.data.mediaId}/source.mp4`;objects.add(path);
  const done=await call('admin','POST',`/api/v1/media/${up.json.data.mediaId}/complete`,{});assert.equal(done.status,202,done.text);
  assert.equal((await status(db,up.json.data.mediaId)).status,'queued');
  // mídia de contribuidor criada em outro momento (ex.: modo inline antes de trocar o processador): não entra na fila do worker
  const m=await newMedia(db,ids.anonA);objects.add(m.storage_key);
  const c=await call('ta','POST',`/api/v1/media/${m.id}/complete`,{});assert.equal(c.status,403,c.text);assert.equal(c.json.error.code,'CONTRIBUTOR_UPLOADS_UNSUPPORTED');
  assert.equal((await status(db,m.id)).status,'awaiting_upload');
 });
 test('API: inline-original continua oferecendo uploads colaborativos (sem regressão)',async()=>{
  await start({});await register(db,ids.anonA,'Ana');
  assert.equal((await call('ta','GET','/api/v1/media/capabilities')).json.data.contributors.uploads,true);
  const r=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(r.status,201,r.text);assert.equal(await total(db),50*MB);
  const w=await call('ta','POST','/api/v1/media/uploads',{clip:{startSeconds:1,endSeconds:3}});assert.equal(w.status,201,w.text);assert.equal(await total(db),150*MB);
 });
 test('worker: a fila nunca assume mídia de contribuidor (ela é marcada como falha, reserva mantida); administrador é processado',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const c=await newMedia(d,ids.anonA);await d.query("update public.media_assets set status='queued' where id=$1",[c.id]);
  const a=await newMedia(d,ids.admin);await d.query("update public.media_assets set status='queued' where id=$1",[a.id]);
  const pool={query:(sql:string,params?:unknown[])=>d.query<any>(sql,params as any)};
  await failContributorUploads(pool);
  const cr=await status(d,c.id);assert.equal(cr.status,'failed');assert.equal(Number(cr.c),50*MB);
  const claimed=await claimNextUpload(pool);assert.equal(claimed?.id,a.id);assert.equal(await claimNextUpload(pool),undefined);
  // mesmo sem a limpeza prévia, o candidato nunca é de contribuidor
  const c2=await newMedia(d,ids.anonA);await d.query("update public.media_assets set status='queued' where id=$1",[c2.id]);
  assert.equal(await claimNextUpload(pool),undefined);assert.equal((await status(d,c2.id)).status,'queued');
  await d.close();
 });
});

describe('R2 — complete tardio não reativa mais de dois pendentes',()=>{
 afterEach(stop);
 test('cenário exato do Codex: 2 mídias enviadas, janela de 150 min vence, 3ª criada, complete nas 3 → no máximo 2 enfileiradas',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const m1=await newMedia(d,ids.anonA),m2=await newMedia(d,ids.anonA);
  await age(d,m1.id,'151 minutes');await age(d,m2.id,'151 minutes');
  const m3=await newMedia(d,ids.anonA); // INSERT passa: as duas antigas já saíram da contagem
  await queue(d,m1.id); // 1ª reativação: pendentes = {m3} + m1 = 2, admitida
  await assert.rejects(queue(d,m2.id),/CONTRIBUTOR_PENDING_LIMIT/); // 2ª excederia (m3, m1, m2 = 3)
  const q=(await d.query<any>("select count(*)::int n from public.media_assets where status in ('queued','processing')")).rows[0].n;
  assert.ok(q<=2,`enfileiradas=${q}`);
  // nada foi apagado e a cobrança segue integral (a URL assinada de m2 pode ainda valer)
  const rows=(await d.query<any>('select id,status,storage_charge_bytes::bigint c from public.media_assets where contributor_id is not null')).rows;
  assert.equal(rows.length,3);assert.equal(await total(d),150*MB);
  assert.equal(rows.find((r:any)=>r.id===m2.id).status,'awaiting_upload');
  await d.close();
 });
 test('a rejeitada fica recuperável: quando um pendente conclui, o complete tardio é admitido (objeto não foi apagado)',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const m1=await newMedia(d,ids.anonA);
  await age(d,m1.id,'151 minutes');
  const m3=await newMedia(d,ids.anonA),m4=await newMedia(d,ids.anonA);
  await assert.rejects(queue(d,m1.id),/CONTRIBUTOR_PENDING_LIMIT/); // m3+m4 já ocupam as duas vagas
  await toProcessing(d,m3.id);
  await d.query("update public.media_assets set status='failed',locked_until=null,error='{}' where id=$1",[m3.id]); // saiu dos pendentes
  await queue(d,m1.id);assert.equal((await status(d,m1.id)).status,'queued');
  await d.close();
 });
 test('reativação dentro da janela continua funcionando (a mídia já era contada como pendente)',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA);
  const m1=await newMedia(d,ids.anonA),m2=await newMedia(d,ids.anonA);
  await queue(d,m1.id);await queue(d,m2.id);
  assert.equal((await status(d,m1.id)).status,'queued');assert.equal((await status(d,m2.id)).status,'queued');
  await d.close();
 });
 test('limites por contribuidor: o complete tardio de A não é bloqueado pelos pendentes de B',async()=>{
  const d=await createDb();await seedUsers(d);await register(d,ids.anonA,'Ana');await register(d,ids.anonB,'Bia');
  const a1=await newMedia(d,ids.anonA);await age(d,a1.id,'151 minutes');
  await newMedia(d,ids.anonB);await newMedia(d,ids.anonB);
  await queue(d,a1.id);assert.equal((await status(d,a1.id)).status,'queued');
  await d.close();
 });
 test('administrador e histórico: sem limite de pendentes nem bloqueio ao reativar',async()=>{
  const d=await createDb();await seedUsers(d);
  const ms=[];for(let i=0;i<4;i++)ms.push(await newMedia(d,ids.admin));
  for(const m of ms)await queue(d,m.id);
  assert.equal((await d.query<any>("select count(*)::int n from public.media_assets where status='queued'")).rows[0].n,4);
  await d.close();
 });
 test('API (inline): o complete tardio rejeitado devolve 429 CONTRIBUTOR_PENDING_LIMIT e mantém a mídia aguardando upload',async()=>{
  await start({});await register(db,ids.anonA,'Ana');
  const old=await newMedia(db,ids.anonA);await age(db,old.id,'151 minutes');objects.add(old.storage_key);
  await newMedia(db,ids.anonA);await newMedia(db,ids.anonA);
  const r=await call('ta','POST',`/api/v1/media/${old.id}/complete`,{});
  assert.equal(r.status,429,r.text);assert.equal(r.json.error.code,'CONTRIBUTOR_PENDING_LIMIT');
  assert.equal((await status(db,old.id)).status,'awaiting_upload');assert.equal(Number((await status(db,old.id)).c),50*MB);
 });
 test('API (worker-transcode): administrador não é afetado pelo novo limite ao finalizar',async()=>{
  await start({MEDIA_PROCESSOR_MODE:'worker-transcode'});
  const ids2:string[]=[];for(let i=0;i<4;i++){const r=await call('admin','POST','/api/v1/media/uploads',{});assert.equal(r.status,201,r.text);objects.add(`${r.json.data.mediaId}/source.mp4`);ids2.push(r.json.data.mediaId);}
  for(const id of ids2)assert.equal((await call('admin','POST',`/api/v1/media/${id}/complete`,{})).status,202);
 });
});

describe('R3 — rollback exige backend compatível antes de remover a assinatura',()=>{
 // Chamadas que o backend ANTERIOR ao PR (main 8776ddf) faz via RPC e que o administrador usa nas importações.
 const oldBackendCalls=async(d:PGlite)=>{
  const holder=crypto.randomUUID();
  assert.equal((await d.query<any>('select public.claim_import_slot($1,$2) ok',[holder,30])).rows[0].ok,true);
  await d.query('select public.release_import_slot($1)',[holder]);
  await d.query('select * from public.reserve_import_source($1)',[ids.admin]);
 };
 const newBackendCall=(d:PGlite)=>d.query('select public.claim_import_slot($1,$2,$3) ok',[crypto.randomUUID(),30,ids.admin]);
 const rollback2=async(d:PGlite)=>d.exec(await readFile(rollbacksDir+STORAGE_MIGRATION.replace('.sql','_rollback.sql'),'utf8'));
 const rollback1=async(d:PGlite)=>d.exec(await readFile(rollbacksDir+CONTRIBUTORS_MIGRATION.replace('.sql','_rollback.sql'),'utf8'));
 test('backend anterior funciona com schema só da migration 1, com as duas, após rollback2 e após rollback1',async()=>{
  const d=await createPrADb();await seedUsers(d);await oldBackendCalls(d);await d.close();
  const e=await createDb();await seedUsers(e);await oldBackendCalls(e);
  await rollback2(e);await e.query('delete from public.import_sources');await oldBackendCalls(e);
  await rollback1(e);await e.query('delete from public.import_sources');await oldBackendCalls(e);await e.close();
 });
 test('backend ATUAL exige a assinatura de 3 argumentos: rollback2 sob o backend novo derruba os fluxos administrativos (por isso a ordem do runbook)',async()=>{
  const d=await createDb();await seedUsers(d);
  assert.equal((await newBackendCall(d)).rows.length,1); // com as duas migrations: ok
  await rollback2(d);
  await assert.rejects(newBackendCall(d),/claim_import_slot/); // sem a assinatura nova o backend novo falha (503 no servidor)
  await d.close();
 });
 test('rollback2 preserva dados: mídias, granadas, vínculos e fontes continuam; só objetos de contabilidade somem',async()=>{
  const d=await createDb();await seedUsers(d);await seedMap(d);const cid=await register(d,ids.anonA);
  const m=await newMedia(d,ids.anonA);await toProcessing(d,m.id);
  await d.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[m.id,JSON.stringify({bytes:3*MB,durationSeconds:10,mimeType:'video/mp4'})]);
  await d.query("insert into public.grenades(title,map_id,type,side,instructions,target,video_id,author_id) values('G','de_mirage','smoke','T','Alinhe a mira','{\"x\":0.1,\"y\":0.2}',$1,$2)",[m.id,cid]);
  const before=(await d.query<any>('select id,owner_id,contributor_id,status,storage_key,metadata from public.media_assets')).rows;
  await rollback2(d);
  assert.deepEqual((await d.query<any>('select id,owner_id,contributor_id,status,storage_key,metadata from public.media_assets')).rows,before);
  assert.equal((await d.query<any>('select count(*)::int n from public.grenades')).rows[0].n,1);
  assert.equal((await d.query<any>('select count(*)::int n from public.contributor_links')).rows[0].n,1);
  await d.close();
 });
 test('as RPCs administrativas de importação não são executáveis por anon/authenticated (rollback não abre permissões)',async()=>{
  const d=await createDb();await seedUsers(d);await rollback2(d);
  await asRole(d,'anon',null,async()=>{await assert.rejects(d.query('select public.claim_import_slot($1,$2)',[crypto.randomUUID(),30]),/permission denied/);});
  await d.close();
 });
});
