// Correções da revisão independente do PR #19 pela API, sobre PostgreSQL REAL (PGlite): S1 Storage, S2 importações, S3 erro 429.
// Limites: adaptador no lugar de PostgREST/GoTrue/Storage e uma única conexão (as consultas são serializadas): estes testes provam as
// regras e os contratos HTTP, NÃO a concorrência multiconexão nem o comportamento do Storage real.
import {test,describe,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import type {PGlite} from '@electric-sql/pglite';
import {buildApp} from '../src/application.js';
import {createDb,ids,seedUsers,seedMap} from './support/pg.js';
import {createSupabaseOverPg} from './support/supabase-pg.js';

const MB=1_000_000;
const tokens={admin:{sub:ids.admin,anonymous:false},ta:{sub:ids.anonA,anonymous:true},tb:{sub:ids.anonB,anonymous:true},tc:{sub:ids.anonC,anonymous:true}};
const tiktok={provider:'tiktok',sourceUrl:'https://www.tiktok.com/@creator/video/7701366996495125766',videoId:'7701366996495125766',title:'Tutorial',author:'Autor',durationSeconds:4000};
const instagram={provider:'instagram',sourceUrl:'https://www.instagram.com/reel/DeILaFXzNvu/',videoId:'DeILaFXzNvu',title:'Tutorial',author:null,durationSeconds:64.664717};
const envKeys=['CONTRIBUTORS_ENABLED','CONTRIBUTOR_IMPORTS_ENABLED','CONTRIBUTOR_UPLOADS_ENABLED','MEDIA_UPLOAD_ENABLED','MEDIA_TRIMMING_ENABLED','MEDIA_TIKTOK_ADMIN_USER_ID','FRONTEND_URL'];

let db:PGlite,app:ReturnType<typeof buildApp>,saved:Record<string,string|undefined>,extractor:(url:string)=>Promise<any>;
const defaultExtractor=async(url:string)=>({metadata:(url.includes('instagram')?instagram:tiktok) as any});
async function start(env:Record<string,string|undefined>={}){
 saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{CONTRIBUTORS_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'true',MEDIA_TIKTOK_ADMIN_USER_ID:ids.admin,FRONTEND_URL:'http://localhost:5173'},env);
 for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];
 db=await createDb();await seedUsers(db);await seedMap(db);extractor=defaultExtractor;
 const sb=createSupabaseOverPg(db,tokens);
 app=buildApp(sb.clients,{available:()=>true,extract:(url)=>extractor(url)});
}
async function stop(){await app.close();await db.close();for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
const call=async(token:string|null,method:'GET'|'POST'|'PATCH'|'DELETE',url:string,payload?:unknown)=>{
 const r=await app.inject({method,url,headers:token?{authorization:`Bearer ${token}`}:{},...(payload!==undefined?{payload:payload as any}:{})});
 let json:any;try{json=r.json();}catch{json=null;}return {status:r.statusCode,json,text:r.body};
};
const register=async(token:string,nickname:string)=>{const r=await call(token,'POST','/api/v1/contributors',{nickname});assert.ok([200,201].includes(r.status),r.text);};
/** Mídia pronta que ocupa `bytes` (percorre a máquina de estados real; a cobrança é conciliada pelo trigger). */
async function readyBig(owner:string,bytes:number){
 const id=(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key) values($1,$2,$3) returning id',[owner,'upload',`${crypto.randomUUID()}/source.mp4`])).rows[0].id;
 await db.query("update public.media_assets set status='queued' where id=$1",[id]);
 await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);
 await db.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[id,JSON.stringify({durationSeconds:10,mimeType:'video/mp4',bytes})]);
 return id;
}
const charged=async()=>Number((await db.query<any>('select coalesce(sum(storage_charge_bytes),0) t from public.media_assets where contributor_id is not null')).rows[0].t);
const clip={startSeconds:1800,endSeconds:1810},igClip={startSeconds:30,endSeconds:35};

