// Orquestrador do host para a validação de R1/R2 (PR #20) com serviços reais. Pré-requisito: laboratório novo preparado e já executado com
// docs/validation/pr19/launch.mjs (precisa de schema, usuários e synthetic.mp4). Só toca recursos do projeto do próprio laboratório.
//   node docs/validation/pr19-orfaos/adocao-launch.mjs -r71 <SHA-do-código-revisado-sem-a-correção>
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const suffix=process.argv[2]??'',reviewed=process.argv[3]??'';
if(!/^-r[0-9]+$/.test(suffix)||!/^[0-9a-f]{40}$/.test(reviewed))throw Error('Uso: adocao-launch.mjs -rNN <sha40 do código revisado>');
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..'),runtime=resolve(root,'docs/validation/pr19','runtime'+suffix);
const project='pcdn-pr19-352c-20261112'+suffix,runner=project+'-runner-1',storage=project+'-storage-1';
const docker=(...a)=>execFileSync('docker',a,{encoding:'utf8',maxBuffer:64e6});
assert.ok(existsSync(resolve(runtime,'results.json'))&&existsSync(resolve(runtime,'synthetic.dump')),'Execute antes docs/validation/pr19/launch.mjs neste laboratório.');

// 1) código revisado (baseline do defeito) e integridade do código corrigido dentro da imagem
const baseDir=resolve(runtime,'reviewed-baseline');if(!existsSync(baseDir)){mkdirSync(baseDir,{recursive:true});
 execFileSync('git',['archive','--format=tar','--output='+resolve(runtime,'reviewed.tar'),reviewed,'backend/src'],{cwd:root});
 execFileSync(resolve(process.env.SystemRoot??'C:\\Windows','System32','tar.exe'),['-xf',resolve(runtime,'reviewed.tar'),'-C',baseDir]);}
docker('cp',resolve(baseDir,'backend/src'),runner+':/app/backend/pr20-src');
const integrity={};
for(const f of ['inline.ts','trimming.ts','clip-storage.ts','storage-inventory.ts','signed-url-ttl.ts']){
 const host=createHash('sha256').update(readFileSync(resolve(root,'backend/src',f))).digest('hex');
 const inside=docker('exec',runner,'sha256sum','/app/backend/src/'+f).split(' ')[0];integrity[f]={match:host===inside,sha256:host};
}
assert.ok(Object.values(integrity).every(x=>x.match),'A imagem do runner não corresponde ao worktree: '+JSON.stringify(integrity));

// 2) execução (primeiro o código revisado, para gastar menos reserva do orçamento global do laboratório)
docker('cp',resolve(here,'adocao.ts'),runner+':/app/backend/lab-adocao.ts');
for(const src of ['pr20-src','src']){
 let out;try{out=docker('exec','-e','LAB_SRC='+src,runner,'node','--import','tsx','lab-adocao.ts');}catch(e){out=String(e.stdout??'')+String(e.stderr??'');}
 console.log(`--- ${src}\n${out}`);
}

// 3) bytes físicos independentes (volume do Storage)
const listing=docker('exec',storage,'find','/var/lib/storage','-type','f','-exec','stat','-c','%s %n','{}',';').trim().split('\n').filter(Boolean);
writeFileSync(resolve(runtime,'adocao-physical-sizes.txt'),listing.join('\n')+'\n');
const physical={};
for(const line of listing){const m=/^(\d+) \/var\/lib\/storage\/[^/]+\/[^/]+\/videos-staging\/([0-9a-f-]{36})\/([^/]+)\/[^/]+$/.exec(line);if(m)(physical[m[2]]??={})[m[3]]=Number(m[1]);}
const summary={project,reviewedSha:reviewed,fixedSourceIntegrity:integrity,runs:{}};
for(const src of ['pr20-src','src']){
 const file=resolve(runtime,`adocao-${src}.json`);if(!existsSync(file)){summary.runs[src]={error:'sem resultado'};continue;}
 const data=JSON.parse(readFileSync(file));const rows=[];
 for(const r of data.results){const d=r.detail;if(d?.objects&&d.chargedBytes!==undefined){const id=d.objects[0]?.name.split('/')[0];const files=physical[id]??{};const total=Object.values(files).reduce((n,x)=>n+x,0);rows.push({scenario:r.name,mediaId:id,status:d.status,errorCode:d.errorCode,physicalFiles:files,physicalBytes:total,dbObjectBytes:d.dbPhysicalBytes,chargedBytes:d.chargedBytes,dbMatchesDisk:total===d.dbPhysicalBytes});}}
 summary.runs[src]={passes:data.results.filter(r=>r.status==='PASS').length,fails:data.results.filter(r=>r.status==='FAIL').length,accounting:rows,results:data.results.map(r=>({name:r.name,status:r.status,error:r.error}))};
}
writeFileSync(resolve(runtime,'adocao-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
