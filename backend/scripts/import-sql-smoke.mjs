// Local PostgreSQL WASM only; does NOT read .env or open a remote DB connection.
// Install isolated test tool: npm install --prefix vendor/sql-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.13
import {PGlite} from '../vendor/sql-test/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();let assertions=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);assertions++;};
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const denied=async(sql,args=[],pattern)=>{await assert.rejects(db.query(sql,args),pattern);assertions++;};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 alter default privileges in schema public grant all on tables to service_role;`);
 for(const name of ['001_initial.sql','002_maps.sql','003_media_import_sources_and_40_seconds.sql','004_grenade_origin.sql','20261030124528_tiktok_import_sessions.sql'])await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
 const owner='123e4567-e89b-42d3-a456-426614174000',other='123e4567-e89b-42d3-a456-426614174001';
 await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await denied('select * from public.import_sources',[],/permission denied/);
  await denied('select public.reserve_import_source($1)',[owner],/permission denied/);
  await denied('select public.claim_import_slot($1,30)',[owner],/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 check((await one('select public.claim_import_slot($1,30) as ok',[owner])).ok,true);
 check((await one('select public.claim_import_slot($1,30) as ok',[other])).ok,false);
 await db.query('select public.release_import_slot($1)',[other]);
 check((await one('select public.claim_import_slot($1,30) as ok',[other])).ok,false);
 await db.query('select public.release_import_slot($1)',[owner]);
 check((await one('select public.claim_import_slot($1,30) as ok',[other])).ok,true);await db.query('select public.release_import_slot($1)',[other]);
 const source=await one('select * from public.reserve_import_source($1)',[owner]);
 const metadata={provider:'tiktok',sourceUrl:'https://www.tiktok.com/@creator/video/7701366996495125766',videoId:'7701366996495125766',title:'Tutorial',author:'Autor',durationSeconds:4000};
 await db.query('update public.import_sources set metadata=$2 where id=$1',[source.id,metadata]);
 const clip={startSeconds:1800,endSeconds:1810};
 await denied('select * from public.create_tiktok_import($1,$2,$3)',[source.id,other,clip],/SOURCE_NOT_FOUND/);
 const media=await one('select * from public.create_tiktok_import($1,$2,$3)',[source.id,owner,clip]);
 check(media.status,'queued');check(media.source_url,metadata.sourceUrl);check(media.clip,clip);check(media.import_source_id,source.id);
 check((await one('select * from public.create_tiktok_import($1,$2,$3)',[source.id,owner,clip])).id,media.id);
 await denied('select * from public.create_tiktok_import($1,$2,$3)',[source.id,owner,{startSeconds:1800,endSeconds:1811}],/IMPORT_SELECTION_CONFLICT/);
 await db.query("update public.import_sources set expires_at=now()-interval '1 second' where id=$1",[source.id]);
 check((await one('select * from public.create_tiktok_import($1,$2,$3)',[source.id,owner,clip])).id,media.id);
 await denied('update public.media_assets set clip=$2 where id=$1',[media.id,{startSeconds:1800,endSeconds:1811}],/immutable/);
 await denied('update public.media_assets set import_snapshot=$2 where id=$1',[media.id,{...metadata,durationSeconds:6000}],/immutable/);
 const expired=await one('select * from public.reserve_import_source($1)',[owner]);
 await db.query("update public.import_sources set metadata=$2,expires_at=now()-interval '1 second' where id=$1",[expired.id,metadata]);
 await denied('select * from public.create_tiktok_import($1,$2,$3)',[expired.id,owner,clip],/SOURCE_EXPIRED/);
 // Upload source limit180 remains enforced despite independent TikTok cap7200.
 await denied("insert into public.media_assets(owner_id,source_type,storage_key,clip) values($1,'upload','invalid-source.mp4',$2)",[owner,clip],/media_assets_clip_check/);
 const available=await one('select * from public.reserve_import_source($1)',[owner]);await db.query('update public.import_sources set metadata=$2 where id=$1',[available.id,metadata]);
 for(const bad of [{startSeconds:0,endSeconds:90.001},{startSeconds:3999,endSeconds:4001},{startSeconds:-1,endSeconds:10},{startSeconds:0.0001,endSeconds:1},null])await denied('select * from public.create_tiktok_import($1,$2,$3)',[available.id,owner,bad],/CLIP_OUT_OF_RANGE|media_assets_clip_check/);
 for(let i=3;i<10;i++)await db.query('select public.reserve_import_source($1)',[owner]);
 await denied('select public.reserve_import_source($1)',[owner],/IMPORT_RATE_LIMIT/);
 check(Number((await one('select count(*) as total from public.media_assets')).total),1);
 console.log(JSON.stringify({engine:'PGlite PostgreSQL WASM 0.5.13',localOnly:true,assertions,appliedMigrations:5,rlsAndGrants:'PASS',atomicSelectionAndIdempotency:'PASS',expiryAndRecovery:'PASS',globalSlot:'PASS',rateLimit:'PASS',remoteSupabaseValidated:false}));
}finally{await db.close();}
