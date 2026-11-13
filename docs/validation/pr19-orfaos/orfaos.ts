// Validação com serviços reais (PostgreSQL, GoTrue, PostgREST, Storage, FFmpeg) da correção de órfãos em retentativas.
// Roda DENTRO do runner do laboratório documentado em docs/validation/pr19 (stack descartável, rede interna, dados sintéticos).
// LAB_SRC=pr19-src  -> código do SHA aprovado do PR #19 (352c0e1): deve REPRODUZIR a diferença.
// LAB_SRC=src       -> código corrigido: a diferença deve desaparecer.
// A injeção de falha é um trigger restrito a UMA mídia sintética; nada de FFmpeg, Storage, download ou banco é substituído.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';

const SRC=process.env.LAB_SRC??'src',fixed=SRC==='src';
Object.assign(process.env,{CONTRIBUTORS_ENABLED:'true',CONTRIBUTOR_UPLOADS_ENABLED:'true',CONTRIBUTOR_IMPORTS_ENABLED:'true',MEDIA_PROCESSOR_MODE:'inline-original',MEDIA_TRIMMING_ENABLED:'true'});
const {buildApp}=await import(`./${SRC}/application.js`);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),q=async(s:string,a:any[]=[])=>(await pool.query(s,a)).rows;
const url=process.env.SUPABASE_URL!,key=process.env.SUPABASE_SERVICE_ROLE_KEY!;assert.equal(url,'http://gateway:8000');
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),bucket=service.storage.from('videos-staging');
const app=buildApp();app.log.level='silent';const port=fixed?3311:3312;await app.listen({port,host:'127.0.0.1'});
const mp4=await readFile('/results/synthetic.mp4');const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const results:any[]=[];const mediaIds:string[]=[];

