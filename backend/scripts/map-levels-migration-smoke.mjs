// PostgreSQL WASM, sem rede nem credenciais remotas; ferramenta instalada separadamente em vendor/sql-test.
// Valida a migration de andares em banco descartável: nada é aplicado em ambiente remoto.
import {PGlite} from '../vendor/sql-test/node_modules/@electric-sql/pglite/dist/index.js';import {readFile,readdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir=new URL('../migrations',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const rollbackFile=new URL('../rollbacks/20261111031252_map_levels_rollback.sql',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const db=new PGlite();let checks=0;const ok=()=>checks++;
const pre="create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter default privileges in schema public grant all on tables to service_role;";
try{
 await db.exec(pre);
 const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 const name='20261111031252_map_levels.sql';assert.equal(files.at(-1),name,'a migration de andares deve ser a última');
 for(const f of files.slice(0,-1))await db.exec(await readFile(`${dir}/${f}`,'utf8'));
 // Produção tem a Nuke cadastrada em public.maps (as migrations locais só semeiam 3 mapas).
 await db.query("insert into public.maps(id,name,radar) values('nuke','Nuke','{\"imageUrl\":\"/maps/valve/nuke.png\",\"width\":1024,\"height\":1024,\"coordinateVersion\":\"valve-nuke-v1\"}')");
 const owner='123e4567-e89b-42d3-a456-426614174000';await db.query('insert into auth.users values($1)',[owner]);
 const media=(await db.query("insert into public.media_assets(owner_id,source_type,storage_key) values($1,'upload','a.mp4') returning id",[owner])).rows[0].id;
 await db.query("update public.media_assets set status='queued' where id=$1",[media]);await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[media]);await db.query("update public.media_assets set status='ready',locked_until=null,metadata=$2 where id=$1",[media,{durationSeconds:2,bytes:100,mimeType:'video/mp4'}]);
 const ins=(o)=>db.query("insert into public.grenades(title,map_id,type,side,instructions,target,origin_x,origin_y,destinations,origin_level,target_level,video_id) values('t',$1,$2,'T','i',$3,$4,$5,$6,$7,$8,$9) returning *",[o.map??'mirage',o.type??'smoke',JSON.stringify(o.target??{x:0.1,y:0.2}),o.origin?0.5:null,o.origin?0.5:null,o.dest?JSON.stringify(o.dest):null,o.ol??null,o.tl??null,media]);
 // linhas anteriores à migration (sem as colunas novas)
 const legacyIns=(type,dest,origin)=>db.query("insert into public.grenades(title,map_id,type,side,instructions,target,origin_x,origin_y,destinations,video_id) values('t','mirage',$1,'T','i','{\"x\":0.1,\"y\":0.2}',$3,$4,$2,$5) returning *",[type,dest?JSON.stringify(dest):null,origin?0.5:null,origin?0.5:null,media]);
 const legacy=[(await legacyIns('smoke')).rows[0],(await legacyIns('he')).rows[0],(await legacyIns('solo_exec',[{x:0.1,y:0.2,type:'molotov'},{x:0.3,y:0.3,type:'he'}],true)).rows[0]];
 const snap=async()=>({fn:(await db.query("select proname,proacl::text acl,proowner::regrole::text o,prosecdef from pg_proc where proname='valid_solo_destinations'")).rows,pol:(await db.query("select tablename,policyname,roles::text,cmd,qual,with_check from pg_policies order by 1,2")).rows,rls:(await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1")).rows,grants:(await db.query("select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' order by 1,2,3")).rows,trg:(await db.query("select tgname,tgenabled::text from pg_trigger where tgrelid='public.grenades'::regclass and not tgisinternal order by 1")).rows});
 const before=await snap();
 const typeBefore=(await db.query("select pg_get_constraintdef(oid) d from pg_constraint where conname='grenades_type_check'")).rows[0].d;
 await db.exec(await readFile(`${dir}/${name}`,'utf8'));
 const after=await snap();assert.deepEqual(after,before);ok(); // ACL, policies, RLS, grants e triggers idênticos
 assert.equal((await db.query("select pg_get_constraintdef(oid) d from pg_constraint where conname='grenades_type_check'")).rows[0].d,typeBefore);ok();
 const rows=(await db.query('select * from public.grenades where id = any($1)',[legacy.map(r=>r.id)])).rows;
 for(const l of legacy){const row=rows.find(r=>r.id===l.id);const {origin_level,target_level,...rest}=row;assert.deepEqual(rest,l);assert.equal(origin_level,null);assert.equal(target_level,null);}ok(); // legado intacto, andares nulos
 const nukeSmoke=(await ins({map:'nuke',origin:true,ol:'upper',tl:'lower'})).rows[0];assert.equal(nukeSmoke.origin_level,'upper');assert.equal(nukeSmoke.target_level,'lower');ok(); // origem e destino em andares diferentes
 const nukeSolo=(await ins({map:'nuke',type:'solo_exec',origin:true,ol:'upper',tl:'upper',dest:[{x:0.1,y:0.2,type:'smoke',level:'upper'},{x:0.3,y:0.4,type:'he',level:'lower'}]})).rows[0];assert.equal(nukeSolo.destinations[1].level,'lower');ok();
 await ins({map:'mirage',type:'solo_exec',origin:true,dest:[{x:0.1,y:0.2,type:'smoke'}]});ok(); // solo sem andares segue válido
 await assert.rejects(ins({map:'mirage',tl:'upper'}),/grenades_levels_check/);ok(); // mapa sem andares
 await assert.rejects(ins({map:'mirage',type:'solo_exec',origin:true,tl:'upper',dest:[{x:0.1,y:0.2,type:'smoke',level:'upper'}]}),/grenades_levels_check/);ok();
 await assert.rejects(ins({map:'nuke',tl:'mid'}),/grenades_levels_check/);ok(); // id inválido
 await assert.rejects(ins({map:'nuke',ol:'upper',tl:'upper'}),/grenades_levels_check/);ok(); // andar da origem sem origem
 await assert.rejects(ins({map:'nuke',type:'solo_exec',origin:true,tl:'lower',dest:[{x:0.1,y:0.2,type:'smoke',level:'upper'}]}),/grenades_solo_destinations_check/);ok(); // target_level != 1º destino
 await assert.rejects(ins({map:'nuke',type:'solo_exec',origin:true,tl:'upper',dest:[{x:0.1,y:0.2,type:'smoke',level:'basement'}]}),/grenades_solo_destinations_check/);ok();
 await assert.rejects(ins({map:'nuke',type:'solo_exec',origin:true,tl:'upper',dest:[{x:0.1,y:0.2,type:'smoke',level:'upper',z:1}]}),/grenades_solo_destinations_check/);ok(); // chave extra continua proibida
 await db.exec('set role anon');await assert.rejects(db.query("select private.map_has_levels('nuke')"),/permission denied/);await db.exec('reset role');ok();
 assert.equal((await db.query("select proacl::text a from pg_proc where proname='map_has_levels'")).rows[0].a,'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}');ok();
 // rollback documentado: remove registros com andares, executa o rollback e confere o estado anterior
 await db.query("delete from public.grenades where map_id='nuke'");
 await db.exec(await readFile(rollbackFile,'utf8'));
 assert.deepEqual(await snap(),before);ok();
 assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_name='grenades' and column_name in ('origin_level','target_level')")).rows[0].n,0);ok();
 assert.equal((await db.query('select count(*)::int n from public.grenades where id = any($1)',[legacy.map(r=>r.id)])).rows[0].n,3);ok();
 console.log(JSON.stringify({engine:'PGlite 0.5.13',checks,migrations:files.length,legacyPreserved:true,aclPoliciesRlsGrantsTriggersUnchanged:true,rollbackValidated:true,remoteApplied:false}));
}finally{await db.close();}
