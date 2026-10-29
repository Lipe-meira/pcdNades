import {createRequire} from 'node:module';import {copyFile,mkdir,chmod} from 'node:fs/promises';
const require=createRequire(import.meta.url);const binary=require('@ffprobe-installer/ffprobe');
// npm ci --ignore-scripts: grant execution only to the selected runtime binary.
await chmod(binary.path,0o755);
await mkdir('vendor',{recursive:true});await copyFile(binary.path,'vendor/ffprobe'+(process.platform==='win32'?'.exe':''));await chmod('vendor/ffprobe'+(process.platform==='win32'?'.exe':''),0o755);
console.log('Packaged ffprobe for',process.platform,process.arch,binary.version);
