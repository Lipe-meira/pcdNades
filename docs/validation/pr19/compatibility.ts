// Run last: intentionally leaves the disposable DB after rollback 2 -> 1.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {buildApp as modern} from './src/application.js';
import {buildApp as legacy} from './old-src/application.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),q=async(s:string,a:any[]=[])=> (await pool.query(s,a)).rows;
const url=process.env.SUPABASE_URL!,key=process.env.SUPABASE_SERVICE_ROLE_KEY!,anon=process.env.SUPABASE_PUBLISHABLE_KEY!;
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const uid=(await q('select user_id from private.administrators limit 1'))[0].user_id,password='Fixture-'+randomUUID();assert.ifError((await service.auth.admin.updateUserById(uid,{password})).error);
const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const login=await auth.auth.signInWithPassword({email:'admin@pr19.invalid',password});assert.ifError(login.error);const token=login.data.session!.access_token;
Object.assign(process.env,{CONTRIBUTORS_ENABLED:'false',CONTRIBUTOR_UPLOADS_ENABLED:'false',CONTRIBUTOR_IMPORTS_ENABLED:'false',MEDIA_TIKTOK_ADMIN_USER_ID:uid});
const fixture={available:()=>true,extract:async()=>({metadata:{provider:'tiktok',sourceUrl:'https://www.tiktok.com/@synthetic/video/7701366996495125766',videoId:'7701366996495125766',title:'Synthetic',author:'Fixture',durationSeconds:6}})};
const old=legacy(undefined,fixture),current=modern(undefined,fixture);old.log.level='silent';current.log.level='silent';await old.listen({port:3301,host:'127.0.0.1'});await current.listen({port:3302,host:'127.0.0.1'});
const results:any[]=[];const inspect=async(port:number)=>{const r=await fetch(`http://127.0.0.1:${port}/api/v1/media/imports/inspect`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({sourceUrl:'https://www.tiktok.com/@synthetic/video/7701366996495125766'})});return {status:r.status,data:await r.json() as any};};
const reload=async()=>{await q("NOTIFY pgrst,'reload schema'");await new Promise(r=>setTimeout(r,800));};
const hashes=()=>q("select 'media' kind,count(*)::int n,md5(string_agg((to_jsonb(t)-'contributor_id'-'storage_charge_bytes')::text,'' order by id)) hash from media_assets t union all select 'grenades',count(*)::int,md5(string_agg((to_jsonb(t)-'author_id')::text,'' order by id)) from grenades t");
async function check(name:string,port:number,expected:number){const r=await inspect(port);assert.equal(r.status,expected,JSON.stringify(r));results.push({name,status:'PASS',http:r.status});await writeFile('/results/compatibility-results.json',JSON.stringify(results,null,2));console.log('PASS',name,r.status);}
try{
 // Controlled clock shift only for exhausted synthetic quota fixtures.
 await q("update import_sources set created_at=now()-interval '2 hour'");const before=await hashes();
 await check('C01 legacy inspect with both migrations (controlled extraction)',3301,201);await check('C02 modern inspect with both migrations (controlled extraction)',3302,201);
 await q(await readFile('rollbacks/20261112180000_contributor_storage_and_import_pools_rollback.sql','utf8'));await reload();
 await check('C03 legacy inspect after rollback2',3301,201);await check('C04 modern inspect after rollback2 negative control',3302,503);
 await q(await readFile('rollbacks/20261112120000_contributors_authorship_rollback.sql','utf8'));await reload();await check('C05 legacy inspect after rollback2 then rollback1',3301,201);
 assert.deepEqual(await hashes(),before);results.push({name:'C06 media/grenade content hashes preserved through both rollbacks',status:'PASS',hashes:before});
 await writeFile('/results/compatibility-results.json',JSON.stringify(results,null,2));
}finally{await old.close();await current.close();await pool.end();}
