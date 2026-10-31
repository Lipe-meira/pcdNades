// Local Linux build only. Run in a clean export, with no cloud credentials.
// node audit-vercel-artifact.mjs BACKEND_DIR TOOLS_DIR NEW_OUTPUT_DIR
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createWriteStream} from 'node:fs';
import {mkdir,writeFile,readFile,stat,chmod} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

assert.equal(process.platform,'linux');
assert.equal(process.arch,'x64');
assert.equal(process.versions.node.split('.')[0],'24');
assert.ok(!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VERCEL_TOKEN,'Use an isolated container without service credentials');
const [backendArg,toolsArg,outArg]=process.argv.slice(2);
assert.ok(backendArg&&toolsArg&&outArg,'BACKEND_DIR TOOLS_DIR NEW_OUTPUT_DIR required');
const work=resolve(backendArg),tools=resolve(toolsArg),out=resolve(outArg);
assert.notEqual(work,out);await mkdir(out,{recursive:false});
const require=createRequire(join(tools,'package.json'));
const {build}=require('@vercel/fastify'),{glob}=require('@vercel/build-utils');
const config=JSON.parse(await readFile(join(work,'vercel.json'),'utf8'));
const pkg=JSON.parse(await readFile(join(work,'package.json'),'utf8'));
assert.equal(pkg.engines.node,'24.x');
assert.equal(config.functions,undefined,'Fastify entrypoint duration comes from exported config; avoid /api function globs');
assert.equal(config.installCommand,'npm ci --ignore-scripts');
assert.equal(config.buildCommand,'npm run build');
process.env.MEDIA_TIKTOK_IMPORT_ENABLED='true';
process.env.MEDIA_TIKTOK_DOWNLOAD_MODE='temporary';
process.env.VERCEL_BUILDER_DEBUG='1';
const warnings=[],originalLog=console.log;
console.log=(...args)=>{
 if(String(args[0]).startsWith('Warning from trace:'))warnings.push(String(args[0]));
 originalLog(...args);
};
try{
 const files=await glob('**/*',{cwd:work,dot:true,ignore:['node_modules/**','vendor/**','dist/**','.env*']});
 // Dependencies must already be installed with the declared install command.
 // No vercel link/pull, remote settings, credentials or deployment APIs.
 const result=await build({files,entrypoint:'package.json',workPath:work,
  config:{...config,zeroConfig:true,projectSettings:{nodeVersion:'24.x',installCommand:'',buildCommand:config.buildCommand}},
  meta:{skipDownload:true,isDev:false}});
 const lambda=result.output;
 assert.equal(lambda.type,'Lambda');assert.equal(lambda.runtime,'nodejs24.x');assert.equal(lambda.maxDuration,120);
 const artifact=join(out,'index.func');await mkdir(artifact);
 const manifest=[];
 for(const [name,file]of Object.entries(lambda.files)){
  assert.ok(!name.split('/').includes('..'));
  assert.ok(!/(^|\/)(\.env(?:$|\.)|local-integration-|pilot-|capacity-|audit-preview-)|\.(mp4|private\.json|exe)$/.test(name),`Unexpected artifact path: ${name}`);
  assert.notEqual(file.mode&0o170000,0o120000,'Review symlinks before materializing an artifact');
  const target=join(artifact,name);await mkdir(dirname(target),{recursive:true});
  await pipeline(await file.toStreamAsync(),createWriteStream(target));
  if(file.mode)await chmod(target,file.mode&0o777);
  manifest.push({name,bytes:(await stat(target)).size,mode:(await stat(target)).mode&0o777});
 }
 const binary=[];
 for(const name of ['node_modules/ffmpeg-static/ffmpeg','node_modules/@ffprobe-installer/linux-x64/ffprobe','vendor/yt-dlp_linux']){
  const file=manifest.find(f=>f.name===name);assert.ok(file,`Missing binary: ${name}`);assert.ok(file.mode&0o111);
  binary.push({...file,sha256:createHash('sha256').update(await readFile(join(artifact,name))).digest('hex')});
 }
 const zip=await lambda.createZip();await writeFile(join(out,'lambda.zip'),zip);
 const runtime={runtime:lambda.runtime,handler:lambda.handler,launcherType:lambda.launcherType,maxDuration:lambda.maxDuration,framework:lambda.framework};
 await writeFile(join(artifact,'.vc-config.json'),JSON.stringify(runtime,null,2));
 const report={...runtime,node:process.version,builder:require('@vercel/fastify/package.json').version,
  nodeBuilder:require('@vercel/node/package.json').version,files:manifest.length,
  uncompressedBytes:manifest.reduce((n,f)=>n+f.bytes,0),zipBytes:zip.length,binary,traceWarnings:warnings.length,remoteValidated:false};
 assert.ok(report.uncompressedBytes<250000000,'Local payload exceeds the conservative 250MB ceiling');
 await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 await writeFile(join(out,'warnings.json'),JSON.stringify(warnings,null,2));
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 originalLog(JSON.stringify(report));
}finally{console.log=originalLog;}
