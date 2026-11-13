// Fila do worker-transcode (src/worker.ts). Isolada para ser testável sem iniciar o processo.
// O worker grava playback-N.mp4 e RETÉM source.mp4: dois objetos por mídia. A contabilidade de bytes dos contribuidores só
// conhece um deles, então mídia de contribuidor NUNCA é processada aqui (R1 da revisão do PR #19). O administrador não muda.
export interface Queryable{query(sql:string,params?:unknown[]):Promise<{rows:any[]}>}
export const CONTRIBUTOR_UPLOAD_FAILURE=JSON.stringify({code:'PROCESSOR_UNSUPPORTED',message:'Este processador não aceita envios de contribuidores. Envie o vídeo novamente quando o envio colaborativo estiver disponível.'});
/** Marca como falha (mantendo a reserva de bytes: o objeto pode existir) o que um contribuidor deixou na fila deste processador. */
export async function failContributorUploads(db:Queryable){
 // A máquina de estados do banco só admite queued → processing → failed: duas etapas, só nas linhas que esta chamada acabou de assumir.
 const {rows}=await db.query("update public.media_assets set status='processing',stage='validating',locked_until=now()+interval '1 minute',updated_at=now() where contributor_id is not null and source_type='upload' and status='queued' returning id");
 if(!rows.length)return;
 await db.query("update public.media_assets set status='failed',stage=null,locked_until=null,error=$2::jsonb,updated_at=now() where id=any($1::uuid[]) and status='processing'",[rows.map(r=>r.id),CONTRIBUTOR_UPLOAD_FAILURE]);
}
export async function claimNextUpload(db:Queryable):Promise<any|undefined>{
 await db.query("update public.media_assets set status='failed',stage=null,locked_until=null,updated_at=now() where status='processing' and locked_until<now() and attempts>=3");
 const {rows}=await db.query(`with candidate as (select id from public.media_assets where source_type='upload' and contributor_id is null and (status='queued' or (status='processing' and locked_until<now() and attempts<3)) order by created_at for update skip locked limit 1) update public.media_assets m set status='processing',stage='validating',attempts=attempts+1,locked_until=now()+interval '15 minutes',updated_at=now() from candidate c where m.id=c.id returning m.*`);
 return rows[0];
}
