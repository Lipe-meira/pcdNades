// Validação com serviços reais de R1/R2 do PR #20 (adoção de objeto existente). Roda DENTRO do runner do laboratório documentado.
// LAB_SRC=pr20-src -> código do SHA revisado (e5add82): deve REPRODUZIR R1 (MP4 truncado publicado) e R2 (failed terminal).
// LAB_SRC=src      -> código corrigido.
// Falhas temporárias: um proxy HTTP no próprio processo devolve 503 numa requisição específica (assinar/baixar/info do clip.mp4) e
// repassa todo o resto ao Storage/GoTrue/PostgREST reais. O MP4 truncado é gerado com FFmpeg real e gravado pelo Storage real.
// Dados sintéticos, stack descartável; nada de produção.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';

const SRC=process.env.LAB_SRC??'src',fixed=SRC==='src';
const gateway=process.env.SUPABASE_URL!;assert.equal(gateway,'http://gateway:8000');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ---- proxy de falhas (somente 503 pontual ou retenção de UMA requisição; todo o resto passa intacto)
type Rule={method:string;re:RegExp;remaining:number;hits:number;kind:'fault'|'hold';hold?:Promise<void>;entered?:()=>void};
const rules:Rule[]=[];
const upstream=new URL(gateway);
const proxy=http.createServer(async(req,res)=>{
 const rule=rules.find(r=>r.remaining>0&&r.method===req.method&&r.re.test(req.url!));
 if(rule){rule.remaining--;rule.hits++;rule.entered?.();if(rule.kind==='fault'){req.resume();res.writeHead(503,{'content-type':'application/json'}).end('{"statusCode":"503","error":"lab_fault","message":"falha injetada"}');return;}await rule.hold;}
 const up=http.request({host:upstream.hostname,port:upstream.port,path:req.url,method:req.method,headers:{...req.headers,host:upstream.host}},out=>{res.writeHead(out.statusCode!,out.headers);out.pipe(res);});
 up.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(up);
});
await new Promise<void>(r=>proxy.listen(8001,'127.0.0.1',r));
process.env.SUPABASE_URL='http://127.0.0.1:8001'; // o BACKEND fala com os serviços reais através do proxy
Object.assign(process.env,{CONTRIBUTORS_ENABLED:'true',CONTRIBUTOR_UPLOADS_ENABLED:'true',CONTRIBUTOR_IMPORTS_ENABLED:'true',MEDIA_PROCESSOR_MODE:'inline-original',MEDIA_TRIMMING_ENABLED:'true'});
const {buildApp}=await import(`./${SRC}/application.js`);
const {readMediaLimits}=await import(`./${SRC}/config.js`);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),q=async(s:string,a:any[]=[])=>(await pool.query(s,a)).rows;
const service=createClient(gateway,key,{auth:{persistSession:false,autoRefreshToken:false}}),bucket=service.storage.from('videos-staging');
const app=buildApp();app.log.level='silent';const port=fixed?3321:3322;await app.listen({port,host:'127.0.0.1'});
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const mp4=await readFile('/results/synthetic.mp4');
const good=(()=>{execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=25','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart','-y','/results/adocao-good.mp4']);return null;})();
const goodBytes=await readFile('/results/adocao-good.mp4'),truncated=goodBytes.subarray(0,Math.floor(goodBytes.length*0.65));
const results:any[]=[];const mediaIds:string[]=[];void good;

const call=async(path:string,token:string,body?:any,method=body===undefined?'GET':'POST')=>{const r=await fetch(`http://127.0.0.1:${port}/api/v1${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.status===204?null:await r.json() as any};};
async function identity(){const r=await createClient(gateway,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signInAnonymously();assert.ifError(r.error);const token=r.data.session!.access_token;const c=await call('/contributors',token,{nickname:`Ado ${randomUUID().slice(0,8)}`});assert.equal(c.status,201,JSON.stringify(c));return token;}
async function newClipMedia(token:string){const r=await call('/media/uploads',token,{clip:{startSeconds:1,endSeconds:3}});assert.equal(r.status,201,JSON.stringify(r));const u=r.data.data;const p=await fetch(u.upload.url,{method:'PUT',headers:{'content-type':'video/mp4'},body:mp4});assert.ok(p.status<300,`upload ${p.status}`);mediaIds.push(u.mediaId);return u.mediaId as string;}
const complete=(token:string,id:string)=>call(`/media/${id}/complete`,token,{});
async function preCreateClip(id:string,bytes:Buffer){const s=await bucket.createSignedUploadUrl(`${id}/clip.mp4`);assert.ifError(s.error);const p=await fetch(s.data!.signedUrl,{method:'PUT',headers:{'content-type':'video/mp4'},body:bytes});assert.ok(p.status<300,`pre-create ${p.status}`);}
async function objectSha(path:string){const d=await bucket.download(path);assert.ifError(d.error);return sha(Buffer.from(await d.data!.arrayBuffer()));}
async function account(id:string){
 const row=(await q('select status,attempts,storage_key,storage_charge_bytes,metadata,error from media_assets where id=$1',[id]))[0];
 const objects=(await q("select name,(metadata->>'size')::bigint bytes from storage.objects where bucket_id='videos-staging' and name like $1 order by name",[id+'/%'])).map((o:any)=>({name:o.name,bytes:Number(o.bytes)}));
 const physical=objects.reduce((n:number,o:any)=>n+o.bytes,0),charged=Number(row.storage_charge_bytes);
 return {status:row.status,attempts:row.attempts,storageKey:row.storage_key,errorCode:row.error?.code??null,metadataBytes:row.metadata?.bytes??null,objects,dbPhysicalBytes:physical,chargedBytes:charged,unaccountedBytes:physical-charged};
}
const expireLease=(id:string)=>q("update media_assets set locked_until=now()-interval '1 second' where id=$1 and status='processing'",[id]);
const trigger=(fn:string,id:string,cond:string,action:string)=>q(`CREATE FUNCTION private.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF new.id='${id}'::uuid AND ${cond} THEN ${action} END IF; RETURN new; END $$; CREATE TRIGGER zz_${fn} BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION private.${fn}();`);
const untrigger=(fn:string)=>q(`DROP TRIGGER IF EXISTS zz_${fn} ON media_assets; DROP FUNCTION IF EXISTS private.${fn}()`);
/** E03 real: a 1ª tentativa grava clip.mp4 e perde o lease; a próxima retentativa cai na ADOÇÃO de um objeto VÁLIDO. */
async function leaveStoredClip(token:string){const id=await newClipMedia(token);await trigger('lab_lose_lease',id,"new.stage='storing' AND new.attempts=1","new.locked_until=now()-interval '1 second';");try{const r=await complete(token,id);assert.equal(r.status,202,JSON.stringify(r));}finally{await untrigger('lab_lose_lease');}return id;}
const uuidRe='[0-9a-f-]{36}';
const arm=(method:string,id:string,tail:string,remaining=1,kind:'fault'|'hold'='fault'):Rule=>{const r:Rule={method,re:new RegExp(`^/storage/v1/object/${tail.replace('{id}',id)}`),remaining,hits:0,kind};rules.push(r);return r;};
const disarm=()=>{rules.length=0;};
async function test(name:string,fn:()=>Promise<any>){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS',name);}catch(e:any){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}finally{disarm();}await writeFile(`/results/adocao-${SRC}.json`,JSON.stringify({src:SRC,mediaIds,fixtures:{goodBytes:goodBytes.length,truncatedBytes:truncated.length},results},null,2));}

try{
 await test('R1 MP4 de cabeçalho válido e conteúdo truncado, já gravado no Storage real como <id>/clip.mp4',async()=>{
  const token=await identity(),id=await newClipMedia(token);await preCreateClip(id,truncated);const before=await objectSha(`${id}/clip.mp4`);
  const r=await complete(token,id);const a=await account(id);const after=await objectSha(`${id}/clip.mp4`);
  assert.equal(after,before,'o objeto original nunca é alterado');
  if(fixed){assert.equal(r.data.data.status,'failed');assert.equal(r.data.data.error.code,'STORED_CLIP_INVALID');assert.equal(a.storageKey,`${id}/source.mp4`);assert.equal(a.chargedBytes,100_000_000);}
  else assert.equal(r.data.data.status,'ready','defeito R1 reproduzido no SHA revisado');
  return {published:r.data.data.status==='ready',...a};
 });
 await test('R1 controle positivo: MP4 íntegro já gravado como <id>/clip.mp4 é adotado e cobrado pelos bytes do objeto',async()=>{
  const token=await identity(),id=await newClipMedia(token);await preCreateClip(id,goodBytes);
  const r=await complete(token,id);assert.equal(r.data.data.status,'ready');const a=await account(id);
  assert.equal(a.metadataBytes,goodBytes.length);assert.equal(a.unaccountedBytes,0);return a;
 });
 if(fixed){
  await test('R2 corrida real: tentativa antiga retida na leitura do objeto não altera a mídia que outra instância já publicou',async()=>{
   const token=await identity(),id=await leaveStoredClip(token);
   const held=arm('GET',id,'sign/videos-staging/{id}/clip\\.mp4\\?',1,'hold');let release!:()=>void;held.hold=new Promise<void>(r=>release=r);const entered=new Promise<void>(r=>held.entered=r);
   const stale=complete(token,id);await entered;await expireLease(id);
   const {completeInline:otherInstance}=await import(`./${SRC}/inline.ts?instance=B`);
   const direct=createClient(gateway,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const fresh=await otherInstance(direct,id,readMediaLimits());assert.equal(fresh.asset.status,'ready');
   const published=await q('select * from media_assets where id=$1',[id]);release();const late=await stale;
   const after=await q('select * from media_assets where id=$1',[id]);assert.deepEqual(after,published,'a tentativa antiga não alterou a linha publicada');
   const a=await account(id);assert.equal(a.unaccountedBytes,0);
   return {freshStatus:fresh.status,staleStatus:late.status,publishedRowUnchanged:true,...a};
  });
 }
 await test('R2 falha única ao ASSINAR a leitura do objeto (503 real injetado) e retomada',async()=>{
  const token=await identity(),id=await leaveStoredClip(token);const f=arm('POST',id,'sign/videos-staging/{id}/clip\\.mp4$'.replace('{id}',id));
  const first=await complete(token,id);assert.equal(f.hits,1);
  if(!fixed){assert.equal(first.data.data.status,'failed');await expireLease(id);const second=await complete(token,id);assert.equal(second.data.data.status,'failed');return {defeitoR2Reproduzido:true,afterFault:first.data.data.error.code,afterRecovery:second.data.data.status,...await account(id)};}
  assert.equal(first.status,503);assert.equal(first.data.error.code,'STORAGE_UNAVAILABLE');const mid=await account(id);assert.equal(mid.status,'processing');assert.equal(mid.chargedBytes,100_000_000);
  const busy=await complete(token,id);assert.equal(busy.status,202);
  await expireLease(id);const second=await complete(token,id);assert.equal(second.status,200);assert.equal(second.data.data.status,'ready');
  const a=await account(id);assert.equal(a.unaccountedBytes,0);assert.equal(a.objects.length,2);return {afterFault:'503 STORAGE_UNAVAILABLE, linha processing, reserva retida',whileLeaseActive:202,...a};
 });
 if(fixed){
  await test('R2 falha única no DOWNLOAD do objeto (503 real injetado) e retomada',async()=>{
   const token=await identity(),id=await leaveStoredClip(token);const f=arm('GET',id,'sign/videos-staging/{id}/clip\\.mp4\\?');
   const first=await complete(token,id);assert.equal(f.hits,1);assert.equal(first.status,503);assert.equal((await account(id)).status,'processing');
   await expireLease(id);const second=await complete(token,id);assert.equal(second.data.data.status,'ready');const a=await account(id);assert.equal(a.unaccountedBytes,0);return a;
  });
  await test('R2 resposta ambígua do info (503 real injetado) e retomada',async()=>{
   const token=await identity(),id=await leaveStoredClip(token);const f=arm('GET',id,'info/videos-staging/{id}/clip\\.mp4');
   const first=await complete(token,id);assert.equal(f.hits,1,'a rota de info do supabase-js precisa ter sido atingida');assert.equal(first.status,503);assert.equal((await account(id)).status,'processing');
   await expireLease(id);const second=await complete(token,id);assert.equal(second.data.data.status,'ready');const a=await account(id);assert.equal(a.unaccountedBytes,0);return a;
  });
  await test('R2 esgotamento: falhas temporárias repetidas terminam em ATTEMPTS_EXHAUSTED sem novo objeto e com a reserva retida',async()=>{
   const token=await identity(),id=await leaveStoredClip(token);const f=arm('GET',id,'sign/videos-staging/{id}/clip\\.mp4\\?',99);
   const before=await objectSha(`${id}/clip.mp4`);
   const one=await complete(token,id);assert.equal(one.status,503);await expireLease(id);const two=await complete(token,id);assert.equal(two.status,503);await expireLease(id);
   const last=await complete(token,id);assert.equal(last.data.data.status,'failed');assert.equal(last.data.data.error.code,'ATTEMPTS_EXHAUSTED');
   const a=await account(id);assert.equal(a.chargedBytes,100_000_000);assert.equal(a.objects.length,2);assert.ok(a.dbPhysicalBytes<=a.chargedBytes);assert.equal(await objectSha(`${id}/clip.mp4`),before);
   return {faultHits:f.hits,attempts:a.attempts,...a};
  });
  await test('forma real do erro de info para objeto inexistente (classificação "não existe")',async()=>{
   const r=await bucket.info(`${randomUUID()}/nao-existe.mp4`);assert.ok(r.error);const e=r.error as any;
   const notFound=String(e.statusCode??e.status)==='404'||/not.?found/i.test(String(e.message??''));assert.ok(notFound,JSON.stringify({name:e.name,message:e.message,status:e.status,statusCode:e.statusCode}));
   return {name:e.name,message:e.message,status:e.status,statusCode:e.statusCode,classifiedAsNotFound:notFound};
  });
 }
}finally{await app.close();proxy.close();await pool.end();}
