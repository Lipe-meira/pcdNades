// Explicitly limited to this synthetic lab; never accepts a remote URL/directory.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import Fastify from 'fastify';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {configureApp} from '../dist/application.js';
const dir=new URL('../vendor/rollout-loopback-20261108/',import.meta.url);
const raw=readFileSync(new URL('status.private.json',dir),'utf8');const k=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
assert.equal(new URL(k.API_URL).origin,'http://127.0.0.1:58621');assert.equal(new URL(k.DB_URL).hostname,'127.0.0.1');assert.equal(new URL(k.DB_URL).port,'58622');
const opts={auth:{persistSession:false,autoRefreshToken:false}},svc=createClient(k.API_URL,k.SERVICE_ROLE_KEY,opts),pub=createClient(k.API_URL,k.ANON_KEY,opts),pool=new pg.Pool({connectionString:k.DB_URL});
const password=randomUUID()+'aA1!',suffix=randomUUID();
let adminEmail;
const container='supabase_db_rollout-loopback-20261108';
const compose=new URL('source-round4-compose.private.json',dir);
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true});if(r.status)throw Error('Docker step failed: '+args.slice(0,3).join(' '));return r.stdout;};
const all=JSON.parse(docker(['inspect',...Object.keys(JSON.parse(readFileSync(compose,'utf8')).services)]));
for(const c of all)for(const bs of Object.values(c.NetworkSettings.Ports??{}))for(const b of bs??[])assert.equal(b.HostIp,'127.0.0.1','loopback required BEFORE testing');
const old=await import('./../vendor/rollout-loopback-20261108/old/backend/src/application.ts');
let lockProcess,vite,browser;

