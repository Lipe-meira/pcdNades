// PostgreSQL WASM, no network/remote credentials; tool installed separately in vendor/sql-test.
import {PGlite} from '../vendor/sql-test/node_modules/@electric-sql/pglite/dist/index.js';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter default privileges in schema public grant all on tables to service_role;");
 const apply=async name=>db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
 for(const name of ['001_initial.sql','002_maps.sql','003_media_import_sources_and_40_seconds.sql','004_grenade_origin.sql','20261030124528_tiktok_import_sessions.sql'])await apply(name);
 const owner='123e4567-e89b-42d3-a456-426614174000';await db.query('insert into auth.users values($1)',[owner]);
 const media=(await db.query("insert into public.media_assets(owner_id,source_type,storage_key) values($1,'upload','legacy.mp4') returning id",[owner])).rows[0].id;
 await db.query("update public.media_assets set status='queued' where id=$1",[media]);await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[media]);await db.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[media,{durationSeconds:2,bytes:100,mimeType:'video/mp4'}]);
 const grenade=(await db.query("insert into public.grenades(title,map_id,type,side,instructions,target,video_id) values('Legacy',(select id from public.maps limit 1),'smoke','T','Legacy fixture','{\"x\":0.1,\"y\":0.2}',$1) returning *",[media])).rows[0];
 for(const name of ['20261101152756_solo_exec_destinations.sql','20261101153422_instagram_import_sessions.sql','20261102000337_import_source_previews.sql'])await apply(name);
 const after=(await db.query('select * from public.grenades where id=$1',[grenade.id])).rows[0];const {destinations,...legacy}=after;assert.equal(destinations,null);assert.deepEqual(legacy,grenade);checks+=2;
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);for(const sql of ['select * from public.import_preview_jobs','select * from public.import_preview_maintenance',`select public.reserve_source_preview('${media}','${owner}')`,`select public.create_instagram_import('${media}','${owner}','{}')`]){await assert.rejects(db.query(sql),/permission denied/);checks++;}await db.exec('reset role');}
 await assert.rejects(db.query('update public.grenades set type=$2 where id=$1',[grenade.id,'solo_exec']),/grenades_solo_destinations_check/);checks++;
 await db.exec('begin');await db.query('update public.grenades set title=$2 where id=$1',[grenade.id,'rollback fixture']);await db.exec('rollback');assert.equal((await db.query('select title from public.grenades where id=$1',[grenade.id])).rows[0].title,'Legacy');checks++;
 console.log(JSON.stringify({engine:'PGlite 0.5.13',checks,legacyPreserved:true,newMigrationOrderValidated:true,rlsGrantsDenied:true,transactionRollback:true,remoteApplied:false}));
}finally{await db.close();}