const call=async(path:string,token:string,body?:any,method=body===undefined?'GET':'POST')=>{const r=await fetch(`http://127.0.0.1:${port}/api/v1${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.status===204?null:await r.json() as any};};
// Cliente NOVO por identidade: signInAnonymously troca o token do cliente, e o `service` precisa continuar com a chave de serviço (Storage/RLS).
async function identity(){const r=await createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signInAnonymously();assert.ifError(r.error);const token=r.data.session!.access_token;const c=await call('/contributors',token,{nickname:`Orf ${randomUUID().slice(0,8)}`});assert.equal(c.status,201,JSON.stringify(c));return token;}
async function newClipMedia(token:string){const r=await call('/media/uploads',token,{clip:{startSeconds:1,endSeconds:3}});assert.equal(r.status,201,JSON.stringify(r));const u=r.data.data;const p=await fetch(u.upload.url,{method:'PUT',headers:{'content-type':'video/mp4'},body:mp4});assert.ok(p.status<300,`upload ${p.status}`);mediaIds.push(u.mediaId);return u.mediaId as string;}
async function account(id:string){
 const row=(await q('select status,attempts,storage_key,storage_charge_bytes,metadata from media_assets where id=$1',[id]))[0];
 const objects=(await q("select name,(metadata->>'size')::bigint bytes,updated_at from storage.objects where bucket_id='videos-staging' and name like $1 order by name",[id+'/%'])).map((o:any)=>({name:o.name,bytes:Number(o.bytes)}));
 const physical=objects.reduce((n:number,o:any)=>n+o.bytes,0),charged=Number(row.storage_charge_bytes);
 return {status:row.status,attempts:row.attempts,storageKey:row.storage_key,metadataBytes:row.metadata?.bytes??null,objects,dbPhysicalBytes:physical,chargedBytes:charged,unaccountedBytes:physical-charged};
}
async function test(name:string,fn:()=>Promise<any>){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS',name);}catch(e:any){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}await writeFile(`/results/orfaos-${SRC}.json`,JSON.stringify({src:SRC,mediaIds,results},null,2));}
const trigger=(fn:string,id:string,cond:string,action:string)=>q(`CREATE FUNCTION private.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF new.id='${id}'::uuid AND ${cond} THEN ${action} END IF; RETURN new; END $$; CREATE TRIGGER zz_${fn} BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION private.${fn}();`);
const untrigger=(fn:string)=>q(`DROP TRIGGER IF EXISTS zz_${fn} ON media_assets; DROP FUNCTION IF EXISTS private.${fn}()`);
const expectGap=(a:any,label:string)=>{if(fixed){assert.equal(a.unaccountedBytes,0,`${label}: ${JSON.stringify(a)}`);assert.equal(a.objects.length,2,label);}else{assert.ok(a.unaccountedBytes>0,`${label} deveria reproduzir a diferença: ${JSON.stringify(a)}`);assert.equal(a.objects.length,3,label);}};

try{
 let published:{token:string;id:string}|undefined;
 await test('F1 lease perdido ao entrar em storing e nova tentativa (E03)',async()=>{
  const token=await identity(),id=await newClipMedia(token);
  await trigger('lab_lose_lease',id,"new.stage='storing' AND new.attempts=1","new.locked_until=now()-interval '1 second';");
  try{const first=await call(`/media/${id}/complete`,token,{});assert.equal(first.status,202,JSON.stringify(first));
   await untrigger('lab_lose_lease');const second=await call(`/media/${id}/complete`,token,{});assert.equal(second.status,200,JSON.stringify(second));assert.equal(second.data.data.status,'ready');
   const a=await account(id);expectGap(a,'F1');published={token,id};
   if(fixed){assert.equal(a.storageKey,`${id}/clip.mp4`);assert.equal(a.metadataBytes,a.objects.find((o:any)=>o.name.endsWith('clip.mp4')).bytes,'bytes do metadata = bytes do objeto armazenado');}
   return {faultInjection:'um lease sintético expirado ao entrar em storing; nada substituído',...a};
  }finally{await untrigger('lab_lose_lease');}
 });

 await test('F2 banco indisponível na confirmação (ready e failed) e nova tentativa',async()=>{
  const token=await identity(),id=await newClipMedia(token);
  await trigger('lab_db_down',id,"new.status IN ('ready','failed') AND new.attempts=1","RAISE EXCEPTION 'lab_db_down';");
  try{const first=await call(`/media/${id}/complete`,token,{});assert.equal(first.status,503,JSON.stringify(first));
   const mid=await account(id);assert.equal(mid.status,'processing');
   await untrigger('lab_db_down');await q("update media_assets set locked_until=now()-interval '1 second' where id=$1 and status='processing'",[id]);
   const second=await call(`/media/${id}/complete`,token,{});assert.equal(second.status,200,JSON.stringify(second));assert.equal(second.data.data.status,'ready');
   const a=await account(id);expectGap(a,'F2');return {afterFirstAttempt:{objects:mid.objects.length,physical:mid.dbPhysicalBytes},...a};
  }finally{await untrigger('lab_db_down');}
 });

 await test('F3 objeto publicado é preservado: repetir complete e tentar regravar não altera nada',async()=>{
  assert.ok(published,'F1 precisa ter produzido uma mídia pronta');const {token,id}=published;
  const g=await call('/grenades',token,{title:'Órfãos sintética',mapId:'mirage',type:'smoke',side:'T',instructions:'Fixture sem dados reais',target:{x:0.2,y:0.3},videoId:id});assert.equal(g.status,201,JSON.stringify(g));
  const snapshot=async()=>{const p=await call(`/media/${id}/playback`,token);assert.equal(p.status,200,JSON.stringify(p));const bytes=Buffer.from(await (await fetch(p.data.data.url)).arrayBuffer());return {sha256:sha(bytes),bytes:bytes.length,objects:await q("select name,version,(metadata->>'size') size,updated_at::text u from storage.objects where bucket_id='videos-staging' and name like $1 order by name",[id+'/%'])};};
  const before=await snapshot();
  for(let i=0;i<3;i++){const r=await call(`/media/${id}/complete`,token,{});assert.equal(r.status,200);}
  // O Storage real recusa até EMITIR nova capacidade de upload (upsert:false) para uma chave que já existe.
  const publishedKey=(await q('select storage_key k from media_assets where id=$1',[id]))[0].k;
  const signed=await bucket.createSignedUploadUrl(publishedKey);
  assert.ok(signed.error,'o Storage deveria recusar nova capacidade de upload para a chave publicada');
  const after=await snapshot();assert.deepEqual(after,before);
  return {publishedKey,sha256Unchanged:after.sha256===before.sha256,objectsUnchanged:true,newUploadCapabilityForPublishedKey:`recusada: ${signed.error!.message}`,completeRepeats:3};
 });

 if(fixed){
  const {tokenLifetimeSeconds,measureUploadTtl,drainWaitSeconds}=await import('./src/signed-url-ttl.js');
  let ttl=0;
  await test('T1 validade efetiva medida (token de sonda, nenhum byte enviado)',async()=>{const m=await measureUploadTtl(bucket as any,`ttl-probe/${randomUUID()}.mp4`);ttl=m.ttlSeconds;assert.ok(ttl>0);return {ttlSeconds:ttl,assumedBySql:7200,sqlWindowMinutes:150,sqlPendingWindowCoversTtl:ttl<=150*60-0,suggestedDrainWaitSeconds:drainWaitSeconds({ttlSeconds:ttl})};});
  await test('T2 token já emitido permite reenviar o mesmo caminho depois de a exclusão do objeto (dentro da validade) e expira depois',async()=>{
   const path=`ttl-probe/${randomUUID()}.mp4`,s=await bucket.createSignedUploadUrl(path);assert.ifError(s.error);const issued=Date.now();
   const put=()=>fetch(s.data!.signedUrl,{method:'PUT',headers:{'content-type':'video/mp4'},body:mp4}).then(async r=>{await r.body?.cancel();return r.status;});
   const first=await put();const duplicate=await put();const removed=await bucket.remove([path]);assert.ifError(removed.error);const resend=await put();
   const tokenTtl=tokenLifetimeSeconds(s.data!.token)!;await new Promise(r=>setTimeout(r,Math.max(0,issued+(tokenTtl+3)*1000-Date.now())));
   const expired=await put();await bucket.remove([path]);
   assert.ok(first<300&&duplicate>=400&&resend<300&&expired>=400,JSON.stringify({first,duplicate,resend,expired}));
   return {tokenTtlSeconds:tokenTtl,firstPut:first,duplicatePutWhileObjectExists:duplicate,resendAfterObjectDeleted:resend,putAfterExpiry:expired,probeObjectRemoved:'sintético, do próprio laboratório'};
  });
  await test('I1 inventário somente leitura sobre o estado real do laboratório (duas leituras, TTL medido)',async()=>{
   const {loadSnapshot,buildInventory}=await import('./src/storage-inventory.js');
   const tableHash=async()=>(await q("select (select md5(string_agg(to_jsonb(m)::text,'' order by m.id)) from media_assets m) media,(select md5(string_agg(to_jsonb(o)::text,'' order by o.id)) from storage.objects o) objects"))[0];
   const before=await tableHash(),client=await pool.connect();
   try{
    const first=await loadSnapshot(client);await new Promise(r=>setTimeout(r,1500));const second=await loadSnapshot(client);
    const real=buildInventory(second,{now:new Date(),signedUploadTtlSeconds:ttl,previous:first});
    const whatIf=buildInventory(second,{now:new Date(Date.now()+3*3600e3),signedUploadTtlSeconds:ttl,previous:first});
    await client.query('begin read only');let writeError='';try{await client.query('update public.media_assets set attempts=attempts where false');}catch(e:any){writeError=e.message;}await client.query('rollback');
    const after=await tableHash();assert.deepEqual(after,before);assert.match(writeError,/read-only/i);
    const mine=new Set(mediaIds);const brief=(r:any)=>r.items.filter((i:any)=>i.mediaId&&mine.has(i.mediaId)).map((i:any)=>({key:i.key,bytes:i.bytes,class:i.class,verdict:i.verdict,reasons:i.reasons}));
    return {ttlSecondsUsed:ttl,graceSeconds:real.parameters.graceSeconds,readOnlyWriteAttempt:writeError,tablesUnchanged:true,
     real:{totals:real.totals,accounting:{contributor:{physicalBytes:real.accounting.contributor.physicalBytes,chargedBytes:real.accounting.contributor.chargedBytes,unaccountedBytes:real.accounting.contributor.unaccountedBytes,mediaWithGap:real.accounting.contributor.mediaWithGap.length},adminPhysicalBytes:real.accounting.adminPhysicalBytes,noRowBytes:real.accounting.noRowBytes},thisRunItems:brief(real)},
     whatIfPlus3h:{note:'simulação: apenas o relógio do relatório foi avançado 3 h; nada foi esperado nem alterado',candidateBytes:whatIf.totals.candidateBytes,thisRunItems:brief(whatIf)}};
   }finally{client.release();}
  });
 }
}finally{await app.close();await pool.end();}
