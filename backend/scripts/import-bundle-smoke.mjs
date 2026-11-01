// Local NFT trace only; no server import, secrets, deployment or remote services.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {access,stat,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
assert(process.argv[2],'Informe o diretório da instalação isolada de @vercel/nft.');
const require=createRequire(resolve(process.argv[2],'package.json'));
const {nodeFileTrace}=require('@vercel/nft');
const linux=process.platform==='linux';
assert.ok(linux||process.platform==='win32');assert.equal(process.arch,'x64');
const paths=linux
 ?['node_modules/@ffprobe-installer/linux-x64/ffprobe','node_modules/ffmpeg-static/ffmpeg','vendor/yt-dlp_linux']
 :['node_modules/@ffprobe-installer/win32-x64/ffprobe.exe','node_modules/ffmpeg-static/ffmpeg.exe','vendor/yt-dlp.exe'];
const hashes={linux:'58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a',win32:'66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a'};
const {fileList,warnings}=await nodeFileTrace(['dist/server.js'],{base:process.cwd(),mixedModules:true});
const files=new Set([...fileList].map(f=>f.replaceAll('\\','/')));
for(const path of paths){assert.ok(files.has(path),`Executável ausente do trace: ${path}`);await access(path,linux?constants.X_OK:constants.F_OK);}
assert.equal(createHash('sha256').update(await readFile(paths[2])).digest('hex'),hashes[process.platform]);
assert.ok(![...files].some(f=>/(^|\/)\.env(?:\.|$)/.test(f)),'Arquivo de ambiente incluído no bundle');
let bytes=0;for(const f of files){try{bytes+=(await stat(f)).size;}catch{}}
console.log(JSON.stringify({localOnly:true,platform:process.platform,executables:paths,ytDlpSha256:'PASS',envFiles:'ABSENT',tracedBytes:bytes,warnings:warnings.size,linuxRuntimeValidated:linux,vercelRuntimeValidated:false}));
