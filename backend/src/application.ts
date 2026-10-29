import { mapView } from './maps.js';
import { readMediaLimits } from './config.js';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { body, filters, uuid, dbBody, grenadeView, mediaView } from './model.js';
const failure=(code:string,statusCode:number)=>Object.assign(new Error(code),{statusCode,code});
type Clients={public:SupabaseClient;service:SupabaseClient;user:(token:string)=>SupabaseClient};
export function buildApp(clients?:Clients){return configureApp(Fastify({logger:true,bodyLimit:16384}),clients);}
export function configureApp(app:FastifyInstance,clients?:Clients) {
 const limits=readMediaLimits();
 app.register(cors,{origin:(process.env.CORS_ORIGINS??'http://localhost:5173').split(',')});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 const opts={auth:{persistSession:false,autoRefreshToken:false}};
 const configured=!!(url&&key&&process.env.SUPABASE_SERVICE_ROLE_KEY);
 const c=clients??(configured?{public:createClient(url!,key!,opts),service:createClient(url!,process.env.SUPABASE_SERVICE_ROLE_KEY!,opts),user:(token:string)=>createClient(url!,key!,{...opts,global:{headers:{Authorization:`Bearer ${token}`}}})}:null);
 async function enrich(r:any){const m=await requireClients().service.from('media_assets').select('*').eq('id',r.video_id).eq('status','ready').maybeSingle();return grenadeView({...r,media_assets:m.data});}
 const requireClients=()=>{if(!c)throw failure('SERVICE_UNAVAILABLE',503);return c;};
 async function admin(req:any){const cc=requireClients();const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw failure('UNAUTHORIZED',401);const db=cc.user(token);const {data,error}=await db.auth.getUser(token);if(error||!data.user)throw failure('UNAUTHORIZED',401);const role=await db.rpc('is_admin');if(role.error)throw failure('SERVICE_UNAVAILABLE',503);if(!role.data)throw failure('FORBIDDEN',403);return {db,id:data.user.id};}
 function checked(r:any){if(r.error){if(r.error.code==='23503')throw failure('INVALID_REFERENCE',400);throw failure('DATABASE_ERROR',503);}return r.data;}
 app.setErrorHandler((err:any,_req,reply)=>{const validation=err instanceof ZodError;reply.code(validation?400:err.statusCode??500).send({error:{code:validation?'VALIDATION_ERROR':err.code??'INTERNAL_ERROR',message:validation?'Dados inválidos.':err.statusCode?err.message:'Erro interno.'}});});
 app.get('/health',async()=>({data:{status:'ok',configured:!!c}}));
 app.get('/api/v1/maps',async()=>({data:checked(await requireClients().public.from('maps').select('*').order('name')).map((m:any)=>mapView(m,process.env.FRONTEND_URL))}));
 app.get('/api/v1/media/capabilities',async()=>({data:{upload:{enabled:!!c,...limits},importers:{youtube:{enabled:false},tiktok:{enabled:false}}}}));
 app.post('/api/v1/media/imports',async req=>{await admin(req);throw failure('PLATFORM_UNSUPPORTED',422);});
 app.get('/api/v1/grenades',async req=>{const f=filters.parse(req.query);let q=requireClients().public.from('grenades').select('*',{count:'exact'});if(f.mapId)q=q.eq('map_id',f.mapId);if(f.type)q=q.eq('type',f.type);if(f.side)q=q.eq('side',f.side);const r=await q.order('created_at',{ascending:false}).order('id',{ascending:false}).range(f.offset,f.offset+f.limit-1);return {data:await Promise.all(checked(r).map(enrich)),pagination:{limit:f.limit,offset:f.offset,total:r.count}};});
 app.get('/api/v1/grenades/:id',async(req:any)=>{const r=checked(await requireClients().public.from('grenades').select('*').eq('id',uuid.parse(req.params.id)).maybeSingle());if(!r)throw failure('NOT_FOUND',404);return {data:await enrich(r)};});
 app.post('/api/v1/grenades',async(req,reply)=>{const {db}=await admin(req);const r=checked(await db.from('grenades').insert(dbBody(body.parse(req.body))).select().single());return reply.code(201).send({data:await enrich(r)});});
 app.patch('/api/v1/grenades/:id',async(req:any)=>{const {db}=await admin(req);const b=body.partial().parse(req.body);if(!Object.keys(b).length)throw failure('EMPTY_PATCH',400);const r=checked(await db.from('grenades').update(dbBody(b)).eq('id',uuid.parse(req.params.id)).select().maybeSingle());if(!r)throw failure('NOT_FOUND',404);return {data:await enrich(r)};});
 app.delete('/api/v1/grenades/:id',async(req:any,reply)=>{const {db}=await admin(req);const r=checked(await db.from('grenades').delete().eq('id',uuid.parse(req.params.id)).select('id').maybeSingle());if(!r)throw failure('NOT_FOUND',404);return reply.code(204).send();});
 app.post('/api/v1/media/uploads',async(req,reply)=>{const a=await admin(req);const id=randomUUID(),path=`${id}/source.mp4`;const db=requireClients().service;checked(await db.from('media_assets').insert({id,owner_id:a.id,source_type:'upload',storage_key:path}));const r=await db.storage.from('videos-staging').createSignedUploadUrl(path);if(r.error)throw failure('STORAGE_UNAVAILABLE',503);return reply.code(201).send({data:{mediaId:id,upload:{protocol:'supabase-signed',url:r.data.signedUrl,path,token:r.data.token},limits:{...limits}}});});
 app.get('/api/v1/media/:id',async(req:any)=>{await admin(req);const r=checked(await requireClients().service.from('media_assets').select('*').eq('id',uuid.parse(req.params.id)).maybeSingle());if(!r)throw failure('NOT_FOUND',404);return {data:mediaView(r)};});
 app.post('/api/v1/media/:id/complete',async(req:any,reply)=>{await admin(req);const db=requireClients().service;const id=uuid.parse(req.params.id);const asset=checked(await db.from('media_assets').select('*').eq('id',id).maybeSingle());if(!asset)throw failure('NOT_FOUND',404);if(asset.status==='awaiting_upload'){const object=await db.storage.from('videos-staging').info(asset.storage_key);if(object.error)throw failure('UPLOAD_NOT_FOUND',409);if(Number(object.data.size)>limits.maxBytes)throw failure('FILE_TOO_LARGE',400);}const r=checked(await db.from('media_assets').update({status:'queued',updated_at:new Date().toISOString()}).eq('id',id).eq('status','awaiting_upload').select().maybeSingle());if(r)return reply.code(202).send({data:mediaView(r)});const existing=checked(await db.from('media_assets').select('*').eq('id',id).maybeSingle());if(!existing)throw failure('NOT_FOUND',404);if(existing.status==='failed')throw failure('MEDIA_STATE_CONFLICT',409);return reply.code(existing.status==='ready'?200:202).send({data:mediaView(existing)});});
 app.get('/api/v1/media/:id/playback',async(req:any)=>{const db=requireClients().service;const id=uuid.parse(req.params.id);const published=checked(await db.from('grenades').select('id').eq('video_id',id).limit(1));if(!published.length)throw failure('NOT_FOUND',404);const media=checked(await db.from('media_assets').select('*').eq('id',id).eq('status','ready').maybeSingle());if(!media)throw failure('NOT_FOUND',404);const r=await db.storage.from('videos-staging').createSignedUrl(media.storage_key,3600);if(r.error)throw failure('STORAGE_UNAVAILABLE',503);return {data:{url:r.data.signedUrl,expiresAt:new Date(Date.now()+3600000).toISOString(),mimeType:'video/mp4'}};});
 return app;
}
