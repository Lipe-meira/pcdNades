import type {FastifyInstance} from 'fastify';
import {timingSafeEqual,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile,mkdtemp,rm,statfs} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {ytDlpPath} from './import-runtime.js';import {ffmpegBinaryPath} from './trimming.js';import {probeBinaryPath} from './probe.js';

const run=promisify(execFile);
export async function nativeImportPreflight(){
 if(process.platform!=='linux'||process.arch!=='x64')throw Object.assign(new Error('Unsupported preflight'),{code:'PREFLIGHT_UNSUPPORTED'});
 const started=performance.now(),cpu=process.cpuUsage(),signal=AbortSignal.timeout(45000),directory=await mkdtemp(join(tmpdir(),'pcdnades-preflight-'));
 try{
  const space=await statfs(directory);let mountOptions:string[]|null=null;
  try{const mounts=(await readFile('/proc/mounts','utf8')).split('\n').map(line=>line.split(' ')).filter(row=>row[1]&&(directory===row[1]||directory.startsWith(row[1].replace(/\/$/,'')+'/'))).sort((a,b)=>b[1].length-a[1].length);mountOptions=mounts[0]?.[3]?.split(',').filter(v=>['rw','ro','noexec','nosuid','nodev'].includes(v))??null;}catch{}
  const env={PATH:process.env.PATH,TMPDIR:directory,TEMP:directory,TMP:directory,YTDLP_NO_PLUGINS:'1'};
  const binaries=[
   {name:'yt-dlp',path:ytDlpPath(),hash:'58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a',args:['--version']},
   {name:'ffmpeg',path:ffmpegBinaryPath(),hash:'e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99',args:['-version']},
   {name:'ffprobe',path:probeBinaryPath(),hash:'576c21674291ec1948d507ea8ab0d78eb6621a0be8c6f1a6db0f50c5fcb1e0f9',args:['-version']},
  ];
  const versions=[];
  for(const binary of binaries){
   if(createHash('sha256').update(await readFile(binary.path)).digest('hex')!==binary.hash)throw Object.assign(new Error('Binary integrity'),{code:'PREFLIGHT_INTEGRITY'});
   const result=await run(binary.path,binary.args,{cwd:directory,env,signal,timeout:10000,killSignal:'SIGKILL',maxBuffer:65536});
   versions.push({name:binary.name,version:result.stdout.split('\n')[0].slice(0,180),integrity:'PASS'});
  }
  const output=join(directory,'test.mp4');
  await run(ffmpegBinaryPath(),['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=64x64:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','0.2','-threads','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',output],{cwd:directory,env,signal,timeout:10000,killSignal:'SIGKILL',maxBuffer:65536});
  await run(ffmpegBinaryPath(),['-nostdin','-v','error','-xerror','-i',output,'-f','null','-'],{cwd:directory,env,signal,timeout:10000,killSignal:'SIGKILL',maxBuffer:65536});
  const usage=process.cpuUsage(cpu);
  return {status:'pass',node:process.version,platform:process.platform,arch:process.arch,uid:process.getuid?.(),mountOptions,tmpAvailableBytes:space.bavail*space.bsize,versions,encodeDecode:'PASS',elapsedMs:Math.round(performance.now()-started),nodeCpuMicroseconds:usage.user+usage.system,nodeRssBytes:process.memoryUsage().rss};
 }finally{await rm(directory,{recursive:true,force:true});}
}

// No diagnostic route exists in production/default configuration. The dedicated
// preview secret never authorizes application data access or arbitrary commands.
export function registerImportPreflight(app:FastifyInstance,env:Record<string,string|undefined>=process.env,probe=nativeImportPreflight){
 if(env.VERCEL_ENV!=='preview'||env.PCDNADES_PREFLIGHT_ENABLED!=='true'||!/^\w{64}$/.test(env.PCDNADES_PREFLIGHT_TOKEN??''))return;
 const token=Buffer.from(env.PCDNADES_PREFLIGHT_TOKEN!);let busy=false;
 app.post('/api/internal/import-preflight',async(req,reply)=>{
  const supplied=req.headers['x-pcdnades-preflight-token'];
  if(typeof supplied!=='string'||Buffer.byteLength(supplied)!==token.length||!timingSafeEqual(Buffer.from(supplied),token))return reply.code(401).send({error:{code:'UNAUTHORIZED'}});
  if(req.body&&(!(typeof req.body==='object')||Array.isArray(req.body)||Object.keys(req.body).length))return reply.code(400).send({error:{code:'PREFLIGHT_INPUT_FORBIDDEN'}});
  if(busy)return reply.code(409).send({error:{code:'PROCESSOR_BUSY'}});busy=true;
  try{return {data:await probe()};}
  catch(error){const e=error as {code?:unknown;stderr?:string;killed?:boolean};const blocked=/failed to map segment|permission denied|operation not permitted/i.test(e.stderr??'');return reply.code(422).send({data:{status:'failed',code:blocked?'RUNTIME_EXECUTION_BLOCKED':e.killed||e.code==='ABORT_ERR'?'PREFLIGHT_TIMEOUT':['PREFLIGHT_INTEGRITY','PREFLIGHT_UNSUPPORTED'].includes(String(e.code))?e.code:'PREFLIGHT_FAILED'}});}
  finally{busy=false;}
 });
}
