import {createRequire} from 'node:module';import {copyFile,mkdir,chmod} from 'node:fs/promises';
const require=createRequire(import.meta.url);const binary=require('@ffprobe-installer/ffprobe');
await mkdir('vendor',{recursive:true});await copyFile(binary.path,'vendor/ffprobe'+(process.platform==='win32'?'.exe':''));await chmod('vendor/ffprobe'+(process.platform==='win32'?'.exe':''),0o755);
console.log('Packaged ffprobe for',process.platform,process.arch,binary.version);