describe('S1 — uploads colaborativos: flag própria, desligada por padrão, sem prejudicar o administrador',()=>{
 afterEach(stop);
 test('padrão: contribuidor não obtém URL de upload nem finaliza; capability informa; administrador envia normalmente',async()=>{
  await start({CONTRIBUTOR_UPLOADS_ENABLED:undefined});await register('ta','Ana');
  const caps=(await call(null,'GET','/api/v1/media/capabilities')).json.data;assert.equal(caps.contributors.enabled,true);assert.equal(caps.contributors.uploads,false);
  const r=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(r.status,403,r.text);assert.equal(r.json.error.code,'CONTRIBUTOR_UPLOADS_DISABLED');
  assert.equal((await db.query<any>('select count(*)::int n from public.media_assets')).rows[0].n,0); // nada foi reservado
  // mídia pendente criada por outra via (ex.: flag religada e desligada): não finaliza
  const id=(await db.query<any>('insert into public.media_assets(owner_id,source_type,storage_key) values($1,$2,$3) returning id',[ids.anonA,'upload',`${crypto.randomUUID()}/source.mp4`])).rows[0].id;
  const c=await call('ta','POST',`/api/v1/media/${id}/complete`,{});assert.equal(c.status,403);assert.equal(c.json.error.code,'CONTRIBUTOR_UPLOADS_DISABLED');
  const admin=await call('admin','POST','/api/v1/media/uploads',{});assert.equal(admin.status,201,admin.text);
  assert.equal(Number((await db.query<any>('select storage_charge_bytes c from public.media_assets where id=$1',[admin.json.data.mediaId])).rows[0].c),0); // admin fora do orçamento
 });
 test('a flag de uploads exige CONTRIBUTORS_ENABLED (configuração inválida falha ao subir)',async()=>{
  const prev=[process.env.CONTRIBUTORS_ENABLED,process.env.CONTRIBUTOR_UPLOADS_ENABLED];
  process.env.CONTRIBUTORS_ENABLED='false';process.env.CONTRIBUTOR_UPLOADS_ENABLED='true';
  try{assert.throws(()=>buildApp(undefined,{available:()=>false,extract:async()=>({metadata:tiktok as any})}),/CONTRIBUTOR_UPLOADS_ENABLED exige CONTRIBUTORS_ENABLED/);}
  finally{for(const [k,v] of [['CONTRIBUTORS_ENABLED',prev[0]],['CONTRIBUTOR_UPLOADS_ENABLED',prev[1]]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  await start();
 });
 test('ligada: reserva 50 MB (100 MB com corte), capability informa e o contribuidor tem teto de pendentes',async()=>{
  await start({CONTRIBUTOR_UPLOADS_ENABLED:'true',MEDIA_TRIMMING_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');
  assert.equal((await call(null,'GET','/api/v1/media/capabilities')).json.data.contributors.uploads,true);
  const one=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(one.status,201,one.text);
  assert.equal(await charged(),50*MB);
  const two=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(two.status,201);
  const three=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(three.status,429,three.text);assert.equal(three.json.error.code,'CONTRIBUTOR_PENDING_LIMIT');
  const withClip=await call('tb','POST','/api/v1/media/uploads',{clip:{startSeconds:1,endSeconds:3}});assert.equal(withClip.status,201,withClip.text);
  assert.equal(await charged(),200*MB);
  // segundo corte de Bia: fonte+trecho (100 MB) não cabe no orçamento individual de 150 MB
  const over=await call('tb','POST','/api/v1/media/uploads',{clip:{startSeconds:1,endSeconds:3}});assert.equal(over.status,429,over.text);assert.equal(over.json.error.code,'CONTRIBUTOR_STORAGE_EXCEEDED');
  assert.ok(await charged()<=400*MB);
 });
 test('reprodução do achado S1 (21 autorizações / 1,05 GB): agora no máximo 6 e 300 MB para as mesmas 3 identidades',async()=>{
  await start({CONTRIBUTOR_UPLOADS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');await register('tc','Caio');
  let granted=0,denied=0;
  for(const t of ['ta','tb','tc'])for(let i=0;i<7;i++){const r=await call(t,'POST','/api/v1/media/uploads',{});if(r.status===201)granted++;else{denied++;assert.equal(r.status,429);assert.equal(r.json.error.code,'CONTRIBUTOR_PENDING_LIMIT');}}
  assert.equal(granted,6);assert.equal(denied,15);
  assert.equal(await charged(),300*MB); // antes: 21 × 50 MB = 1.050 MB
  assert.ok(await charged()<=400*MB);
 });
 test('pedidos simultâneos do mesmo contribuidor respeitam o teto (adaptador serializa: não prova concorrência multiconexão)',async()=>{
  await start({CONTRIBUTOR_UPLOADS_ENABLED:'true'});await register('ta','Ana');
  const results=await Promise.all(Array.from({length:12},()=>call('ta','POST','/api/v1/media/uploads',{})));
  assert.equal(results.filter(r=>r.status===201).length,2);
  assert.equal(results.filter(r=>r.status===429).length,10);
  assert.equal(await charged(),100*MB);
 });
 test('orçamento global esgotado: contribuidores recebem 503 com código próprio; administrador continua enviando (inclusive com corte)',async()=>{
  await start({CONTRIBUTOR_UPLOADS_ENABLED:'true',MEDIA_TRIMMING_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');await register('tc','Caio');
  for(const o of [ids.anonA,ids.anonA,ids.anonA,ids.anonB,ids.anonB,ids.anonB,ids.anonC,ids.anonC])await readyBig(o,45*MB); // 360 MB
  const full=await call('tc','POST','/api/v1/media/uploads',{});assert.equal(full.status,503,full.text);assert.equal(full.json.error.code,'CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED');
  const adm=await call('admin','POST','/api/v1/media/uploads',{clip:{startSeconds:1,endSeconds:3}});assert.equal(adm.status,201,adm.text);
  assert.equal(await charged(),360*MB);
  // limpeza manual comprovada (linha apagada após remover o objeto) devolve capacidade
  await db.query("delete from public.media_assets where id=(select id from public.media_assets where contributor_id is not null limit 1)");
  assert.equal((await call('tc','POST','/api/v1/media/uploads',{})).status,201);
 });
 test('mídia que falha continua cobrada e a publicação existente não é afetada',async()=>{
  await start({CONTRIBUTOR_UPLOADS_ENABLED:'true'});await register('ta','Ana');
  const up=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(up.status,201);const id=up.json.data.mediaId;
  await db.query("update public.media_assets set status='queued' where id=$1",[id]);
  await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);
  await db.query("update public.media_assets set status='failed',locked_until=null,error='{\"code\":\"INVALID_MEDIA\"}' where id=$1",[id]);
  assert.equal(await charged(),50*MB); // o arquivo pode continuar no Storage: nada é liberado automaticamente
  const r=(await db.query<any>("select count(*)::int n from public.contributor_reclaim_candidates()")).rows[0].n;assert.equal(r,0); // recente: ainda não é candidato
  // slot de pendente liberado: pode tentar de novo
  assert.equal((await call('ta','POST','/api/v1/media/uploads',{})).status,201);
 });
});

describe('S3 — cota de mídia na importação responde 429 (TikTok e Instagram)',()=>{
 afterEach(stop);
 for(const [provider,meta,selection] of [['tiktok',tiktok,clip],['instagram',instagram,igClip]] as const){
  test(`${provider}: cota horária esgotada → 429 CONTRIBUTOR_QUOTA_EXCEEDED, seleção revertida e repetível depois`,async()=>{
   await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');
   for(let i=0;i<10;i++)await readyBig(ids.anonA,1000);
   const ins=await call('ta','POST','/api/v1/media/imports/inspect',{sourceUrl:meta.sourceUrl});assert.equal(ins.status,201,ins.text);
   const sourceId=ins.json.data.sourceId;
   const before=(await db.query<any>('select count(*)::int n from public.media_assets')).rows[0].n;
   const r=await call('ta','POST','/api/v1/media/imports',{sourceId,clip:selection});
   assert.equal(r.status,429,r.text);assert.equal(r.json.error.code,'CONTRIBUTOR_QUOTA_EXCEEDED'); // antes: 503 SERVICE_UNAVAILABLE
   assert.equal((await db.query<any>('select count(*)::int n from public.media_assets')).rows[0].n,before); // nenhuma mídia criada
   assert.equal((await db.query<any>('select media_id from public.import_sources where id=$1',[sourceId])).rows[0].media_id,null); // fonte não foi consumida
   // a janela passa: a MESMA fonte volta a funcionar
   await db.exec('alter table public.media_assets disable trigger user');await db.exec("update public.media_assets set created_at=now()-interval '2 hours'");await db.exec('alter table public.media_assets enable trigger user');
   const again=await call('ta','POST','/api/v1/media/imports',{sourceId,clip:selection});assert.equal(again.status,201,again.text);assert.equal(again.json.data.sourceType,provider);
  });
  test(`${provider}: cota diária esgotada → 429`,async()=>{
   await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');
   for(let batch=0;batch<3;batch++){ // 10/h por vez; cada lote é empurrado para fora da janela horária, mas fica dentro do dia
    for(let i=0;i<10;i++)await readyBig(ids.anonA,1000);
    await db.exec('alter table public.media_assets disable trigger user');await db.exec("update public.media_assets set created_at=now()-interval '2 hours'");await db.exec('alter table public.media_assets enable trigger user');
   }
   const ins=await call('ta','POST','/api/v1/media/imports/inspect',{sourceUrl:meta.sourceUrl});assert.equal(ins.status,201,ins.text);
   const r=await call('ta','POST','/api/v1/media/imports',{sourceId:ins.json.data.sourceId,clip:selection});assert.equal(r.status,429,r.text);assert.equal(r.json.error.code,'CONTRIBUTOR_QUOTA_EXCEEDED');
  });
  test(`${provider}: pendentes, bytes e orçamento global têm o mesmo contrato de erro`,async()=>{
   await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');
   const ins=await call('ta','POST','/api/v1/media/imports/inspect',{sourceUrl:meta.sourceUrl});assert.equal(ins.status,201,ins.text);const sourceId=ins.json.data.sourceId;
   // 1) pendentes
   for(let i=0;i<2;i++)await db.query('insert into public.media_assets(owner_id,source_type,storage_key) values($1,$2,$3)',[ids.anonA,'upload',`${crypto.randomUUID()}/source.mp4`]);
   const pend=await call('ta','POST','/api/v1/media/imports',{sourceId,clip:selection});assert.equal(pend.status,429,pend.text);assert.equal(pend.json.error.code,'CONTRIBUTOR_PENDING_LIMIT');
   await db.exec("delete from public.media_assets");
   // 2) bytes do contribuidor: 3 × 49 MB reais + a reserva de 50 MB não cabem em 150 MB
   for(let i=0;i<3;i++)await readyBig(ids.anonA,49*MB);
   const mine=await call('ta','POST','/api/v1/media/imports',{sourceId,clip:selection});assert.equal(mine.status,429,mine.text);assert.equal(mine.json.error.code,'CONTRIBUTOR_STORAGE_EXCEEDED');
   await db.exec("delete from public.media_assets");
   // 3) orçamento global: capacidade do serviço → 503 com código próprio (não "SERVICE_UNAVAILABLE" genérico)
   for(let i=1;i<=3;i++){const u=`00000000-0000-4000-8000-0000000000f${i}`;await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[u]);await db.query('select public.register_contributor($1,$2)',[u,`Bot ${i}`]);
    for(let j=0;j<(i===3?2:3);j++)await readyBig(u,45*MB);} // 8 × 45 MB = 360 MB
   assert.equal(await charged(),360*MB);
   const full=await call('ta','POST','/api/v1/media/imports',{sourceId,clip:selection});assert.equal(full.status,503,full.text);assert.equal(full.json.error.code,'CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED');
 });
 }
 test('erros já existentes do importador seguem iguais (fonte inexistente 404, seleção inválida 400, fonte de outro 404)',async()=>{
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');
  const ins=await call('ta','POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl});const sourceId=ins.json.data.sourceId;
  assert.equal((await call('ta','POST','/api/v1/media/imports',{sourceId:'00000000-0000-4000-8000-00000000dead',clip})).status,404);
  assert.equal((await call('ta','POST','/api/v1/media/imports',{sourceId,clip:{startSeconds:0,endSeconds:500}})).status,400);
  assert.equal((await call('tb','POST','/api/v1/media/imports',{sourceId,clip})).status,404);
  assert.equal((await call('ta','POST','/api/v1/media/imports',{sourceId,clip})).status,201);
 });
});

describe('S2 — importações de contribuidores não bloqueiam o administrador',()=>{
 afterEach(stop);
 const seedSources=async(owners:string[],each:number)=>{for(const o of owners)for(let i=0;i<each;i++)await db.query('insert into public.import_sources(owner_id) values($1)',[o]);};
 const inspect=(t:string)=>call(t,'POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl});

 test('reprodução do achado S2: pool de contribuidores esgotado → contribuidor 429, administrador segue com as suas 20/h',async()=>{
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');await register('tc','Caio');
  await seedSources([ids.anonA,ids.anonB,ids.anonC],7); // 21 reservas já consumidas por contribuidores (sondagem do Codex usou 50)
  const c=await inspect('tc');assert.equal(c.status,429,c.text);assert.equal(c.json.error.code,'IMPORT_RATE_LIMIT');
  for(let i=0;i<20;i++){const r=await inspect('admin');assert.equal(r.status,201,`admin ${i}: ${r.text}`);}
  assert.equal((await inspect('admin')).status,429); // limite individual do administrador preservado
 });
 test('um contribuidor não monopoliza: 6 inspeções/h, as falhas do importador também contam, os outros e o admin seguem',async()=>{
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');
  extractor=async()=>{throw Object.assign(new Error('IMPORT_HTTP_ERROR'),{statusCode:422,code:'IMPORT_HTTP_ERROR'});}; // importador falhando
  for(let i=0;i<6;i++)assert.equal((await inspect('ta')).status,422);
  extractor=defaultExtractor;
  const seventh=await inspect('ta');assert.equal(seventh.status,429,seventh.text);assert.equal(seventh.json.error.code,'IMPORT_RATE_LIMIT');
  assert.equal((await inspect('tb')).status,201);
  assert.equal((await inspect('admin')).status,201);
 });
 test('orçamento de tempo do slot: contribuidor sem tempo → 429; administrador e outros contribuidores entram',async()=>{
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');
  await db.query("insert into private.import_slot_usage(holder,owner_id,seconds) values($1,$2,120),($3,$2,120),($4,$2,120),($5,$2,30)",[crypto.randomUUID(),ids.anonA,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]); // 390 s no último hora
  const r=await inspect('ta');assert.equal(r.status,429,r.text);assert.equal(r.json.error.code,'IMPORT_RATE_LIMIT');
  assert.equal((await inspect('tb')).status,201);
  assert.equal((await inspect('admin')).status,201);
 });
 test('o slot é liberado ao final e o tempo não usado é devolvido: uso real fica minúsculo',async()=>{
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');
  assert.equal((await inspect('ta')).status,201);
  const used=Number((await db.query<any>('select coalesce(sum(seconds),0) s from private.import_slot_usage where owner_id=$1',[ids.anonA])).rows[0].s);
  assert.ok(used>=1&&used<=5,`uso ${used}s (reservado 30s, devolvido ao liberar)`);
  assert.equal((await db.query<any>('select holder from private.import_slot')).rows[0].holder,null);
 });
 test('administrador não consome o orçamento de contribuidores e mantém os fluxos de importação existentes',async()=>{
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');
  for(let i=0;i<3;i++)assert.equal((await inspect('admin')).status,201);
  assert.equal(Number((await db.query<any>("select count(*) c from private.import_slot_usage where owner_id=$1",[ids.admin])).rows[0].c),3);
  for(let i=0;i<6;i++)assert.equal((await inspect('ta')).status,201); // 6 inteiras para a Ana, mesmo com o admin tendo inspecionado antes
  const ins=await call('admin','POST','/api/v1/media/imports/inspect',{sourceUrl:instagram.sourceUrl});assert.equal(ins.status,201,ins.text);
  const sel=await call('admin','POST','/api/v1/media/imports',{sourceId:ins.json.data.sourceId,clip:igClip});assert.equal(sel.status,201,sel.text);assert.equal(sel.json.data.sourceType,'instagram');
 });
 test('flag de importação continua desligada por padrão: contribuidor 403 e nenhuma reserva/slot consumidos',async()=>{
  await start();await register('ta','Ana');
  const r=await inspect('ta');assert.equal(r.status,403);
  assert.equal((await db.query<any>('select count(*)::int n from public.import_sources')).rows[0].n,0);
  assert.equal((await db.query<any>('select count(*)::int n from private.import_slot_usage')).rows[0].n,0);
  assert.equal((await inspect('admin')).status,201); // administrador não é afetado pela flag
 });
});
