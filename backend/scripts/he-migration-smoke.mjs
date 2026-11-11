// PostgreSQL WASM, sem rede nem credenciais remotas; ferramenta instalada separadamente em vendor/sql-test.
// Valida a migration HE em banco descartável: nada é aplicado em ambiente remoto.
import {PGlite} from '../vendor/sql-test/node_modules/@electric-sql/pglite/dist/index.js';import {readFile,readdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir=new URL('../migrations',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');const db=new PGlite();let checks=0;const ok=()=>checks++;
const pre="create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter default privileges in schema public grant all on tables to service_role;";
try{
 await db.exec(pre);
 const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 const heName='20261111015949_he_grenade_type.sql';const heIndex=files.indexOf(heName);assert.ok(heIndex>0,'migration HE não encontrada');
 for(const f of files.slice(0,heIndex))await db.exec(await readFile(`${dir}/${f}`,'utf8'));
 const owner='123e4567-e89b-42d3-a456-426614174000';await db.query('insert into auth.users values($1)',[owner]);
 const media=(await db.query("insert into public.media_assets(owner_id,source_type,storage_key) values($1,'upload','a.mp4') returning id",[owner])).rows[0].id;
 await db.query("update public.media_assets set status='queued' where id=$1",[media]);await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[media]);await db.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[media,{durationSeconds:2,bytes:100,mimeType:'video/mp4'}]);
 const ins=(type,dest,origin)=>db.query("insert into public.grenades(title,map_id,type,side,instructions,target,origin_x,origin_y,destinations,video_id) values('t',(select id from public.maps limit 1),$1,'T','i','{\"x\":0.1,\"y\":0.2}',$3,$4,$2,$5) returning *",[type,dest?JSON.stringify(dest):null,origin?0.5:null,origin?0.5:null,media]);
 const legacy=[(await ins('smoke')).rows[0],(await ins('solo_exec',[{x:0.1,y:0.2,type:'molotov'}],true)).rows[0]];
 await assert.rejects(ins('he'),/grenades_type_check/);ok();
 await assert.rejects(ins('solo_exec',[{x:0.1,y:0.2,type:'he'}],true),/grenades_solo_destinations_check/);ok();
 const snap=async()=>({acl:(await db.query("select proname,proacl::text acl,proowner::regrole::text o,prosecdef from pg_proc where proname='valid_solo_destinations'")).rows,pol:(await db.query("select tablename,policyname,roles::text,cmd,qual,with_check from pg_policies order by 1,2")).rows,rls:(await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1")).rows,grants:(await db.query("select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' order by 1,2,3")).rows});
 const before=await snap();
 await db.exec(await readFile(`${dir}/${heName}`,'utf8'));
 const after=await snap();assert.deepEqual(after,before);ok();
 const rows=(await db.query('select * from public.grenades where id = any($1) order by created_at,id',[legacy.map(r=>r.id)])).rows;
 for(const l of legacy)assert.deepEqual(rows.find(r=>r.id===l.id),l);ok();
 const he=(await ins('he')).rows[0];assert.equal(he.type,'he');assert.equal(he.destinations,null);ok();
 const solo=(await ins('solo_exec',[{x:0.1,y:0.2,type:'he'},{x:0.3,y:0.4,type:'smoke'}],true)).rows[0];assert.equal(solo.destinations[0].type,'he');ok();
 await assert.rejects(ins('frag'),/grenades_type_check/);ok();
 await assert.rejects(ins('solo_exec',[{x:0.1,y:0.2,type:'frag'}],true),/grenades_solo_destinations_check/);ok();
 await assert.rejects(ins('he',[{x:0.1,y:0.2,type:'he'}],false),/grenades_solo_destinations_check/);ok();
 await db.exec('set role anon');await assert.rejects(db.query("select private.valid_solo_destinations('[]')"),/permission denied/);ok();await db.exec('reset role');
 console.log(JSON.stringify({engine:'PGlite 0.5.13',checks,migrations:files.length,legacyPreserved:true,aclPoliciesRlsUnchanged:true,remoteApplied:false}));
}finally{await db.close();}
