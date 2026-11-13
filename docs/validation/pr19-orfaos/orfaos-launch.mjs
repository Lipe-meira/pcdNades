// Orquestrador do host: roda orfaos.ts no runner do laboratório (já preparado e executado com docs/validation/pr19/launch.mjs),
// primeiro com o código do SHA aprovado do PR #19 e depois com a correção, e mede os bytes FÍSICOS de forma independente
// (find/stat no volume do Storage, sem passar por storage.objects). Só toca recursos do projeto do próprio laboratório.
//   node docs/validation/pr19-orfaos/orfaos-launch.mjs -r70
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const suffix=process.argv[2]??'';if(!/^-r[0-9]+$/.test(suffix))throw Error('Informe o sufixo do laboratório existente, ex.: -r70');
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..'),runtime=resolve(root,'docs/validation/pr19','runtime'+suffix);
const project='pcdn-pr19-352c-20261112'+suffix,runner=project+'-runner-1',storage=project+'-storage-1';
const PR19_SHA='352c0e177602fc1e6e79fe817960f92c76286f43';
const docker=(...a)=>execFileSync('docker',a,{encoding:'utf8',maxBuffer:64e6});
assert.ok(existsSync(resolve(runtime,'results.json')),'Execute antes docs/validation/pr19/launch.mjs neste laboratório (precisa de schema, usuários e synthetic.mp4).');
assert.ok(existsSync(resolve(runtime,'synthetic.dump')),'O fluxo documentado precisa ter concluído (backup/restauração sintéticos).');

// 1) código do PR #19 como baseline (somente leitura do Git) e integridade do código corrigido dentro da imagem
const baseDir=resolve(runtime,'pr19-baseline');if(!existsSync(baseDir)){mkdirSync(baseDir,{recursive:true});
 execFileSync('git',['archive','--format=tar','--output='+resolve(runtime,'pr19.tar'),PR19_SHA,'backend/src'],{cwd:root});
 execFileSync(resolve(process.env.SystemRoot??'C:\\Windows','System32','tar.exe'),['-xf',resolve(runtime,'pr19.tar'),'-C',baseDir]);}
docker('cp',resolve(baseDir,'backend/src'),runner+':/app/backend/pr19-src');
const integrity={};
for(const f of ['inline.ts','clip-storage.ts','signed-url-ttl.ts','storage-inventory.ts']){
 const host=createHash('sha256').update(readFileSync(resolve(root,'backend/src',f))).digest('hex');
 const inside=docker('exec',runner,'sha256sum','/app/backend/src/'+f).split(' ')[0];
 integrity[f]={match:host===inside,sha256:host};
}
assert.ok(Object.values(integrity).every(x=>x.match),'A imagem do runner não corresponde ao worktree (reconstrua a imagem): '+JSON.stringify(integrity));

// 2) execução
docker('cp',resolve(here,'orfaos.ts'),runner+':/app/backend/lab-orfaos.ts');
const outputs={};
for(const src of ['pr19-src','src']){
 try{outputs[src]=docker('exec','-e','LAB_SRC='+src,runner,'node','--import','tsx','lab-orfaos.ts');}catch(e){outputs[src]=String(e.stdout??'')+String(e.stderr??'');}
 console.log(`--- ${src}\n${outputs[src]}`);
}

// 3) bytes físicos independentes (volume do Storage)
const listing=docker('exec',storage,'find','/var/lib/storage','-type','f','-exec','stat','-c','%s %n','{}',';').trim().split('\n').filter(Boolean);
writeFileSync(resolve(runtime,'orfaos-physical-sizes.txt'),listing.join('\n')+'\n');
const physicalByKey={};
for(const line of listing){const m=/^(\d+) \/var\/lib\/storage\/[^/]+\/[^/]+\/videos-staging\/([0-9a-f-]{36})\/([^/]+)\/[^/]+$/.exec(line);if(m)(physicalByKey[m[2]]??={})[m[3]]=Number(m[1]);}
const summary={project,pr19Sha:PR19_SHA,fixedSourceIntegrity:integrity,runs:{}};
for(const src of ['pr19-src','src']){
 const file=resolve(runtime,`orfaos-${src}.json`);if(!existsSync(file)){summary.runs[src]={error:'sem resultado'};continue;}
 const data=JSON.parse(readFileSync(file));const rows=[];
 for(const r of data.results){const d=r.detail;if(d?.objects&&d.chargedBytes!==undefined){const id=d.objects[0]?.name.split('/')[0];const files=physicalByKey[id]??{};const physical=Object.values(files).reduce((n,x)=>n+x,0);rows.push({scenario:r.name,mediaId:id,physicalFiles:files,physicalBytes:physical,dbObjectBytes:d.dbPhysicalBytes,chargedBytes:d.chargedBytes,physicalMinusCharged:physical-d.chargedBytes,dbMatchesDisk:physical===d.dbPhysicalBytes});}}
 summary.runs[src]={passes:data.results.filter(r=>r.status==='PASS').length,fails:data.results.filter(r=>r.status==='FAIL').length,accounting:rows,results:data.results.map(r=>({name:r.name,status:r.status,error:r.error}))};
}
writeFileSync(resolve(runtime,'orfaos-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
