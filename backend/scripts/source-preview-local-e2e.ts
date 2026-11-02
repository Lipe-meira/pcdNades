import {serviceFetch} from '../src/service-fetch.js';
import {readFile} from 'node:fs/promises';import {join} from 'node:path';import assert from 'node:assert/strict';import pg from 'pg';import Fastify from 'fastify';import {createClient} from '@supabase/supabase-js';
import {configureApp} from '../src/application.js';import {runSourcePreviewMaintenance} from '../src/source-preview-supabase.js';
const directory=process.argv[2];if(!directory)throw new Error('Diretório privado local obrigatório.');
const raw=await readFile(join(directory,'status.private.json'),'utf8'),config=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)),users=JSON.parse(await readFile(join(directory,'users.private.json'),'utf8'));
assert.equal(new URL(config.API_URL).origin,'http://127.0.0.1:56421');assert.equal(new URL(config.DB_URL).hostname,'127.0.0.1');assert.equal(new URL(config.DB_URL).port,'56422');
const pool=new pg.Pool({connectionString:config.DB_URL}),options={auth:{persistSession:false,autoRefreshToken:false}},db=createClient(config.API_URL,config.SECRET_KEY,{...options,global:{fetch:serviceFetch}}),publicClient=createClient(config.API_URL,config.PUBLISHABLE_KEY,options);const fixtures:string[]=[];
let app:ReturnType<typeof Fastify>|undefined;
try{
 const check=await pool.query("select count(*)::int as expired from public.import_preview_jobs where expires_at<=now()-interval '2 minutes'");
 if(check.rows[0].expired)throw new Error('EXISTING_EXPIRED_PREVIEWS_REQUIRE_COORDINATION');
 const auth=await publicClient.auth.signInWithPassword(users.admin);assert.ifError(auth.error);const token=auth.data.session!.access_token,owner=auth.data.user!.id;
 Object.assign(process.env,{SUPABASE_URL:config.API_URL,MEDIA_SOURCE_PREVIEW_ENABLED:'true',MEDIA_TIKTOK_IMPORT_ENABLED:'true',MEDIA_INSTAGRAM_IMPORT_ENABLED:'true',MEDIA_TIKTOK_DOWNLOAD_MODE:'temporary',MEDIA_TIKTOK_ADMIN_USER_ID:owner});
 await runSourcePreviewMaintenance(db,config.API_URL,AbortSignal.timeout(60000));
 app=configureApp(Fastify({logger:false}),{service:db,public:createClient(config.API_URL,config.PUBLISHABLE_KEY,options),user:t=>createClient(config.API_URL,config.PUBLISHABLE_KEY,{...options,global:{headers:{Authorization:`Bearer ${t}`}}})});
 const request=(method:'GET'|'POST',url:string,payload?:unknown,authenticated=true)=>app!.inject({method,url,...(payload?{payload}:{}),...(authenticated?{headers:{authorization:`Bearer ${token}`}}:{})});
 const before=await pool.query('select count(*)::int as total from public.grenades');
 for(const sourceUrl of ['https://www.instagram.com/reel/DeILaFXzNvu/','https://vt.tiktok.com/ZSgs9BM9L/']){
  const inspection=await request('POST','/api/v1/media/imports/inspect',{sourceUrl});assert.equal(inspection.statusCode,201,'inspection failed');const source=inspection.json().data;fixtures.push(source.sourceId);
  const route=`/api/v1/media/imports/${source.sourceId}/preview`;
  assert.equal((await request('GET',route,undefined,false)).statusCode,401);
  const prepared=await request('POST',route,{});assert.equal(prepared.statusCode,200,`preview ${source.provider} failed: ${prepared.json().error?.code}`);const view=prepared.json().data;assert.equal(view.status,'ready');assert.equal(new URL(view.url).origin,config.API_URL);
  const response=await fetch(view.url,{headers:{Range:'bytes=0-1023'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,1024);
  const renew=await request('GET',route);assert.equal(renew.statusCode,200);assert.equal(renew.json().data.sourceExpiresAt,view.sourceExpiresAt);
  await pool.query("update public.import_sources set expires_at=now()-interval '3 minutes' where id=$1",[source.sourceId]);await pool.query("update public.import_preview_jobs set expires_at=now()-interval '3 minutes' where source_id=$1",[source.sourceId]);
  assert.equal((await request('GET',route)).statusCode,410);
  await runSourcePreviewMaintenance(db,config.API_URL,AbortSignal.timeout(60000));
  const row=await pool.query('select count(*)::int as total from public.import_preview_jobs where source_id=$1',[source.sourceId]);assert.equal(row.rows[0].total,0);
  const object=await db.storage.from('import-previews').info(`${source.sourceId}.mp4`);assert.ok(object.error);
  console.log(JSON.stringify({provider:source.provider,result:'PASS',realNetwork:true,authStorageLocal:true,range206:true,renewal:true,expiry410:true,cleanupVerified:true}));
 }
 const after=await pool.query('select count(*)::int as total from public.grenades');assert.equal(after.rows[0].total,before.rows[0].total);console.log(JSON.stringify({noGrenadeCreated:true,result:'PASS'}));
}catch(error){console.error(JSON.stringify({result:'FAILED',reason:error instanceof Error?error.message:'unknown'}));process.exitCode=1;}
finally{await app?.close();for(const id of fixtures){await db.storage.from('import-previews').remove([`${id}.mp4`]);await pool.query('delete from public.import_preview_jobs where source_id=$1',[id]);await pool.query('delete from public.import_sources where id=$1 and media_id is null',[id]);}await pool.end();}
