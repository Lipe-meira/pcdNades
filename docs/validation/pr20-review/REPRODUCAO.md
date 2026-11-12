# Reprodução local da revisão do PR #20

HEAD: e5add826b4affb14b4390c5f42c43184ac814796. Não acessa Supabase/Storage nem lê arquivos de credenciais. Usa o suporte PGlite do PR, Storage simulado, fixture de vídeo sintética e FFmpeg do PATH; probeOriginal usa o ffprobe empacotado. Nenhum teste ou fonte de implementação foi alterado.

Em um worktree isolado nesse HEAD, instalar dependências com npm ci --ignore-scripts dentro de backend/. Salvar o bloco abaixo em backend/.review-pr20.ts e executar npx tsx .review-pr20.ts nesse diretório. Exige ffmpeg no PATH. Remove somente o diretório temporário único criado pela própria reprodução. Os três processos de CLI recebem ambiente sintético e são recusados antes de conexão.

O script demonstra os comportamentos do HEAD revisado, inclusive os defeitos esperados; exit 0 significa que as observações foram reproduzidas, não que o PR foi aprovado. Após corrigir a implementação, as asserções que esperam ready inválido/failed terminal devem mudar. Resultado desta revisão: observacoes.json.

```typescript
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLab} from './tests/support/clip-lab.js';
import {probeOriginal} from './src/probe.js';

const dir=await mkdtemp(join(tmpdir(),'pcdn-pr20-review-'));
const result:any={};
try {
 const good=join(dir,'good.mp4'),bad=join(dir,'truncated.mp4');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=25','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart',good]);
 const bytes=await readFile(good),truncated=bytes.subarray(0,Math.floor(bytes.length*0.65));await writeFile(bad,truncated);
 const metadata=await probeOriginal(bad,{maxBytes:50_000_000,maxDurationSeconds:90},new AbortController().signal);
 let decodeFails=false;try{execFileSync('ffmpeg',['-v','error','-xerror','-err_detect','explode','-i',bad,'-f','null','-'],{stdio:'pipe'});}catch{decodeFails=true;}
 assert.equal(decodeFails,true);assert.equal(metadata.durationSeconds,2);
 const lab=await createLab();
 try{
  const id=await lab.newClipMedia();lab.storage.objects.set(`${id}/clip.mp4`,truncated.length);
  lab.deps.download=async(_url:string,path:string)=>{await writeFile(path,path.endsWith('stored.mp4')?truncated:Buffer.alloc(50_000));};
  lab.deps.probe=probeOriginal as any;
  const r=await lab.complete(id);
  assert.equal(r.asset.status,'ready');
  result.corruptAdoption={originalBytes:bytes.length,truncatedBytes:truncated.length,probeMetadata:metadata,fullDecodeFails:decodeFails,status:r.asset.status,storageKey:r.asset.storage_key,chargedBytes:Number(r.asset.storage_charge_bytes)};
 }finally{await lab.close();}

 const temporary=await createLab();
 try{
  const id=await temporary.newClipMedia();await temporary.loseLeaseAtStoring(id,1);await temporary.complete(id);await temporary.clearFault();
  const originalDownload=temporary.deps.download;
  temporary.deps.download=async(u:string,p:string)=>{if(p.endsWith('stored.mp4'))throw new Error('STORAGE_UNAVAILABLE');return originalDownload(u,p);};
  const failed=await temporary.complete(id);temporary.deps.download=originalDownload;
  const before=temporary.counts();const retry=await temporary.complete(id);
  assert.equal(failed.asset.error.code,'STORAGE_UNAVAILABLE');assert.equal(retry.asset.status,'failed');assert.deepEqual(temporary.counts(),before);
  result.temporaryReadFailure={afterFault:failed.asset.status,error:failed.asset.error.code,afterRecovery:retry.asset.status,attempts:retry.asset.attempts,retryDidNoWork:true,physicalAndCharged:await temporary.accounting(id)};
 }finally{await temporary.close();}
 const race=await createLab();
 try {
  const {completeInline:otherInstance}=await import('./src/inline.ts?review-instance=B');
  const id=await race.newClipMedia();race.config.trimSizes=[20_000,21_500];await race.loseLeaseAtStoring(id,1);
  let release!:()=>void,entered!:()=>void;const held=new Promise<void>(r=>release=r),waiting=new Promise<void>(r=>entered=r);
  const realStore=race.deps.store;let first=true;
  race.deps.store=async(...args:any[])=>{if(first){first=false;entered();await held;}return (realStore as any)(...args);};
  const stale=race.complete(id);await waiting;await race.clearFault();
  const fresh=await otherInstance(race.client,id,{maxBytes:50_000_000,maxDurationSeconds:90},race.deps as any);
  assert.equal(fresh.asset.status,'ready');const before=await race.row(id);release();const late=await stale;
  const after=await race.row(id);assert.deepEqual(after,before);const counts=await race.accounting(id);assert.equal(counts.physical,counts.charged);
  result.isolatedModuleRace={fresh:fresh.status,late:late.status,attempts:after.attempts,publishedRowUnchanged:true,physicalAndCharged:counts};
 }finally{await race.close();}
 const safeEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_SERVICE_ROLE_KEY:'synthetic-unused',DATABASE_URL:'postgres://synthetic:unused@127.0.0.1:1/postgres',CONFIRM_TARGET_HOST:'wrong-target'};
 result.cliGuards=[];
 for(const [script,args,expected] of [
  ['measure-upload-url-ttl.ts',[],/Trava:/],
  ['storage-inventory.ts',['--signed-url-ttl-seconds','60'],/Trava:/],
  ['storage-inventory.ts',[],/Informe --signed-url-ttl-seconds/],
 ] as const){const p=spawnSync(process.execPath,['--import','tsx','scripts/'+script,...args],{env:safeEnv,encoding:'utf8'});assert.equal(p.status,2);assert.match(p.stderr,expected);assert.equal(p.stdout,'');result.cliGuards.push({script,args,status:p.status,stderr:p.stderr.trim()});}
 console.log(JSON.stringify(result,null,2));
}finally{await rm(dir,{recursive:true,force:true});}
```
