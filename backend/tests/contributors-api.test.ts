// Autorização da API de publicação colaborativa sobre PostgreSQL REAL (PGlite): RLS, triggers e constraints valem de verdade.
// Limite: o adaptador substitui PostgREST/GoTrue/Storage (ver tests/support/supabase-pg.ts); não é teste no Supabase.
import {test,describe,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import type {PGlite} from '@electric-sql/pglite';
import {buildApp} from '../src/application.js';
import {createDb,ids,seedUsers,seedMap,readyMedia} from './support/pg.js';
import {createSupabaseOverPg} from './support/supabase-pg.js';

const member='00000000-0000-4000-8000-0000000000c9'; // usuário permanente (não anônimo) que não é admin
const tokens={admin:{sub:ids.admin,anonymous:false},ta:{sub:ids.anonA,anonymous:true},tb:{sub:ids.anonB,anonymous:true},tc:{sub:ids.anonC,anonymous:true},member:{sub:member,anonymous:false}};
const tiktok={provider:'tiktok',sourceUrl:'https://www.tiktok.com/@creator/video/7701366996495125766',videoId:'7701366996495125766',title:'Tutorial',author:'Autor',durationSeconds:4000};
const envKeys=['CONTRIBUTORS_ENABLED','CONTRIBUTOR_IMPORTS_ENABLED','CONTRIBUTOR_UPLOADS_ENABLED','MEDIA_UPLOAD_ENABLED','MEDIA_TIKTOK_ADMIN_USER_ID','FRONTEND_URL'];

let db:PGlite,app:ReturnType<typeof buildApp>,saved:Record<string,string|undefined>;
async function start(env:Record<string,string|undefined>={}){
 saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{CONTRIBUTORS_ENABLED:'true',CONTRIBUTOR_UPLOADS_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'true',MEDIA_TIKTOK_ADMIN_USER_ID:ids.admin,FRONTEND_URL:'http://localhost:5173'},env);
 for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];
 db=await createDb();await db.query('insert into auth.users(id,is_anonymous) values($1,false)',[member]);await seedUsers(db);await seedMap(db);
 const sb=createSupabaseOverPg(db,Object.fromEntries(Object.entries(tokens)));
 app=buildApp(sb.clients,{available:()=>true,extract:async()=>({metadata:tiktok as any})});
}
async function stop(){await app.close();await db.close();for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
const call=async(token:string|null,method:'GET'|'POST'|'PATCH'|'DELETE',url:string,payload?:unknown)=>{
 const r=await app.inject({method,url,headers:token?{authorization:`Bearer ${token}`}:{},...(payload!==undefined?{payload:payload as any}:{})});
 let json:any;try{json=r.json();}catch{json=null;}return {status:r.statusCode,json,text:r.body};
};
const grenadeBody=(videoId:string,over:Record<string,unknown>={})=>({title:'Smoke janela',mapId:'de_mirage',type:'smoke',side:'T',instructions:'Alinhe a mira',target:{x:0.1,y:0.2},videoId,...over});
const register=async(token:string,nickname:string)=>{const r=await call(token,'POST','/api/v1/contributors',{nickname});assert.ok([200,201].includes(r.status),r.text);return r;};
const row=async(id:string)=>(await db.query<any>('select * from public.grenades where id=$1',[id])).rows[0];
const contributorOf=async(uid:string)=>(await db.query<any>('select contributor_id from public.contributor_links where auth_user_id=$1',[uid])).rows[0]?.contributor_id;

describe('sem sessão ou sem permissão',()=>{
 before(()=>start());after(stop);
 test('visitante sem sessão: lê a biblioteca, mas publicar/editar/excluir/enviar dá 401 (#8)',async()=>{
  assert.equal((await call(null,'GET','/api/v1/grenades')).status,200);
  assert.equal((await call(null,'GET','/api/v1/maps')).status,200);
  const vid=await readyMedia(db,ids.admin);
  for(const [m,u,p] of [['POST','/api/v1/grenades',grenadeBody(vid)],['PATCH',`/api/v1/grenades/${vid}`,{title:'x',expectedRevision:1}],['DELETE',`/api/v1/grenades/${vid}`,undefined],['POST','/api/v1/media/uploads',{}],['POST','/api/v1/contributors',{nickname:'Ana'}],['GET','/api/v1/me',undefined],['GET','/api/v1/me/grenades',undefined]] as const)
   assert.equal((await call(null,m,u,p)).status,401,`${m} ${u}`);
  assert.equal((await call('token-invalido','POST','/api/v1/grenades',grenadeBody(vid))).status,401);
 });
 test('anônimo sem apelido e usuário permanente não publicam; só anônimo cria apelido; admin não vira contribuidor',async()=>{
  const vid=await readyMedia(db,ids.anonC);
  const r=await call('tc','POST','/api/v1/grenades',grenadeBody(vid));assert.equal(r.status,403);assert.equal(r.json.error.code,'CONTRIBUTOR_REQUIRED');
  assert.equal((await call('tc','GET','/api/v1/me')).status,403);
  assert.equal((await call('member','POST','/api/v1/contributors',{nickname:'Perm'})).status,403); // papel authenticated sozinho não basta
  assert.equal((await call('member','POST','/api/v1/grenades',grenadeBody(vid))).status,403);
  assert.equal((await call('admin','POST','/api/v1/contributors',{nickname:'Adm'})).status,403);
  assert.equal((await db.query<any>('select count(*)::int n from public.contributors')).rows[0].n,0);
 });
 test('apelidos inválidos ou reservados são recusados',async()=>{
  for(const nickname of ['','a','x'.repeat(25),'Admin','  ADMINISTRADOR ','pcdNades','Ana\u0000','<b>oi</b>','ana\nbia',42 as any])
   assert.equal((await call('tc','POST','/api/v1/contributors',{nickname})).status,400,String(nickname));
  assert.equal((await call('tc','POST','/api/v1/contributors',{nickname:'Ana',authorId:'x'})).status,400);
 });
});

describe('com a flag desligada nada muda para quem não é admin',()=>{
 before(()=>start({CONTRIBUTORS_ENABLED:undefined,CONTRIBUTOR_UPLOADS_ENABLED:undefined}));after(stop);
 test('contribuidores ficam fechados e a capability informa',async()=>{
  assert.equal((await call('tc','POST','/api/v1/contributors',{nickname:'Ana'})).status,403);
  const vid=await readyMedia(db,ids.anonC);
  assert.equal((await call('tc','POST','/api/v1/grenades',grenadeBody(vid))).status,403);
  assert.equal((await call(null,'GET','/api/v1/media/capabilities')).json.data.contributors.enabled,false);
 });
});

describe('fluxo colaborativo',()=>{
 let a:string,b:string; // contribuidores
 beforeEach(async()=>{await start();await register('ta','Ana');await register('tb','Bia');a=await contributorOf(ids.anonA);b=await contributorOf(ids.anonB);});
 afterEach(stop);

 test('capability, /me e criação de apelido idempotente',async()=>{
  assert.equal((await call(null,'GET','/api/v1/media/capabilities')).json.data.contributors.enabled,true);
  assert.deepEqual((await call('ta','GET','/api/v1/me')).json.data,{role:'contributor',nickname:'Ana'});
  assert.deepEqual((await call('admin','GET','/api/v1/me')).json.data,{role:'admin'});
  const again=await call('ta','POST','/api/v1/contributors',{nickname:'Outro'});assert.equal(again.status,200);assert.equal(again.json.data.nickname,'Ana');
  assert.equal((await db.query<any>('select count(*)::int n from public.contributors')).rows[0].n,2); });

 test('A publica (#1): autoria vem do servidor e o corpo não pode trazê-la',async()=>{
  const vid=await readyMedia(db,ids.anonA);
  for(const extra of [{authorId:b},{author_id:b},{ownerId:b},{author:{nickname:'Bia'}}])assert.equal((await call('ta','POST','/api/v1/grenades',grenadeBody(vid,extra))).status,400);
  const r=await call('ta','POST','/api/v1/grenades',grenadeBody(vid));
  assert.equal(r.status,201,r.text);assert.deepEqual(r.json.data.author,{nickname:'Ana'});
  assert.equal((await row(r.json.data.id)).author_id,a);
  assert.ok(!JSON.stringify(r.json).includes(a)); // o id do contribuidor não vaza
 });

 test('A edita a própria granada (#2) com controle de revisão; B recebe 403 (#3) e não assume a autoria (#4)',async()=>{
  const vid=await readyMedia(db,ids.anonA);const g=(await call('ta','POST','/api/v1/grenades',grenadeBody(vid))).json.data;
  const ok=await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{title:'Novo título',expectedRevision:g.revision});
  assert.equal(ok.status,200);assert.equal(ok.json.data.title,'Novo título');assert.equal(ok.json.data.revision,2);
  const stale=await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{title:'Velho',expectedRevision:1});assert.equal(stale.status,409);assert.equal(stale.json.error.code,'GRENADE_VERSION_CONFLICT');
  const denied=await call('tb','PATCH',`/api/v1/grenades/${g.id}`,{title:'Invadida',expectedRevision:2});
  assert.equal(denied.status,403);assert.equal((await row(g.id)).title,'Novo título');
  for(const body of [{authorId:b},{author_id:b},{ownerId:b}]){const r=await call('tb','PATCH',`/api/v1/grenades/${g.id}`,{...body,expectedRevision:2});assert.ok([400,403].includes(r.status));}
  const own=await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{authorId:b,expectedRevision:2});assert.equal(own.status,400); // nem o dono transfere
  assert.equal((await row(g.id)).author_id,a);
  assert.equal((await call('tb','PATCH',`/api/v1/grenades/00000000-0000-4000-8000-000000000000`,{title:'x',expectedRevision:1})).status,404); });

 test('conflito de revisão: duas edições do dono com a mesma revisão, uma vence',async()=>{
  const vid=await readyMedia(db,ids.anonA);const g=(await call('ta','POST','/api/v1/grenades',grenadeBody(vid))).json.data;
  const rs=await Promise.all(['A','B'].map(t=>call('ta','PATCH',`/api/v1/grenades/${g.id}`,{title:t,expectedRevision:1})));
  assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]); });

 test('ninguém exclui granada além do admin: nem o dono (#5), nem outro contribuidor; admin exclui as de A e B (#7)',async()=>{
  const ga=(await call('ta','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonA)))).json.data;
  const gb=(await call('tb','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonB)))).json.data;
  assert.equal((await call('ta','DELETE',`/api/v1/grenades/${ga.id}`)).status,403);
  assert.equal((await call('tb','DELETE',`/api/v1/grenades/${ga.id}`)).status,403);
  assert.equal((await call('tc','DELETE',`/api/v1/grenades/${ga.id}`)).status,403);
  assert.equal((await call(null,'DELETE',`/api/v1/grenades/${ga.id}`)).status,401);
  assert.ok(await row(ga.id));
  assert.equal((await call('admin','DELETE',`/api/v1/grenades/${ga.id}`)).status,204);
  assert.equal((await call('admin','DELETE',`/api/v1/grenades/${gb.id}`)).status,204);
  assert.equal(await row(ga.id),undefined);assert.equal(await row(gb.id),undefined);
 });

 test('admin edita granadas de A e B (#6) sem virar autor; publicação de admin não tem autor',async()=>{
  const ga=(await call('ta','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonA)))).json.data;
  const gb=(await call('tb','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonB)))).json.data;
  for(const g of [ga,gb]){const r=await call('admin','PATCH',`/api/v1/grenades/${g.id}`,{instructions:'Revisado pelo admin',expectedRevision:g.revision});assert.equal(r.status,200,r.text);assert.equal(r.json.data.instructions,'Revisado pelo admin');}
  assert.equal((await row(ga.id)).author_id,a);assert.equal((await row(gb.id)).author_id,b);
  const adminVideo=await readyMedia(db,ids.admin);
  const pub=await call('admin','POST','/api/v1/grenades',grenadeBody(adminVideo));assert.equal(pub.status,201,pub.text);assert.equal(pub.json.data.author,null);assert.equal((await row(pub.json.data.id)).author_id,null); });

 test('vincular vídeo de outra pessoa é recusado na criação e na edição (#10)',async()=>{
  const mediaA=await readyMedia(db,ids.anonA);const mediaB=await readyMedia(db,ids.anonB);const adminMedia=await readyMedia(db,ids.admin);
  const roubo=await call('tb','POST','/api/v1/grenades',grenadeBody(mediaA));assert.equal(roubo.status,403);assert.equal(roubo.json.error.code,'VIDEO_NOT_OWNED');
  assert.equal((await call('tb','POST','/api/v1/grenades',grenadeBody(adminMedia))).status,403); // nem o vídeo do admin/legado
  assert.equal((await call('tb','POST','/api/v1/grenades',grenadeBody('00000000-0000-4000-8000-0000000000aa'))).status,403); // inexistente não revela nada
  const gb=(await call('tb','POST','/api/v1/grenades',grenadeBody(mediaB))).json.data;
  const troca=await call('tb','PATCH',`/api/v1/grenades/${gb.id}`,{videoId:mediaA,expectedRevision:gb.revision});assert.equal(troca.status,403);
  assert.equal((await row(gb.id)).video_id,mediaB);
  assert.equal((await db.query<any>('select count(*)::int n from public.grenades')).rows[0].n,1); });

 test('reedição de corte respeita a propriedade do vídeo (#11)',async()=>{
  const m1=await readyMedia(db,ids.anonA),m2=await readyMedia(db,ids.anonA),mediaB=await readyMedia(db,ids.anonB),adminMedia=await readyMedia(db,ids.admin);
  const g=(await call('ta','POST','/api/v1/grenades',grenadeBody(m1))).json.data;
  const own=await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{videoId:m2,expectedRevision:1});assert.equal(own.status,200,own.text);assert.equal(own.json.data.video.id,m2);
  assert.equal((await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{videoId:mediaB,expectedRevision:2})).status,403);
  assert.equal((await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{videoId:adminMedia,expectedRevision:2})).status,403); // contribuidor não anexa mídia sem dono
  const adm=await call('admin','PATCH',`/api/v1/grenades/${g.id}`,{videoId:adminMedia,expectedRevision:2});assert.equal(adm.status,200,adm.text); // admin refaz o corte do vídeo alheio
  assert.equal((await row(g.id)).author_id,a);
  assert.equal((await call('admin','PATCH',`/api/v1/grenades/${g.id}`,{videoId:mediaB,expectedRevision:3})).status,403); // nem admin troca por vídeo de OUTRO contribuidor (invariante do banco)
 });

 test('apelido é só exibição: renomear (inclusive para o apelido de outro) não altera autoria nem permissões (#9)',async()=>{
  const ga=(await call('ta','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonA)))).json.data;
  const gb=(await call('tb','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonB)))).json.data;
  const rename=await call('ta','PATCH','/api/v1/me',{nickname:'Bia'});assert.equal(rename.status,200);assert.equal(rename.json.data.nickname,'Bia');
  assert.equal((await row(ga.id)).author_id,a);
  assert.equal((await call('ta','PATCH',`/api/v1/grenades/${ga.id}`,{title:'Ainda minha',expectedRevision:1})).status,200);
  assert.equal((await call('ta','PATCH',`/api/v1/grenades/${gb.id}`,{title:'Agora é minha?',expectedRevision:1})).status,403); // mesmo apelido ≠ mesma identidade
  assert.equal((await call('tb','PATCH',`/api/v1/grenades/${ga.id}`,{title:'Dele',expectedRevision:2})).status,403);
  const list=(await call(null,'GET','/api/v1/grenades')).json.data;assert.equal(list.find((x:any)=>x.id===ga.id).author.nickname,'Bia');
  assert.equal((await call('ta','PATCH','/api/v1/me',{nickname:'Admin'})).status,400);
  assert.equal((await call('ta','PATCH','/api/v1/me',{nickname:'Ok',contributorId:b})).status,400);
  assert.equal((await call('tc','PATCH','/api/v1/me',{nickname:'Nova'})).status,403); });

 test('biblioteca pública mostra o autor (sem expor ids); /me/grenades lista só as próprias',async()=>{
  const ga=(await call('ta','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonA),{title:'Da Ana'}))).json.data;
  const gb=(await call('tb','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonB),{title:'Da Bia'}))).json.data;
  const pub=await call(null,'GET','/api/v1/grenades');assert.equal(pub.status,200);
  assert.equal(pub.json.data.find((x:any)=>x.id===ga.id).author.nickname,'Ana');
  assert.ok(!pub.text.includes(a)&&!pub.text.includes(b)&&!pub.text.includes(ids.anonA)&&!/author_?[iI]d/.test(pub.text));
  assert.equal((await call(null,'GET',`/api/v1/grenades/${gb.id}`)).json.data.author.nickname,'Bia');
  const mine=await call('ta','GET','/api/v1/me/grenades');assert.equal(mine.status,200);assert.deepEqual(mine.json.data.map((x:any)=>x.id),[ga.id]);
  assert.equal(mine.json.data[0].revision,1);
  assert.equal((await call('admin','GET','/api/v1/me/grenades')).status,403); });

 test('registros antigos continuam acessíveis; só admin edita (#13)',async()=>{
  const legacy=(await db.query<any>("insert into public.grenades(title,map_id,type,side,instructions,target,video_id) values('Histórica','de_mirage','smoke','T','x','{\"x\":0.3,\"y\":0.3}',$1) returning id",[await readyMedia(db,ids.admin)])).rows[0].id;
  const one=await call(null,'GET',`/api/v1/grenades/${legacy}`);assert.equal(one.status,200);assert.equal(one.json.data.author,null);assert.equal(one.json.data.title,'Histórica');
  assert.ok((await call(null,'GET','/api/v1/grenades')).json.data.some((x:any)=>x.id===legacy));
  assert.equal((await call('ta','PATCH',`/api/v1/grenades/${legacy}`,{title:'Minha agora',expectedRevision:1})).status,403);
  assert.equal((await call('ta','DELETE',`/api/v1/grenades/${legacy}`)).status,403);
  assert.equal((await call('admin','PATCH',`/api/v1/grenades/${legacy}`,{title:'Revisada',expectedRevision:1})).status,200);
  assert.equal((await row(legacy)).author_id,null); });

 test('uploads: dono definido pelo servidor, mídia alheia inacessível, falha não destrói publicações (#12), cota vira 429',async()=>{
  const g=(await call('ta','POST','/api/v1/grenades',grenadeBody(await readyMedia(db,ids.anonA)))).json.data;
  const up=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(up.status,201,up.text);const mid=up.json.data.mediaId;
  assert.equal((await db.query<any>('select contributor_id from public.media_assets where id=$1',[mid])).rows[0].contributor_id,a);
  assert.equal((await call('ta','GET',`/api/v1/media/${mid}`)).status,200);
  assert.equal((await call('tb','GET',`/api/v1/media/${mid}`)).status,404);
  assert.equal((await call('admin','GET',`/api/v1/media/${mid}`)).status,200);
  assert.equal((await call('tb','POST',`/api/v1/media/${mid}/complete`,{})).status,404); // mídia alheia = inexistente
  assert.equal((await call(null,'POST',`/api/v1/media/${mid}/complete`,{})).status,401);
  const failed=await call('ta','POST',`/api/v1/media/${mid}/complete`,{});assert.equal(failed.status,409); // o arquivo nunca foi enviado
  const notReady=await call('ta','PATCH',`/api/v1/grenades/${g.id}`,{videoId:mid,expectedRevision:1});assert.equal(notReady.status,409);assert.equal(notReady.json.error.code,'VIDEO_NOT_READY');
  const still=await call(null,'GET',`/api/v1/grenades/${g.id}`);assert.equal(still.status,200);assert.equal(still.json.data.video.status,'ready');assert.equal(still.json.data.revision,1); // publicação intacta
  assert.equal((await call('tb','POST','/api/v1/grenades',grenadeBody(mid))).status,403);
  assert.equal((await call('ta','POST','/api/v1/media/uploads',{})).status,201); // 2º pendente
  const third=await call('ta','POST','/api/v1/media/uploads',{});assert.equal(third.status,429,third.text);assert.equal(third.json.error.code,'CONTRIBUTOR_PENDING_LIMIT'); // teto de pendentes (S1)
  // cota de QUANTIDADE (10 mídias/h) é independente do teto de pendentes: Bia completa 10 mídias e a 11ª é barrada
  for(let i=0;i<10;i++)await readyMedia(db,ids.anonB);
  const over=await call('tb','POST','/api/v1/media/uploads',{});assert.equal(over.status,429,over.text);assert.equal(over.json.error.code,'CONTRIBUTOR_QUOTA_EXCEEDED');
  assert.equal((await call('admin','POST','/api/v1/media/uploads',{})).status,201); });

 test('importação por link: fechada para contribuidores por padrão; liberada pela flag, sempre presa ao dono',async()=>{
  const closed=await call('ta','POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl});assert.equal(closed.status,403);
  assert.equal((await call('ta','GET','/api/v1/media/imports/00000000-0000-4000-8000-0000000000ab/preview')).status,403);
  await stop();
  await start({CONTRIBUTOR_IMPORTS_ENABLED:'true'});await register('ta','Ana');await register('tb','Bia');
  const caps=(await call(null,'GET','/api/v1/media/capabilities')).json.data;assert.equal(caps.contributors.imports,true);
  const ins=await call('ta','POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl});assert.equal(ins.status,201,ins.text);
  const sourceId=ins.json.data.sourceId;
  assert.equal((await db.query<any>('select owner_id from public.import_sources where id=$1',[sourceId])).rows[0].owner_id,ids.anonA);
  const clip={startSeconds:1800,endSeconds:1810};
  const cross=await call('tb','POST','/api/v1/media/imports',{sourceId,clip});assert.equal(cross.status,404); // fonte inspecionada por A não é de B
  const mine=await call('ta','POST','/api/v1/media/imports',{sourceId,clip});assert.equal(mine.status,201,mine.text);
  const media=mine.json.data.mediaId;
  assert.equal((await db.query<any>('select contributor_id from public.media_assets where id=$1',[media])).rows[0].contributor_id,await contributorOf(ids.anonA));
  assert.equal((await call('tb','GET',`/api/v1/media/${media}`)).status,404);
  assert.equal((await call('tb','POST',`/api/v1/media/${media}/complete`,{})).status,404);
  assert.equal((await call('tb','GET',`/api/v1/media/${media}/import-playback`)).status,404);
  assert.equal((await call('tc','POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl})).status,403); // anônimo sem apelido
  assert.equal((await call('member','POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl})).status,403);
  // Admin: regra anterior intacta (só o uid de MEDIA_TIKTOK_ADMIN_USER_ID)
  assert.equal((await call('admin','POST','/api/v1/media/imports/inspect',{sourceUrl:tiktok.sourceUrl})).status,201);
 });
});
