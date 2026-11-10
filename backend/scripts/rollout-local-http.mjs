// Explicitly limited to this synthetic lab; never accepts a remote URL/directory.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import Fastify from 'fastify';
import {configureApp} from '../dist/application.js';
const dir=new URL('../vendor/rollout-lab-20261108/',import.meta.url);
const raw=readFileSync(new URL('status.private.json',dir),'utf8');const k=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
assert.equal(new URL(k.API_URL).origin,'http://127.0.0.1:58521');assert.equal(new URL(k.DB_URL).hostname,'127.0.0.1');assert.equal(new URL(k.DB_URL).port,'58522');
const opts={auth:{persistSession:false,autoRefreshToken:false}},svc=createClient(k.API_URL,k.SERVICE_ROLE_KEY,opts),pub=createClient(k.API_URL,k.ANON_KEY,opts),pool=new pg.Pool({connectionString:k.DB_URL});
const password=randomUUID()+'aA1!',suffix=randomUUID();
async function account(tag){const email=`${tag}-${suffix}@fixture.invalid`;const r=await svc.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(r.error);const login=await pub.auth.signInWithPassword({email,password});assert.ifError(login.error);return {id:r.data.user.id,token:login.data.session.access_token};}
Object.assign(process.env,{MEDIA_UPLOAD_ENABLED:'true',MEDIA_PROCESSOR_MODE:'inline-original',API_WRITES_PAUSED:'false',SUPABASE_URL:k.API_URL,SUPABASE_PUBLISHABLE_KEY:k.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:k.SERVICE_ROLE_KEY});
const clients={service:svc,public:pub,user:t=>createClient(k.API_URL,k.ANON_KEY,{...opts,global:{headers:{Authorization:`Bearer ${t}`}}})};
let app,paused;
try{
 const admin=await account('admin'),viewer=await account('viewer');await pool.query('insert into private.administrators(user_id) values($1)',[admin.id]);
 app=configureApp(Fastify({logger:false}),clients);await app.listen({host:'127.0.0.1',port:0});const origin=app.server.address();const base=`http://127.0.0.1:${origin.port}/api/v1`;
 const request=async(method,path,body,token=admin.token)=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:r.status===204?null:await r.json()};};
 assert.equal((await request('POST','/media/uploads',{},null)).status,401);assert.equal((await request('POST','/media/uploads',{},viewer.token)).status,403);
 const u=await request('POST','/media/uploads',{});assert.equal(u.status,201);const session=u.data.data,mp4=readFileSync(new URL('../../frontend/tests/fixtures/test-pattern.mp4',import.meta.url));
 const upload=await svc.storage.from('videos-staging').uploadToSignedUrl(session.upload.path,session.upload.token,mp4,{contentType:'video/mp4'});assert.ifError(upload.error);
 const done=await request('POST',`/media/${session.mediaId}/complete`,{});assert.equal(done.status,200,JSON.stringify(done.data));assert.equal(done.data.data.status,'ready');
 const draft={title:'Synthetic legacy',mapId:'mirage',type:'smoke',side:'T',instructions:'Fixture',target:{x:.3,y:.5},videoId:session.mediaId};
 const legacy=await request('POST','/grenades',draft);assert.equal(legacy.status,201);const id=legacy.data.data.id;
 process.env.API_WRITES_PAUSED='true';paused=configureApp(Fastify({logger:false}),clients);await paused.listen({host:'127.0.0.1',port:0});const pp=paused.server.address().port;
 const blocked=await fetch(`http://127.0.0.1:${pp}/api/v1/grenades`,{method:'POST',headers:{Authorization:`Bearer ${admin.token}`,'Content-Type':'application/json'},body:JSON.stringify(draft)});assert.equal(blocked.status,503);
 // No in-flight request remains in this synthetic test; this is not global drain proof.
 await app.close();app=undefined;
 const migration=name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
 await pool.query(migration('20261105210000_import_source_individual_limit_20.sql'));
 const f=await pool.query("select prosrc from pg_proc where oid='public.reserve_import_source(uuid)'::regprocedure");assert.match(f.rows[0].prosrc,/>=20/);
 await pool.query("insert into supabase_migrations.schema_migrations(version,name,statements) values('20261105210000','synthetic_reconciled_effect',array[]::text[])");
 await pool.query(migration('20261105170000_grenade_revision.sql'));
 await pool.query("insert into supabase_migrations.schema_migrations(version,name,statements) values('20261105170000','synthetic_revision',array[]::text[])");
 process.env.API_WRITES_PAUSED='false';app=configureApp(Fastify({logger:false}),clients);await app.listen({host:'127.0.0.1',port:origin.port});
 const loaded=await request('GET',`/grenades/${id}`);assert.equal(loaded.data.data.revision,1);assert.equal(loaded.data.data.origin,null);
 assert.equal((await request('PATCH',`/grenades/${id}`,{title:'old client'})).status,428);
 const pair=await Promise.all(['A','B'].map(title=>request('PATCH',`/grenades/${id}`,{title,expectedRevision:1})));assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
 assert.equal((await request('PATCH',`/grenades/${id}`,{title:'Viewer',expectedRevision:2},viewer.token)).status,403);
 const direct=createClient(k.API_URL,k.ANON_KEY,{...opts,global:{headers:{Authorization:`Bearer ${admin.token}`}}});const denied=await direct.from('grenades').update({title:'bypass'}).eq('id',id);assert.ok(denied.error);
 const solo=await request('POST','/grenades',{...draft,title:'Synthetic Solo',type:'solo_exec',origin:{x:.1,y:.2},destinations:[{x:.3,y:.5,type:'smoke'},{x:.7,y:.8,type:'flashbang'}]});assert.equal(solo.status,201,JSON.stringify(solo.data));assert.equal(solo.data.data.destinations.length,2);
 const playback=await request('GET',`/media/${session.mediaId}/playback`,undefined,null);assert.equal(playback.status,200);const bytes=await fetch(playback.data.data.url);assert.equal(bytes.status,200);const result=Buffer.from(await bytes.arrayBuffer());assert.equal(createHash('sha256').update(result).digest('hex'),createHash('sha256').update(mp4).digest('hex'));
 const evidence={result:'PASS',httpFastify:true,realGoTrueLogin:true,realPostgREST:true,realStorage:true,mp4UploadProcessPlaybackHash:true,adminViewer401403:true,revision409428:true,concurrentEdits:true,directUpdateDenied:true,legacyAndSolo:true,apiMaintenanceAdmission:true,globalDrainProven:false,fullRolloutApproved:false};writeFileSync(new URL('http-result.private.json',dir),JSON.stringify(evidence));console.log(JSON.stringify(evidence));
}finally{await app?.close();await paused?.close();await pool.end();}
