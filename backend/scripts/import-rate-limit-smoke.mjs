// Offline PostgreSQL17 fixture in a disposable container. No env/remote DB access.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const initial=read('migrations/20261030124528_tiktok_import_sessions.sql');
const old=initial.slice(initial.indexOf('create function public.reserve_import_source'),initial.indexOf('-- Selection stays immutable.')).trim();
const migration=read('migrations/20261105210000_import_source_individual_limit_20.sql');
assert.equal(migration.slice(migration.indexOf('create or replace function'),migration.lastIndexOf('commit;')).trim(),old.replace('create function','create or replace function').replace(')>=10',')>=20'));
const name=`pcdnades-rate-limit-${process.pid}`;
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;}
try{
 docker(['run','--detach','--rm','--network','none','--name',name,'--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17.11-alpine']);
 let ready=false;for(let i=0;i<40;i++){const r=spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{encoding:'utf8'});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'PostgreSQL startup');
 const fixture=`create role anon;create role authenticated;create role service_role;create table public.import_sources(id uuid primary key default gen_random_uuid(),owner_id uuid not null,metadata jsonb,media_id uuid,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes');\n${old}\nrevoke all on function public.reserve_import_source(uuid) from public,anon,authenticated;grant execute on function public.reserve_import_source(uuid) to service_role;\n`;
 const sql=read('tests/sql/import-source-rate-limit.sql');
 const exec=input=>docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],input);
 exec(fixture);
 const red=spawnSync('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});
 assert.notEqual(red.status,0,'baseline10 must fail the new test');assert.match(red.stderr,/IMPORT_RATE_LIMIT/);console.log('RED: baseline10 rejects before19, as expected');
 exec(migration);console.log(exec(sql));
 console.log('PASS: migration body differs only by20; real local PostgreSQL17.11. No remote Supabase/Storage/TikTok.');
}finally{spawnSync('docker',['stop',name],{encoding:'utf8'});}
