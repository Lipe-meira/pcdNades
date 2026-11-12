// PostgreSQL real em WASM (PGlite), sem rede nem credenciais. Reproduz o necessário do Supabase:
// papéis anon/authenticated/service_role, auth.users/auth.uid()/auth.jwt() lendo o JWT da sessão e os
// privilégios padrão que o Supabase concede em `public` (as migrations os revogam explicitamente).
import {PGlite} from '@electric-sql/pglite';
import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const migrationsDir=fileURLToPath(new URL('../../migrations/',import.meta.url));
export const rollbacksDir=fileURLToPath(new URL('../../rollbacks/',import.meta.url));
export const CONTRIBUTORS_MIGRATION='20261112120000_contributors_authorship.sql';

const supabaseStubs=`
create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
grant usage on schema public to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
`;

export async function sqlFiles(dir=migrationsDir){return (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();}

/** Cria o banco, aplica todas as migrations anteriores à de contribuidores e devolve o banco. */
export async function createLegacyDb(){
 const db=new PGlite();
 await db.exec(supabaseStubs);
 for(const f of await sqlFiles()){if(f===CONTRIBUTORS_MIGRATION)continue;await db.exec(await readFile(migrationsDir+f,'utf8'));}
 return db;
}
export const applyContributorsMigration=async(db:PGlite)=>db.exec(await readFile(migrationsDir+CONTRIBUTORS_MIGRATION,'utf8'));
export async function createDb(){const db=await createLegacyDb();await applyContributorsMigration(db);return db;}

/** Executa `fn` com o papel e o JWT informados (como o PostgREST faz), sempre restaurando o papel. */
export async function asRole<T>(db:PGlite,role:'anon'|'authenticated'|'service_role',claims:{sub?:string;anonymous?:boolean}|null,fn:()=>Promise<T>):Promise<T>{
 const jwt=claims?.sub?JSON.stringify({sub:claims.sub,role,is_anonymous:!!claims.anonymous}):'';
 await db.exec(`set role ${role}`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[claims?.sub??'',jwt]);
 try{return await fn();}finally{await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','',false)");}
}

export const ids={
 admin:'00000000-0000-4000-8000-0000000000a1',
 anonA:'00000000-0000-4000-8000-0000000000b1',
 anonB:'00000000-0000-4000-8000-0000000000b2',
 anonC:'00000000-0000-4000-8000-0000000000b3'
};

export async function seedUsers(db:PGlite){
 await db.query('insert into auth.users(id,is_anonymous) values($1,false),($2,true),($3,true),($4,true)',[ids.admin,ids.anonA,ids.anonB,ids.anonC]);
 await db.query('insert into private.administrators(user_id) values($1)',[ids.admin]);
}

/** Cria mídia pronta percorrendo a máquina de estados real (awaiting_upload → queued → processing → ready). */
export async function readyMedia(db:PGlite,owner:string,over:{createdAt?:string}={}):Promise<string>{
 const key=`${crypto.randomUUID()}/source.mp4`;
 const r=await db.query<{id:string}>('insert into public.media_assets(owner_id,source_type,storage_key,created_at) values($1,$2,$3,coalesce($4::timestamptz,now())) returning id',[owner,'upload',key,over.createdAt??null]);
 const id=r.rows[0].id;
 await db.query("update public.media_assets set status='queued' where id=$1",[id]);
 await db.query("update public.media_assets set status='processing',locked_until=now()+interval '2 minutes' where id=$1",[id]);
 await db.query("update public.media_assets set status='ready',locked_until=null,metadata='{\"durationSeconds\":10,\"bytes\":1000,\"mimeType\":\"video/mp4\"}' where id=$1",[id]);
 return id;
}

export const grenadeSql="insert into public.grenades(title,map_id,type,side,instructions,target,video_id,author_id) values($1,'de_mirage','smoke','T','Alinhe a mira','{\"x\":0.1,\"y\":0.2}',$2,$3) returning *";
export async function seedMap(db:PGlite){await db.query("insert into public.maps(id,name,radar) values('de_mirage','Mirage','{}') on conflict(id) do nothing");}
