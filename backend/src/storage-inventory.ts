// Inventário de objetos do Storage x contabilidade SQL, SOMENTE LEITURA (dry-run).
//
// Este módulo nunca remove, move nem grava nada: classifica cada objeto, compara bytes físicos com a cobrança e diz o que SERIA
// elegível a uma limpeza manual futura e por quê. Um veredito `candidate` não é autorização: a exclusão (que não existe aqui)
// exige backup do manifesto, aprovação humana e a espera de dreno calculada com o TTL medido (docs/ORFAOS-RETENTATIVAS-20261112.md).
import {drainWaitSeconds} from './signed-url-ttl.js';

export type MediaRow={id:string;status:string;source_type:string;storage_key:string;clip:unknown;attempts:number;locked_until:string|null;created_at:string;updated_at:string;storage_charge_bytes:number|string;contributor_id:string|null};
export type ObjectRow={name:string;size:number|string|null;created_at:string|null;updated_at:string|null};
export type Snapshot={media:MediaRow[];objects:ObjectRow[];publishedMediaIds:string[];liveImportSourceMediaIds:string[]};
export type Options={now:Date;signedUploadTtlSeconds:number;clockToleranceSeconds?:number;marginSeconds?:number;previous?:Snapshot};

export type ObjectClass='current_reference'|'source_retained'|'deterministic_output_unreferenced'|'attempt_output_unreferenced'|'no_media_row'|'unrecognized_name';
export type Verdict='keep'|'review'|'candidate_unconfirmed'|'candidate'|'blocked';
export type Item={key:string;mediaId:string|null;bytes:number;class:ObjectClass;verdict:Verdict;reasons:string[];createdAt:string|null;updatedAt:string|null};

const NAME=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(source\.mp4|clip\.mp4|(?:clip|playback|import)-\d+\.mp4)$/;
const bytesOf=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0;};
const time=(v:string|null|undefined)=>{const t=v?Date.parse(v):NaN;return Number.isFinite(t)?t:null;};

