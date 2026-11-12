import {serviceFetch} from './service-fetch.js';
import {sourcePreviewAvailable} from './source-preview-supabase.js';
import {sourcePreview} from './preview-api.js';
import {beforeDeadline,remainingSignal} from './import-deadline.js';
import { importerCapabilities, disabledImport, uploadRequest, completeRequest } from './importers.js';
import {importDependencies,inspectSource,createSourceImport,type ImportDependencies} from './import-api.js';
import {effectiveImportLimits} from './tiktok.js';
import {completeImport} from './import-processing.js';
import { completeInline } from './inline.js';
import { mapView } from './maps.js';
import { readMediaLimits, readUploadEnabled, readProcessorMode, readTrimmingEnabled, readContributorsEnabled, readContributorImportsEnabled, readContributorUploadsEnabled } from './config.js';
import { contributorError } from './contributor-errors.js';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { body, createBody, patchBody, filters, pageQuery, nicknameBody, uuid, dbBody, grenadeView, mediaView } from './model.js';
const failure=(code:string,statusCode:number)=>Object.assign(new Error(code),{statusCode,code});
type Clients={public:SupabaseClient;service:SupabaseClient;user:(token:string)=>SupabaseClient};
export function buildApp(clients?:Clients,imports:ImportDependencies=importDependencies){return configureApp(Fastify({logger:true,bodyLimit:16384}),clients,imports);}
export function configureApp(app:FastifyInstance,clients?:Clients,imports:ImportDependencies=importDependencies) {
 // Opt-in admission control only; not a database/Storage/worker freeze.
 const writePause=process.env.API_WRITES_PAUSED??'false';
 if(!['true','false'].includes(writePause))throw new Error('API_WRITES_PAUSED deve ser true ou false.');
 if(writePause==='true')app.addHook('onRequest',async(req,reply)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method))return reply.header('Retry-After','60').code(503).send({error:{code:'WRITES_PAUSED',message:'Cadastros e alterações temporariamente suspensos. Tente novamente mais tarde.'}});
 });
 const requestStarts=new WeakMap<object,number>();
 app.addHook('onRequest',async req=>{requestStarts.set(req,performance.now());});
 const routeSignal=(req:object)=>remainingSignal(requestStarts.get(req)??performance.now(),90000);
 const limits=readMediaLimits();
 const importLimits=effectiveImportLimits(limits);
 const uploadEnabled=readUploadEnabled();
 const processingMode=readProcessorMode();
 const trimmingEnabled=readTrimmingEnabled();
 const contributorsEnabled=readContributorsEnabled();
 const contributorImports=readContributorImportsEnabled();
 const contributorUploads=readContributorUploadsEnabled();
 // R1: o worker-transcode retém a fonte além da saída e a cobrança de bytes dos contribuidores só conhece um dos objetos; só o modo inline-original é contabilizado.
 const contributorUploadsSupported=processingMode==='inline-original';
 function contributorUploadGate(a:Actor){if(a.kind!=='contributor')return;if(!contributorUploads)throw failure('CONTRIBUTOR_UPLOADS_DISABLED',403);if(!contributorUploadsSupported)throw failure('CONTRIBUTOR_UPLOADS_UNSUPPORTED',403);}
 app.register(cors,{origin:(process.env.CORS_ORIGINS??'http://localhost:5173').split(','),methods:['GET','HEAD','POST','PATCH','DELETE']});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 const opts={auth:{persistSession:false,autoRefreshToken:false}};
 const configured=!!(url&&key&&process.env.SUPABASE_SERVICE_ROLE_KEY);
 const c=clients??(configured?{public:createClient(url!,key!,opts),service:createClient(url!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{...opts,global:{fetch:serviceFetch}}),user:(token:string)=>createClient(url!,key!,{...opts,global:{headers:{Authorization:`Bearer ${token}`}}})}:null);
 // Apelidos em lote (uma consulta por listagem). Linhas sem autor (histórico/admin) não disparam consulta alguma.
 async function nicknames(ids:string[]){const uniq=[...new Set(ids.filter(Boolean))];const names=new Map<string,string>();if(!uniq.length)return names;for(const c of checked(await requireClients().service.from('contributors').select('id,nickname').in('id',uniq)))names.set(c.id,c.nickname);return names;}
 async function enrich(r:any,names?:Map<string,string>){const m=await requireClients().service.from('media_assets').select('*').eq('id',r.video_id).eq('status','ready').maybeSingle();const nick=r.author_id?(names??await nicknames([r.author_id])).get(r.author_id):undefined;return grenadeView({...r,media_assets:m.data,authorNickname:nick});}
 async function enrichMany(rows:any[]){const names=await nicknames(rows.map(r=>r.author_id));return Promise.all(rows.map(r=>enrich(r,names)));}
 const requireClients=()=>{if(!c)throw failure('SERVICE_UNAVAILABLE',503);return c;};
 // Quem está chamando. O papel PostgreSQL `authenticated` NUNCA autoriza sozinho (sessões anônimas o recebem):
 //  - admin: `is_admin()` (private.administrators);
 //  - contributor: sessão anônima COM cadastro feito pelo servidor (vínculo sessão→contribuidor) e flag ligada;
 //  - unregistered: sessão anônima válida ainda sem apelido.
 // O token é revalidado a cada requisição; ids de autoria/dono nunca vêm do corpo da requisição.
 type Actor={kind:'admin';id:string;db:SupabaseClient}|{kind:'contributor';id:string;contributorId:string;nickname:string}|{kind:'unregistered';id:string};
 async function resolveActor(req:any,withContributors:boolean):Promise<Actor>{
  const cc=requireClients();const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw failure('UNAUTHORIZED',401);
  const db=cc.user(token);const bounded=AbortSignal.any([routeSignal(req),AbortSignal.timeout(5000)]);
  const {data,error}=await beforeDeadline(db.auth.getUser(token),bounded);if(error||!data.user)throw failure('UNAUTHORIZED',401);
  const q=db.rpc('is_admin');const role=await beforeDeadline(typeof q.abortSignal==='function'?q.abortSignal(bounded):q,bounded);if(role.error)throw failure('SERVICE_UNAVAILABLE',503);
  if(role.data)return {kind:'admin',id:data.user.id,db};
  if(!withContributors||!contributorsEnabled||data.user.is_anonymous!==true)throw failure('FORBIDDEN',403);
  const link=checked(await beforeDeadline(cc.service.from('contributor_links').select('contributor_id').eq('auth_user_id',data.user.id).maybeSingle(),bounded));
  if(!link)return {kind:'unregistered',id:data.user.id};
  const contributor=checked(await beforeDeadline(cc.service.from('contributors').select('id,nickname').eq('id',link.contributor_id).maybeSingle(),bounded));
  if(!contributor)throw failure('SERVICE_UNAVAILABLE',503);
  return {kind:'contributor',id:data.user.id,contributorId:contributor.id,nickname:contributor.nickname};
 }
 // Rotas só de administrador (excluir, etc.): contribuidor também recebe 403, nunca chega a consultar vínculos.
 async function admin(req:any){const a=await resolveActor(req,false);if(a.kind!=='admin')throw failure('FORBIDDEN',403);return {db:a.db,id:a.id};}
 const actor=(req:any)=>resolveActor(req,true);
 function registered(a:Actor){if(a.kind==='unregistered')throw failure('CONTRIBUTOR_REQUIRED',403);return a;}
 // Importação: administrador segue preso ao uid configurado; contribuidor só com CONTRIBUTOR_IMPORTS_ENABLED.
 function importActor(a:Actor){if(a.kind==='admin')return importAdmin(a.id);if(a.kind==='unregistered')throw failure('CONTRIBUTOR_REQUIRED',403);if(!contributorImports)throw failure('FORBIDDEN',403);}
 // Vídeo anexável por contribuidor: precisa ser dele e estar pronto. Inexistente e alheio dão a mesma resposta.
 async function ownMedia(contributorId:string,mediaId:string){const m=checked(await requireClients().service.from('media_assets').select('id,contributor_id,status').eq('id',mediaId).maybeSingle());if(!m||m.contributor_id!==contributorId)throw failure('VIDEO_NOT_OWNED',403);if(m.status!=='ready')throw failure('VIDEO_NOT_READY',409);}
 function importAdmin(id:string){const allowed=process.env.MEDIA_TIKTOK_ADMIN_USER_ID;if(!allowed||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(allowed)||id!==allowed)throw failure('FORBIDDEN',403);}
 function checked(r:any){if(r.error){const known=contributorError(r.error.message);if(known)throw failure(known.code,known.status);if(r.error.code==='23503')throw failure('INVALID_REFERENCE',400);if(r.error.code==='23514')throw failure('VALIDATION_ERROR',400);throw failure('DATABASE_ERROR',503);}return r.data;}
 app.setErrorHandler((err:any,_req,reply)=>{const validation=err instanceof ZodError;reply.code(validation?400:err.statusCode??500).send({error:{code:validation?'VALIDATION_ERROR':err.code??'INTERNAL_ERROR',message:validation?'Dados inválidos.':err.statusCode?err.message:'Erro interno.'}});});
 app.get('/health',async()=>({data:{status:'ok',configured:!!c}}));
 app.get('/api/v1/maps',async()=>({data:checked(await requireClients().public.from('maps').select('*').order('name')).map((m:any)=>mapView(m,process.env.FRONTEND_URL))}));
 app.get('/api/v1/media/capabilities',async()=>{const sourcePreview=!!c&&await sourcePreviewAvailable(c.service);return ({data:{contributors:{enabled:contributorsEnabled&&!!c,uploads:contributorsEnabled&&contributorUploads&&contributorUploadsSupported&&uploadEnabled&&!!c,imports:contributorsEnabled&&contributorImports&&!!c,nickname:{minLength:2,maxLength:24}},upload:{enabled:uploadEnabled&&!!c,processingMode,...limits},trimming:{enabled:trimmingEnabled&&uploadEnabled&&!!c&&processingMode==='inline-original',...(!(trimmingEnabled&&uploadEnabled&&!!c&&processingMode==='inline-original')?{reasonCode:'CLIP_UNSUPPORTED'}:{}),maxSourceDurationSeconds:180,maxSourceBytes:50000000,maxDurationSeconds:limits.maxDurationSeconds,minDurationSeconds:0.1,timePrecisionSeconds:0.001},importers:{...importerCapabilities,tiktok:imports.available('tiktok')&&!!c?{enabled:true,inspection:true,sourcePreview,...importLimits}:{...importerCapabilities.tiktok,sourcePreview:false},instagram:imports.available('instagram')&&!!c?{enabled:true,inspection:true,sourcePreview,...importLimits}:{...importerCapabilities.instagram,sourcePreview:false}}}});});
 app.get('/api/v1/media/imports/:sourceId/preview',async(req:any,reply)=>{const a=await actor(req);importActor(a);reply.header('Cache-Control','no-store');return {data:await sourcePreview(requireClients().service,uuid.parse(req.params.sourceId),a.id,false)};});
 app.post('/api/v1/media/imports/:sourceId/preview',async(req:any,reply)=>{const a=await actor(req);importActor(a);completeRequest.parse(req.body??{});reply.header('Cache-Control','no-store');return {data:await sourcePreview(requireClients().service,uuid.parse(req.params.sourceId),a.id,true)};});
 app.post('/api/v1/media/imports/inspect',async(req,reply)=>{const a=await actor(req);importActor(a);return reply.code(201).send({data:await inspectSource(requireClients().service,a.id,req.body,imports,limits)});});
 app.post('/api/v1/media/imports',async(req,reply)=>{const a=await actor(req);if(req.body&&typeof req.body==='object'&&'sourceUrl' in req.body)return disabledImport(req.body);importActor(a);const asset=await createSourceImport(requireClients().service,a.id,req.body,imports,limits);return reply.code(201).send({data:{...mediaView(asset),mediaId:asset.id}});});
 app.get('/api/v1/grenades',async req=>{const f=filters.parse(req.query);let q=requireClients().public.from('grenades').select('*',{count:'exact'});if(f.mapId)q=q.eq('map_id',f.mapId);if(f.type)q=q.eq('type',f.type);if(f.side)q=q.eq('side',f.side);const r=await q.order('created_at',{ascending:false}).order('id',{ascending:false}).range(f.offset,f.offset+f.limit-1);return {data:await enrichMany(checked(r)),pagination:{limit:f.limit,offset:f.offset,total:r.count}};});
 app.get('/api/v1/grenades/:id',async(req:any)=>{const r=checked(await requireClients().public.from('grenades').select('*').eq('id',uuid.parse(req.params.id)).maybeSingle());if(!r)throw failure('NOT_FOUND',404);return {data:await enrich(r)};});
 app.post('/api/v1/grenades',async(req,reply)=>{const a=registered(await actor(req));const input=createBody.parse(req.body);
  // Administrador: caminho de sempre (RLS is_admin, sem autor). Contribuidor: escrita pelo backend com autoria definida aqui, nunca pelo corpo.
  if(a.kind==='admin'){const r=checked(await a.db.from('grenades').insert(dbBody(input)).select().single());return reply.code(201).send({data:await enrich(r)});}
  await ownMedia(a.contributorId,input.videoId);
  const r=checked(await requireClients().service.from('grenades').insert({...dbBody(input),author_id:a.contributorId}).select().single());return reply.code(201).send({data:await enrich(r)});});
 app.patch('/api/v1/grenades/:id',async(req:any)=>{const a=registered(await actor(req));const db=requireClients().service;const payload=req.body;if(!payload||typeof payload!=='object'||Array.isArray(payload))throw failure('VALIDATION_ERROR',400);const {expectedRevision,...fields}=payload;if(expectedRevision===undefined)throw failure('REVISION_REQUIRED',428);if(!Number.isInteger(expectedRevision)||expectedRevision<1||expectedRevision>2147483647)throw failure('VALIDATION_ERROR',400);const b=patchBody.parse(fields);if(!Object.keys(b).length)throw failure('EMPTY_PATCH',400);const id=uuid.parse(req.params.id);
  // Propriedade verificada de novo a cada PATCH (service_role ignora RLS): contribuidor só edita o que é dele e só anexa vídeo dele.
  if(a.kind==='contributor'){const current=checked(await db.from('grenades').select('id,author_id').eq('id',id).maybeSingle());if(!current)throw failure('NOT_FOUND',404);if(current.author_id!==a.contributorId)throw failure('FORBIDDEN',403);if(b.videoId)await ownMedia(a.contributorId,b.videoId);}
  let update:any=db.from('grenades').update(dbBody(b)).eq('id',id).eq('revision',expectedRevision);if(a.kind==='contributor')update=update.eq('author_id',a.contributorId);
  const r=checked(await update.select().maybeSingle());if(!r){const current=checked(await db.from('grenades').select('id').eq('id',id).maybeSingle());if(!current)throw failure('NOT_FOUND',404);throw failure('GRENADE_VERSION_CONFLICT',409);}return {data:await enrich(r)};});
 app.delete('/api/v1/grenades/:id',async(req:any,reply)=>{const {db}=await admin(req);const r=checked(await db.from('grenades').delete().eq('id',uuid.parse(req.params.id)).select('id').maybeSingle());if(!r)throw failure('NOT_FOUND',404);return reply.code(204).send();});
 app.post('/api/v1/media/uploads',async(req,reply)=>{const a=registered(await actor(req));contributorUploadGate(a);const request=uploadRequest.parse(req.body??{});if(request.clip&&(!trimmingEnabled||processingMode!=='inline-original'))throw failure('CLIP_UNSUPPORTED',422);if(request.clip&&request.clip.endSeconds-request.clip.startSeconds>limits.maxDurationSeconds)throw failure('CLIP_OUT_OF_RANGE',400);if(!uploadEnabled)throw failure('UPLOAD_UNAVAILABLE',503);const id=randomUUID(),path=`${id}/source.mp4`;const db=requireClients().service;checked(await db.from('media_assets').insert({id,owner_id:a.id,source_type:'upload',storage_key:path,...(request.clip?{clip:request.clip}:{})}));const r=await db.storage.from('videos-staging').createSignedUploadUrl(path);if(r.error)throw failure('STORAGE_UNAVAILABLE',503);return reply.code(201).send({data:{mediaId:id,upload:{protocol:'supabase-signed',url:r.data.signedUrl,path,token:r.data.token},limits:{...limits}}});});
 app.get('/api/v1/media/:id',async(req:any)=>{const a=registered(await actor(req));const r=checked(await requireClients().service.from('media_assets').select('*').eq('id',uuid.parse(req.params.id)).maybeSingle());
  // Mídia de outro contribuidor responde como inexistente; administrador mantém a regra anterior.
  if(!r||(a.kind==='contributor'&&r.contributor_id!==a.contributorId))throw failure('NOT_FOUND',404);
  if(a.kind==='admin'&&['tiktok','instagram'].includes(r.source_type)&&r.import_source_id){importAdmin(a.id);if(r.owner_id!==a.id)throw failure('FORBIDDEN',403);}return {data:mediaView(r)};});
 app.post('/api/v1/media/:id/complete',async(req:any,reply)=>{const a=registered(await actor(req));completeRequest.parse(req.body??{});const db=requireClients().service;const id=uuid.parse(req.params.id);const lookup=db.from('media_assets').select('*').eq('id',id);const lookupSignal=AbortSignal.any([routeSignal(req),AbortSignal.timeout(5000)]);const imported=checked(await beforeDeadline((typeof lookup.abortSignal==='function'?lookup.abortSignal(lookupSignal):lookup).maybeSingle(),lookupSignal));if(a.kind==='contributor'&&(!imported||imported.contributor_id!==a.contributorId))throw failure('NOT_FOUND',404);if(['tiktok','instagram'].includes(imported?.source_type)&&imported.import_source_id){if(a.kind==='admin'){importAdmin(a.id);if(imported.owner_id!==a.id)throw failure('FORBIDDEN',403);}else importActor(a);const result=await completeImport(db,id,limits,undefined,requestStarts.get(req));return reply.code(result.status).send({data:mediaView(result.asset)});}contributorUploadGate(a);if(processingMode==='inline-original'){const result=await completeInline(db,id,limits);return reply.code(result.status).send({data:mediaView(result.asset)});}const asset=checked(await db.from('media_assets').select('*').eq('id',id).maybeSingle());if(!asset)throw failure('NOT_FOUND',404);if(asset.status==='awaiting_upload'){const object=await db.storage.from('videos-staging').info(asset.storage_key);if(object.error)throw failure('UPLOAD_NOT_FOUND',409);if(Number(object.data.size)>limits.maxBytes)throw failure('FILE_TOO_LARGE',400);}const r=checked(await db.from('media_assets').update({status:'queued',updated_at:new Date().toISOString()}).eq('id',id).eq('status','awaiting_upload').select().maybeSingle());if(r)return reply.code(202).send({data:mediaView(r)});const existing=checked(await db.from('media_assets').select('*').eq('id',id).maybeSingle());if(!existing)throw failure('NOT_FOUND',404);if(existing.status==='failed')throw failure('MEDIA_STATE_CONFLICT',409);return reply.code(existing.status==='ready'?200:202).send({data:mediaView(existing)});});
 app.get('/api/v1/media/:id/import-playback',async(req:any,reply)=>{reply.header('Cache-Control','private, no-store');const a=await actor(req);importActor(a);const db=requireClients().service;const id=uuid.parse(req.params.id);const media=checked(await db.from('media_assets').select('*').eq('id',id).eq('owner_id',a.id).in('source_type',['tiktok','instagram']).eq('status','ready').maybeSingle());if(!media||media.owner_id!==a.id||!['tiktok','instagram'].includes(media.source_type)||media.status!=='ready'||!media.import_source_id)throw failure('NOT_FOUND',404);const r=await db.storage.from('videos-staging').createSignedUrl(media.storage_key,3600);if(r.error)throw failure('STORAGE_UNAVAILABLE',503);return {data:{url:r.data.signedUrl,expiresAt:new Date(Date.now()+3600000).toISOString(),mimeType:'video/mp4'}};});
 app.get('/api/v1/media/:id/playback',async(req:any)=>{const db=requireClients().service;const id=uuid.parse(req.params.id);const published=checked(await db.from('grenades').select('id').eq('video_id',id).limit(1));if(!published.length)throw failure('NOT_FOUND',404);const media=checked(await db.from('media_assets').select('*').eq('id',id).eq('status','ready').maybeSingle());if(!media)throw failure('NOT_FOUND',404);const r=await db.storage.from('videos-staging').createSignedUrl(media.storage_key,3600);if(r.error)throw failure('STORAGE_UNAVAILABLE',503);return {data:{url:r.data.signedUrl,expiresAt:new Date(Date.now()+3600000).toISOString(),mimeType:'video/mp4'}};});
 // Contribuição: cadastro do apelido (idempotente por sessão), perfil e minhas granadas. Só com CONTRIBUTORS_ENABLED.
 app.post('/api/v1/contributors',async(req,reply)=>{const a=await actor(req);if(a.kind==='admin')throw failure('FORBIDDEN',403);const {nickname}=nicknameBody.parse(req.body);if(a.kind==='contributor')return {data:{nickname:a.nickname}};const r=checked(await requireClients().service.rpc('register_contributor',{p_auth_user:a.id,p_nickname:nickname}));return reply.code(201).send({data:{nickname:r.nickname}});});
 app.get('/api/v1/me',async req=>{const a=registered(await actor(req));return {data:a.kind==='admin'?{role:'admin'}:{role:'contributor',nickname:a.nickname}};});
 app.patch('/api/v1/me',async(req:any)=>{const a=registered(await actor(req));if(a.kind!=='contributor')throw failure('FORBIDDEN',403);const {nickname}=nicknameBody.parse(req.body);const r=checked(await requireClients().service.from('contributors').update({nickname,updated_at:new Date().toISOString()}).eq('id',a.contributorId).select('nickname').single());return {data:{nickname:r.nickname}};});
 app.get('/api/v1/me/grenades',async req=>{const a=registered(await actor(req));if(a.kind!=='contributor')throw failure('FORBIDDEN',403);const f=pageQuery.parse(req.query);const r=await requireClients().service.from('grenades').select('*',{count:'exact'}).eq('author_id',a.contributorId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(f.offset,f.offset+f.limit-1);return {data:await enrichMany(checked(r)),pagination:{limit:f.limit,offset:f.offset,total:r.count}};});
 return app;
}
