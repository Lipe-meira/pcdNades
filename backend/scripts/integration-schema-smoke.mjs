import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../',import.meta.url), name=`pcdnades-full-${process.pid}`;
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8'});if(r.status)throw Error(r.stderr||r.stdout);return r.stdout;}
const exec=sql=>docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],sql);
try{
 docker(['run','-d','--rm','--network','none','--name',name,'--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.11-alpine']);
 for(let i=0;i<60;i++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres']).status===0)break;await new Promise(r=>setTimeout(r,250));}
 exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 alter default privileges in schema public grant all on tables to service_role;`);
 const paths=['migrations/','supabase/migrations/'].flatMap(dir=>readdirSync(new URL(dir,base)).filter(f=>f.endsWith('.sql')).map(f=>({name:f,path:dir+f}))).sort((a,b)=>a.name.localeCompare(b.name));
 for(const f of paths)exec(readFileSync(new URL(f.path,base),'utf8'));
 exec(`insert into auth.users values('00000000-0000-4000-8000-000000000003');insert into private.administrators values('00000000-0000-4000-8000-000000000003');
 insert into public.media_assets(id,owner_id,source_type,storage_key) values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','upload','fixture.mp4');
 update public.media_assets set status='queued';update public.media_assets set status='processing',locked_until=now()+interval '1 minute';update public.media_assets set status='ready',locked_until=null,metadata='{"durationSeconds":1,"bytes":10,"mimeType":"video/mp4"}';
 insert into public.grenades(id,title,map_id,type,side,instructions,target,video_id,destinations,origin_x,origin_y) values('00000000-0000-4000-8000-000000000002','Original','mirage','solo_exec','T','Fixture','{"x":0.3,"y":0.5}','00000000-0000-4000-8000-000000000001','[{"x":0.3,"y":0.5,"type":"smoke"}]',0.1,0.2);
 do $$begin assert not has_table_privilege('authenticated','public.grenades','UPDATE');assert not has_column_privilege('authenticated','public.grenades','title','UPDATE');assert has_table_privilege('service_role','public.grenades','UPDATE');assert(select relrowsecurity from pg_class where oid='public.grenades'::regclass);end$$;
 begin;set role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';do $$begin assert public.is_admin();end$$;rollback;
 begin;set role anon;do $$begin assert(select count(*) from public.grenades)=1;end$$;rollback;
 begin;set role service_role;update public.grenades set title='Updated' where revision=1;rollback;
 do $$begin assert(select revision from public.grenades)=1;assert(select status from public.media_assets)='ready';end$$;`);
 // Isolate rate-limit fixture owners; FK remains real.
 exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');`);
 console.log(exec(readFileSync(new URL('tests/sql/import-source-rate-limit.sql',base),'utf8')));
 // Synthetic-only archive/restore in this run's disposable container.
 docker(['exec',name,'pg_dump','-U','postgres','-Fc','-f','/tmp/synthetic.dump','postgres']);
 docker(['exec',name,'pg_restore','--list','/tmp/synthetic.dump']);
 docker(['exec',name,'createdb','-U','postgres','restored_synthetic']);
 docker(['exec',name,'pg_restore','-U','postgres','--exit-on-error','--clean','--if-exists','-d','restored_synthetic','/tmp/synthetic.dump']);
 const fingerprint=`select md5(coalesce((select string_agg(row_to_json(g)::text,',' order by id) from public.grenades g),'')),md5(coalesce((select string_agg(row_to_json(m)::text,',' order by id) from public.media_assets m),'')),(select relrowsecurity from pg_class where oid='public.grenades'::regclass),has_table_privilege('authenticated','public.grenades','UPDATE'),(select count(*) from pg_trigger where tgrelid='public.grenades'::regclass and not tgisinternal)`;
 const a=docker(['exec',name,'psql','-U','postgres','-d','postgres','-Atc',fingerprint]);
 const b=docker(['exec',name,'psql','-U','postgres','-d','restored_synthetic','-Atc',fingerprint]);
 assert.equal(a,b,'restored rows/RLS/grants/triggers match');
 console.log('PASS synthetic pg_dump custom archive + pg_restore, row fingerprints/RLS/grants/triggers identical; not a Storage-byte or production backup.');
 console.log(`PASS ${paths.length} migrations complete application schema, real PostgreSQL17.11; RLS/grants/admin RPC/media/rollback. Auth identity and Storage schema are synthetic, no GoTrue/PostgREST/Storage HTTP.`);
}finally{spawnSync('docker',['stop',name],{encoding:'utf8'});}
