import {createRequire} from 'node:module';import {readFile,writeFile,chmod} from 'node:fs/promises';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
const require=createRequire(import.meta.url);const key=`${process.platform}-${process.arch}`;
const hashes={'linux-x64':'e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99','win32-x64':'04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00'};
if(!hashes[key])throw new Error('Unsupported FFmpeg platform');
const path=require.resolve('ffmpeg-static/package.json').replace(/package\.json$/,process.platform==='win32'?'ffmpeg.exe':'ffmpeg');
let bytes;try{bytes=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;const response=await fetch(`https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-${key}.gz`,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('FFmpeg build download failed');bytes=gunzipSync(Buffer.from(await response.arrayBuffer()));}
if(createHash('sha256').update(bytes).digest('hex')!==hashes[key])throw new Error('FFmpeg SHA256 mismatch');
await writeFile(path,bytes);await chmod(path,0o755);console.log('Verified FFmpeg b6.1.1',key,bytes.length,'bytes');