export function buildInventory(snapshot:Snapshot,options:Options){
 const grace=drainWaitSeconds({ttlSeconds:options.signedUploadTtlSeconds,clockToleranceSeconds:options.clockToleranceSeconds,marginSeconds:options.marginSeconds});
 const nowMs=options.now.getTime();
 const rows=new Map(snapshot.media.map(m=>[m.id,m]));
 const referenced=new Set(snapshot.media.map(m=>m.storage_key));
 const published=new Set(snapshot.publishedMediaIds),liveImport=new Set(snapshot.liveImportSourceMediaIds);
 const previousObjects=options.previous&&new Map(options.previous.objects.map(o=>[o.name,o]));
 const previousRows=options.previous&&new Map(options.previous.media.map(m=>[m.id,m]));

 const items:Item[]=snapshot.objects.map(o=>{
  const key=o.name,bytes=bytesOf(o.size),m=NAME.exec(key);
  const base={key,bytes,createdAt:o.created_at,updatedAt:o.updated_at};
  if(!m)return {...base,mediaId:null,class:'unrecognized_name',verdict:'review',reasons:['name_outside_known_patterns']} as Item;
  const [,mediaId,file]=m,row=rows.get(mediaId);
  const item=(cls:ObjectClass,verdict:Verdict,reasons:string[]):Item=>({...base,mediaId,class:cls,verdict,reasons});
  if(referenced.has(key))return item('current_reference','keep',['referenced_by_media_assets']);
  if(!row)return item('no_media_row','review',['no_media_row_may_have_been_deleted_by_admin']);
  // A fonte é mantida de propósito: permite regenerar o corte e removê-la reabriria o upload com um token ainda válido.
  if(file==='source.mp4')return item('source_retained','keep',['source_retained_by_design']);
  const cls:ObjectClass=file==='clip.mp4'?'deterministic_output_unreferenced':'attempt_output_unreferenced';

  const reasons:string[]=[];
  if(['queued','processing'].includes(row.status))reasons.push('media_in_progress');
  if(row.status==='awaiting_upload')reasons.push('awaiting_upload');
  const lease=time(row.locked_until);if(lease!==null&&lease>nowMs)reasons.push('lease_active');
  if(liveImport.has(mediaId))reasons.push('import_source_live');
  const stamps=[time(o.created_at),time(o.updated_at),time(row.updated_at)];
  if(stamps.some(t=>t===null)||time(o.created_at)===null)reasons.push('timestamp_unknown');
  else if(Math.max(...(stamps as number[]))>nowMs-grace*1000)reasons.push('inside_signed_url_window');
  if(previousObjects&&previousRows){
   const before=previousObjects.get(key),beforeRow=previousRows.get(mediaId);
   const same=before&&beforeRow&&bytesOf(before.size)===bytes&&before.updated_at===o.updated_at&&beforeRow.status===row.status&&beforeRow.attempts===row.attempts&&beforeRow.storage_key===row.storage_key&&beforeRow.updated_at===row.updated_at;
   if(!same)reasons.push('changed_between_reads');
  }
  if(reasons.length)return item(cls,'blocked',reasons);
  const notes=published.has(mediaId)?['media_published_other_object']:[];
  return item(cls,previousObjects?'candidate':'candidate_unconfirmed',notes);
 });

 // Contabilidade: bytes físicos por mídia (fonte + saídas + objetos soltos) contra storage_charge_bytes.
 const physicalByMedia=new Map<string,{bytes:number;keys:string[]}>();let noRowBytes=0,adminPhysicalBytes=0;
 for(const i of items){
  if(!i.mediaId||!rows.has(i.mediaId)){if(i.class==='no_media_row')noRowBytes+=i.bytes;continue;}
  const p=physicalByMedia.get(i.mediaId)??{bytes:0,keys:[]};p.bytes+=i.bytes;p.keys.push(i.key);physicalByMedia.set(i.mediaId,p);
 }
 let physicalBytes=0,chargedBytes=0;const mediaWithGap:{mediaId:string;physicalBytes:number;chargedBytes:number;gapBytes:number;keys:string[]}[]=[];
 for(const [mediaId,p] of physicalByMedia){
  const row=rows.get(mediaId)!;
  if(row.contributor_id===null){adminPhysicalBytes+=p.bytes;continue;}
  const charged=bytesOf(row.storage_charge_bytes);physicalBytes+=p.bytes;chargedBytes+=charged;
  if(p.bytes>charged)mediaWithGap.push({mediaId,physicalBytes:p.bytes,chargedBytes:charged,gapBytes:p.bytes-charged,keys:p.keys.sort()});
 }
 // A cobrança de mídias sem nenhum objeto também conta no total cobrado (reserva ainda não usada).
 for(const row of snapshot.media)if(row.contributor_id!==null&&!physicalByMedia.has(row.id))chargedBytes+=bytesOf(row.storage_charge_bytes);

 const byClass={} as Record<ObjectClass,{objects:number;bytes:number}>;
 for(const c of ['current_reference','source_retained','deterministic_output_unreferenced','attempt_output_unreferenced','no_media_row','unrecognized_name'] as ObjectClass[])byClass[c]={objects:0,bytes:0};
 let candidateBytes=0,blockedBytes=0;
 for(const i of items){byClass[i.class].objects++;byClass[i.class].bytes+=i.bytes;if(i.verdict==='candidate')candidateBytes+=i.bytes;if(i.verdict==='blocked')blockedBytes+=i.bytes;}

 return {
  dryRun:true as const,destructiveActions:0 as const,generatedAt:options.now.toISOString(),
  parameters:{signedUploadTtlSeconds:options.signedUploadTtlSeconds,graceSeconds:grace,twoReads:Boolean(options.previous)},
  totals:{objects:items.length,bytes:items.reduce((n,i)=>n+i.bytes,0),byClass,candidateBytes,blockedBytes},
  accounting:{contributor:{physicalBytes,chargedBytes,unaccountedBytes:mediaWithGap.reduce((n,m)=>n+m.gapBytes,0),mediaWithGap:mediaWithGap.sort((a,b)=>b.gapBytes-a.gapBytes)},adminPhysicalBytes,noRowBytes},
  items:items.sort((a,b)=>a.key.localeCompare(b.key))
 };
}
export type Inventory=ReturnType<typeof buildInventory>;

type Queryable={query:(sql:string,params?:unknown[])=>PromiseLike<{rows:any[]}>};
/** Lê o estado inteiro numa transação READ ONLY (o próprio banco recusa qualquer escrita). Só o bucket videos-staging. */
export async function loadSnapshot(db:Queryable):Promise<Snapshot>{
 await db.query('begin read only');
 try{
  const media=(await db.query("select id,status,source_type,storage_key,clip,attempts,locked_until,created_at,updated_at,storage_charge_bytes,contributor_id from public.media_assets")).rows;
  const objects=(await db.query("select name,(metadata->>'size')::bigint as size,created_at,updated_at from storage.objects where bucket_id='videos-staging'")).rows;
  const published=(await db.query('select distinct video_id from public.grenades where video_id is not null')).rows;
  const imports=(await db.query('select media_id from public.import_sources where media_id is not null and expires_at>now()')).rows;
  const iso=(v:unknown)=>v instanceof Date?v.toISOString():(v===null||v===undefined?null:String(v));
  return {
   media:media.map(r=>({...r,locked_until:iso(r.locked_until),created_at:iso(r.created_at)!,updated_at:iso(r.updated_at)!})),
   objects:objects.map(r=>({name:r.name,size:r.size,created_at:iso(r.created_at),updated_at:iso(r.updated_at)})),
   publishedMediaIds:published.map(r=>r.video_id),liveImportSourceMediaIds:imports.map(r=>r.media_id)
  };
 }finally{await db.query('rollback');}
}
