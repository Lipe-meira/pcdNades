// Laboratório de retentativas de corte: PostgreSQL REAL (PGlite, triggers e cobrança da migration) + Storage falso COM TAMANHOS.
// O Storage falso imita só o contrato que o backend usa: objeto existente não é sobrescrito (upsert:false), info/remove/URL assinada.
// NÃO prova Storage, FFmpeg nem rede reais: isso é validado no laboratório Docker (docs/validation/pr19-orfaos).
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stat,writeFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {MediaError} from '../../src/probe.js';
import {completeInline} from '../../src/inline.js';
import {createDb,seedUsers,ids} from './pg.js';
import {createSupabaseOverPg} from './supabase-pg.js';

export const MB=1_000_000;
export const CLIP={startSeconds:1,endSeconds:3};
export const LIMITS={maxBytes:50*MB,maxDurationSeconds:90};

export class FakeStorage{
 objects=new Map<string,number>();removed:string[]=[];stores:string[]=[];
 sizeOf(prefix:string){let n=0;for(const [k,v] of this.objects)if(k.startsWith(prefix))n+=v;return n;}
 keysOf(prefix:string){return [...this.objects.keys()].filter(k=>k.startsWith(prefix)).sort();}
 api={
  info:async(path:string)=>this.objects.has(path)?{data:{size:this.objects.get(path)},error:null}:{data:null,error:{message:'Object not found'}},
  createSignedUrl:async(path:string)=>({data:{signedUrl:`https://storage.test/videos-staging/${path}?sig=1`},error:null}),
  createSignedUploadUrl:async(path:string)=>({data:{signedUrl:`https://storage.test/videos-staging/${path}?token=t`,token:'t'},error:null}),
  remove:async(paths:string[])=>{this.removed.push(...paths);for(const p of paths)this.objects.delete(p);return {data:[],error:null};}
 };
}

export type Lab=Awaited<ReturnType<typeof createLab>>;
export async function createLab(){
 const db=await createDb();await seedUsers(db);
 await db.query('select * from public.register_contributor($1,$2)',[ids.anonA,'Ana']);
 const sb=createSupabaseOverPg(db,{});const storage=new FakeStorage();
 const client:any={...sb.clients.service,storage:{from:()=>storage.api}};
 let trims=0,downloads=0;
 // `trimSizes[n]` = bytes do corte gerado na n-ésima execução do FFmpeg (permite simular codificação não determinística).
 const config={sourceBytes:50_000,trimSizes:[20_000,20_000,20_000,20_000],clipDuration:2,probeError:undefined as string|undefined,storeFault:undefined as undefined|((key:string)=>Promise<void>|void)};
 const decodeCalls:string[]=[];
 const deps:Record<string,any>={
  // Decodificação integral do objeto ADOTADO. O falso aceita tudo; os testes de integridade a substituem (ou usam o FFmpeg real).
  decode:async(path:string)=>{decodeCalls.push(path);return 'ok' as const;},
  download:async(url:string,path:string)=>{downloads++;const key=new URL(url).pathname.replace('/videos-staging/','');await writeFile(path,Buffer.alloc(storage.objects.get(key)??0));},
  probe:async()=>{if(config.probeError)throw new MediaError(config.probeError);return {durationSeconds:config.clipDuration,width:320,height:240,mimeType:'video/mp4'};},
  trim:async(_input:string,output:string)=>{const size=config.trimSizes[Math.min(trims,config.trimSizes.length-1)];trims++;await writeFile(output,Buffer.alloc(size));return {durationSeconds:config.clipDuration,width:320,height:240,mimeType:'video/mp4',bytes:size,clip:CLIP,sourceDurationSeconds:4};},
  store:async(_db:any,key:string,path:string)=>{
   storage.stores.push(key);await config.storeFault?.(key);
   if(storage.objects.has(key))throw new MediaError('STORAGE_UNAVAILABLE'); // upsert:false
   storage.objects.set(key,(await stat(path)).size);
  }
 };
 const previous=process.env.MEDIA_TRIMMING_ENABLED;process.env.MEDIA_TRIMMING_ENABLED='true';
 async function newClipMedia(){
  const id=randomUUID(),key=`${id}/source.mp4`;
  await db.query("insert into public.media_assets(id,owner_id,source_type,storage_key,clip) values($1,$2,'upload',$3,$4)",[id,ids.anonA,key,JSON.stringify(CLIP)]);
  storage.objects.set(key,config.sourceBytes);return id;
 }
 const complete=(id:string)=>completeInline(client,id,LIMITS,deps as any);
 const row=async(id:string)=>(await db.query<any>('select * from public.media_assets where id=$1',[id])).rows[0];
 /** Perde o lease logo após entrar em `storing` na tentativa informada (mesma injeção do E03 do laboratório integrado). */
 const loseLeaseAtStoring=async(id:string,attempt:number)=>{
  await db.exec(`create or replace function private.lab_lose_lease() returns trigger language plpgsql as $$ begin if new.id='${id}'::uuid and new.stage='storing' and new.attempts=${attempt} then new.locked_until=now()-interval '1 second'; end if; return new; end $$;
   drop trigger if exists zz_lab_lease on public.media_assets;create trigger zz_lab_lease before update on public.media_assets for each row execute function private.lab_lose_lease();`);
 };
 const clearFault=async()=>{await db.exec('drop trigger if exists zz_lab_lease on public.media_assets');};
 /** Invariante de contabilidade: todo byte físico da mídia (fonte + saídas + órfãos) precisa estar coberto pela cobrança SQL. */
 const accounting=async(id:string)=>{const r=await row(id);return {physical:storage.sizeOf(`${id}/`),charged:Number(r.storage_charge_bytes),keys:storage.keysOf(`${id}/`)};};
 const close=async()=>{await db.close();if(previous===undefined)delete process.env.MEDIA_TRIMMING_ENABLED;else process.env.MEDIA_TRIMMING_ENABLED=previous;};
 return {db:db as PGlite,client,storage,config,deps,newClipMedia,complete,row,loseLeaseAtStoring,clearFault,accounting,close,decodeCalls,counts:()=>({trims,downloads})};
}
export {assert};
