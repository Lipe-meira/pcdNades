/** Local-only API/one-shot collector bootstrap. Never prints private configuration. */
import {readFile} from 'node:fs/promises';import {join} from 'node:path';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';import Fastify from 'fastify';
import {configureApp} from '../src/application.js';import {runSourcePreviewMaintenance} from '../src/source-preview-supabase.js';import {serviceFetch} from '../src/service-fetch.js';
const directory=process.argv[2],mode=process.argv[3]??'serve';if(!directory)throw new Error('Diretório privado local obrigatório.');
const raw=await readFile(join(directory,'status.private.json'),'utf8'),config=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)),users=JSON.parse(await readFile(join(directory,'users.private.json'),'utf8'));
assert.equal(new URL(config.API_URL).origin,'http://127.0.0.1:56421');assert.equal(new URL(config.DB_URL).hostname,'127.0.0.1');assert.equal(new URL(config.DB_URL).port,'56422');
const options={auth:{persistSession:false,autoRefreshToken:false}},authClient=createClient(config.API_URL,config.PUBLISHABLE_KEY,options),login=await authClient.auth.signInWithPassword(users.admin);if(login.error||!login.data.user)throw new Error('Autenticação local indisponível.');
Object.assign(process.env,{SUPABASE_URL:config.API_URL,SUPABASE_PUBLISHABLE_KEY:config.PUBLISHABLE_KEY,SUPABASE_SERVICE_ROLE_KEY:config.SECRET_KEY,MEDIA_SOURCE_PREVIEW_ENABLED:'true',MEDIA_TIKTOK_IMPORT_ENABLED:'true',MEDIA_INSTAGRAM_IMPORT_ENABLED:'true',MEDIA_TIKTOK_DOWNLOAD_MODE:'temporary',MEDIA_TIKTOK_ADMIN_USER_ID:login.data.user.id,CORS_ORIGINS:'http://127.0.0.1:5173,http://localhost:5173'});
if(mode==='maintenance'){
 const db=createClient(config.API_URL,config.SECRET_KEY,{...options,global:{fetch:serviceFetch}});console.log(JSON.stringify(await runSourcePreviewMaintenance(db,config.API_URL,AbortSignal.timeout(60000))));
}else if(mode==='serve'){
 const app=configureApp(Fastify({logger:false,bodyLimit:16384}));await app.listen({host:'127.0.0.1',port:3002});console.log('API local em http://127.0.0.1:3002; coleta externa obrigatória, heartbeat expira em8min.');
}else throw new Error('Modo deve ser serve ou maintenance.');