async function account(tag){const email=`${tag}-${suffix}@fixture.invalid`;if(tag==='admin')adminEmail=email;const r=await svc.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(r.error);const login=await pub.auth.signInWithPassword({email,password});assert.ifError(login.error);return {id:r.data.user.id,token:login.data.session.access_token};}
Object.assign(process.env,{MEDIA_UPLOAD_ENABLED:'true',MEDIA_PROCESSOR_MODE:'inline-original',API_WRITES_PAUSED:'false',SUPABASE_URL:k.API_URL,SUPABASE_PUBLISHABLE_KEY:k.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:k.SERVICE_ROLE_KEY,CORS_ORIGINS:'http://127.0.0.1:58703',FRONTEND_URL:'http://127.0.0.1:58703'});
const clients={service:svc,public:pub,user:t=>createClient(k.API_URL,k.ANON_KEY,{...opts,global:{headers:{Authorization:`Bearer ${t}`}}})};
async function waitServices(){for(let i=0;i<60;i++){try{const r=await fetch(k.API_URL+'/auth/v1/health',{headers:{apikey:k.ANON_KEY}});const q=await fetch(k.API_URL+'/rest/v1/',{headers:{apikey:k.ANON_KEY}});if(r.ok&&q.ok&&!(await svc.storage.listBuckets()).error)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Real services not ready');}
let app,paused;
try{
 await waitServices();
 const admin=await account('admin'),viewer=await account('viewer');writeFileSync(new URL('accounts-round4.private.json',dir),JSON.stringify({adminEmail,password,admin,viewer}));await pool.query('insert into private.administrators(user_id) values($1)',[admin.id]);
 app=old.configureApp(Fastify({logger:false}),clients);await app.listen({host:'127.0.0.1',port:0});const origin=app.server.address();const base=`http://127.0.0.1:${origin.port}/api/v1`;
 const request=async(method,path,body,token=admin.token)=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:r.status===204?null:await r.json()};};
 assert.equal((await request('POST','/media/uploads',{},null)).status,401);assert.equal((await request('POST','/media/uploads',{},viewer.token)).status,403);
 const u=await request('POST','/media/uploads',{});assert.equal(u.status,201);const session=u.data.data,mp4=readFileSync(new URL('../../frontend/tests/fixtures/test-pattern.mp4',import.meta.url));
 const upload=await svc.storage.from('videos-staging').uploadToSignedUrl(session.upload.path,session.upload.token,mp4,{contentType:'video/mp4'});assert.ifError(upload.error);
 const done=await request('POST',`/media/${session.mediaId}/complete`,{});assert.equal(done.status,200,JSON.stringify(done.data));assert.equal(done.data.data.status,'ready');
 const draft={title:'Synthetic legacy',mapId:'mirage',type:'smoke',side:'T',instructions:'Fixture',target:{x:.3,y:.5},videoId:session.mediaId};
 const legacy=await request('POST','/grenades',draft);assert.equal(legacy.status,201);const id=legacy.data.data.id;
 process.env.API_WRITES_PAUSED='true';paused=configureApp(Fastify({logger:false}),clients);await paused.listen({host:'127.0.0.1',port:0});const pp=paused.server.address().port;
 const blocked=await fetch(`http://127.0.0.1:${pp}/api/v1/grenades`,{method:'POST',headers:{Authorization:`Bearer ${admin.token}`,'Content-Type':'application/json'},body:JSON.stringify(draft)});assert.equal(blocked.status,503);
 // Full lab outage is the deliberate operational freeze, not API flag alone.
 const pending=await request('POST','/media/uploads',{});assert.equal(pending.status,201);
 await app.close();app=undefined;
 await paused.close();paused=undefined;
 const services=all.map(c=>c.Name.slice(1)).filter(n=>n!==container);
 docker(['stop',...services]);
 await assert.rejects(fetch(k.API_URL+'/rest/v1/grenades',{signal:AbortSignal.timeout(3000)}));
 await assert.rejects(fetch(pending.data.data.upload.url,{method:'PUT',body:mp4,signal:AbortSignal.timeout(3000)}));
 const tx=await pool.connect();await tx.query('BEGIN');await tx.query('update public.grenades set title=$1 where id=$2',['Drained before backup',id]);
 const finishing=tx.query('SELECT pg_sleep(0.4); COMMIT');
 lockProcess=spawn('docker',['exec','-i',container,'psql','-U','supabase_admin','-d','source_round4','-At','-v','ON_ERROR_STOP=1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const frozen=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Freeze lock deadline')),10000);lockProcess.stdout.on('data',d=>{if(d.toString().includes('FROZEN')){clearTimeout(timer);resolve();}});lockProcess.on('exit',()=>reject(Error('Freeze holder exited')));});
 lockProcess.stdin.write("BEGIN; LOCK TABLE public.grenades,public.media_assets,public.import_sources,public.import_preview_jobs,storage.objects,storage.buckets IN SHARE MODE; SELECT 'FROZEN';\n");
 await finishing;tx.release();await frozen;
 await pool.query("set lock_timeout='200ms'");await assert.rejects(pool.query('update public.grenades set title=$1 where id=$2',['must block',id]),e=>e.code==='55P03');await pool.query("set lock_timeout='0'");
 let writers; for(let i=0;i<40;i++){writers=await pool.query("select count(*)::int as n from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state='active' and wait_event_type is distinct from 'Client' and query ~* '(insert|update|delete)' ");if(writers.rows[0].n===0)break;await new Promise(r=>setTimeout(r,250));}assert.equal(writers.rows[0].n,0);
 docker(['exec',container,'pg_dump','-U','supabase_admin','-Fc','-f','/tmp/pre-revision-round4.dump','source_round4']);
 docker(['exec',container,'createdb','-U','supabase_admin','-O','postgres','recovered_round6']);
 docker(['exec',container,'pg_restore','-U','supabase_admin','--exit-on-error','-d','recovered_round6','/tmp/pre-revision-round4.dump']);
 const storageVolume='pcdnades-storage-recovered-20261108';const restoreVolume='pcdnades-storage-recovered-round6-20261108';
 // /tmp is not shared through volumes-from: retain the stream privately instead.
 const tar=spawnSync('docker',['run','--rm','--network','none','--mount',`type=volume,source=${storageVolume},target=/objects,readonly`,'postgres:17','tar','--xattrs','--xattrs-include=*','-czf','-','-C','/objects','.'],{maxBuffer:10000000,windowsHide:true});assert.equal(tar.status,0);writeFileSync(new URL('storage-pre-round4.private.tar.gz',dir),tar.stdout);
 docker(['volume','create',restoreVolume]);
 const unpack=spawnSync('docker',['run','--rm','-i','--network','none','--mount',`type=volume,source=${restoreVolume},target=/objects`,'postgres:17','tar','--xattrs','--xattrs-include=*','-xzf','-','-C','/objects'],{input:tar.stdout,windowsHide:true});assert.equal(unpack.status,0);
 lockProcess.stdin.end('ROLLBACK;\n');await new Promise(r=>lockProcess.on('exit',r));lockProcess=undefined;
 // Archive is PRE revision, while original DB proceeds through the cutover.

 const migration=name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
 await pool.query(migration('20261105210000_import_source_individual_limit_20.sql'));
 const f=await pool.query("select prosrc from pg_proc where oid='public.reserve_import_source(uuid)'::regprocedure");assert.match(f.rows[0].prosrc,/>=20/);
 await pool.query("insert into supabase_migrations.schema_migrations(version,name,statements) values('20261105210000','synthetic_reconciled_effect',array[]::text[])");
 await pool.query(migration('20261105170000_grenade_revision.sql'));
 await pool.query("insert into supabase_migrations.schema_migrations(version,name,statements) values('20261105170000','synthetic_revision',array[]::text[])");
 docker(['start',...services]);
 await waitServices();
 process.env.API_WRITES_PAUSED='false';app=configureApp(Fastify({logger:false}),clients);await app.listen({host:'127.0.0.1',port:origin.port});
 const loaded=await request('GET',`/grenades/${id}`);assert.equal(loaded.data.data.revision,1);assert.equal(loaded.data.data.origin,null);
 assert.equal((await request('PATCH',`/grenades/${id}`,{title:'old client'})).status,428);
 const pair=await Promise.all(['A','B'].map(title=>request('PATCH',`/grenades/${id}`,{title,expectedRevision:1})));assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
 assert.equal((await request('PATCH',`/grenades/${id}`,{title:'Viewer',expectedRevision:2},viewer.token)).status,403);
 const direct=createClient(k.API_URL,k.ANON_KEY,{...opts,global:{headers:{Authorization:`Bearer ${admin.token}`}}});const denied=await direct.from('grenades').update({title:'bypass'}).eq('id',id);assert.ok(denied.error);
 const solo=await request('POST','/grenades',{...draft,title:'Synthetic Solo',type:'solo_exec',origin:{x:.1,y:.2},destinations:[{x:.3,y:.5,type:'smoke'},{x:.7,y:.8,type:'flashbang'}]});assert.equal(solo.status,201,JSON.stringify(solo.data));assert.equal(solo.data.data.destinations.length,2);
 const playback=await request('GET',`/media/${session.mediaId}/playback`,undefined,null);assert.equal(playback.status,200);const bytes=await fetch(playback.data.data.url);assert.equal(bytes.status,200);const result=Buffer.from(await bytes.arrayBuffer());assert.equal(createHash('sha256').update(result).digest('hex'),createHash('sha256').update(mp4).digest('hex'));
 // Switch actual GoTrue/PostgREST/Storage to the restored DB and restored object volume.
 await app.close();app=undefined;docker(['stop',...services]);
 const cfg=JSON.parse(readFileSync(compose,'utf8'));
 for(const [name,service] of Object.entries(cfg.services)){
  if(name===container)continue;
  service.environment=service.environment.map(v=>v.replace(/\/source_round4(?=($|\?))/g,'/recovered_round6').replace(/^PG_META_DB_NAME=source_round4$/,'PG_META_DB_NAME=recovered_round6').replace(/^DB_DATABASE=source_round4$/,'DB_DATABASE=recovered_round6'));
  for(const m of service.volumes??[])if(m.source===storageVolume)m.source=restoreVolume;
 }
 cfg.volumes[restoreVolume]={external:true,name:restoreVolume};const recoveredCompose=new URL('recovered-compose.private.json',dir);writeFileSync(recoveredCompose,JSON.stringify(cfg));
 docker(['compose','-f',recoveredCompose.pathname.replace(/^\/([A-Za-z]:)/,'$1'),'up','-d']);
 // DB stays the same container; services point at the restored database.
 await waitServices();const recoveredUrl=new URL(k.DB_URL);recoveredUrl.pathname='/recovered_round6';const recoveredPool=new pg.Pool({connectionString:recoveredUrl.href});
 const restoredOld=await recoveredPool.query('select title from public.grenades where id=$1',[id]);assert.equal(restoredOld.rows[0].title,'Drained before backup');
 const restoredLogin=await pub.auth.signInWithPassword({email:adminEmail,password});assert.ifError(restoredLogin.error);
 await recoveredPool.query(migration('20261105170000_grenade_revision.sql'));
 await recoveredPool.query(migration('20261105210000_import_source_individual_limit_20.sql'));
 await recoveredPool.end();
 app=configureApp(Fastify({logger:false}),clients);await app.listen({host:'127.0.0.1',port:origin.port});
 assert.equal((await request('GET',`/grenades/${id}`)).data.data.title,'Drained before backup');
 assert.equal((await request('PATCH',`/grenades/${id}`,{title:'Recovered operational',expectedRevision:1})).status,200);
 assert.equal((await request('PATCH',`/grenades/${id}`,{title:'Denied',expectedRevision:2},viewer.token)).status,403);
 const rp=await request('GET',`/media/${session.mediaId}/playback`,undefined,null);assert.equal(rp.status,200);const rb=Buffer.from(await(await fetch(rp.data.data.url)).arrayBuffer());assert.equal(createHash('sha256').update(rb).digest('hex'),createHash('sha256').update(mp4).digest('hex'));
 assert.equal((await request('POST','/grenades',{...draft,title:'Created after recovery'})).status,201);
 const frontendRequire=createRequire(new URL('../../frontend/package.json',import.meta.url)),{chromium}=frontendRequire('@playwright/test');
 vite=spawn(process.execPath,[new URL('../../frontend/node_modules/vite/bin/vite.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'--host','127.0.0.1','--port','58703','--strictPort'],{cwd:new URL('../../frontend/',import.meta.url),windowsHide:true,stdio:'ignore',env:{...process.env,VITE_DATA_MODE:'api',VITE_API_URL:base,VITE_SUPABASE_URL:k.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:k.PUBLISHABLE_KEY}});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:58703')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:58703');await page.getByRole('link',{name:'Administração',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(adminEmail);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('button',{name:'Editar Recovered operational',exact:true}).click();await page.getByLabel('Título',{exact:true}).fill('Browser operational recovery');await page.getByRole('button',{name:'Vídeo e revisão'}).click();await page.getByRole('button',{name:'Salvar granada',exact:true}).click();await page.getByRole('button',{name:'Editar Browser operational recovery',exact:true}).waitFor();await browser.close();browser=undefined;
 const evidence={result:'PASS',httpFastify:true,realGoTrueLogin:true,realPostgREST:true,realStorage:true,mp4UploadProcessPlaybackHash:true,adminViewer401403:true,revision409428:true,concurrentEdits:true,directUpdateDenied:true,legacyAndSolo:true,apiMaintenanceAdmission:true,freezeLabServicesAndDbLocks:true,preRevisionBackup:true,realServicesOnRestoredDbAndObjects:true,realFrontendRecoveryEdit:true,globalProductionFreezeProven:false};writeFileSync(new URL('http-result.private.json',dir),JSON.stringify(evidence));console.log(JSON.stringify(evidence));
}finally{lockProcess?.stdin.end('ROLLBACK;\n');await browser?.close();vite?.kill();await app?.close();await paused?.close();await pool.end();}
