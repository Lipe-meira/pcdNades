// Optional artifact: never downloaded or executed unless explicitly enabled for this build.
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const version='2026.08.19';
const files={linux:['yt-dlp_linux','58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a'],win32:['yt-dlp.exe','66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a']};
if(process.env.MEDIA_TIKTOK_IMPORT_ENABLED==='true'){
 if(process.arch!=='x64'||!files[process.platform])throw new Error('UNSUPPORTED_YTDLP_PLATFORM');
 const [name,digest]=files[process.platform];const path=new URL(`../vendor/${name}`,import.meta.url);
 const valid=b=>createHash('sha256').update(b).digest('hex')===digest;
 await mkdir(new URL('../vendor/',import.meta.url),{recursive:true});
 let bytes;try{bytes=await readFile(path);}catch{}
 if(!bytes||!valid(bytes)){
  const response=await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${name}`,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('YTDLP_DOWNLOAD_FAILED');
  bytes=Buffer.from(await response.arrayBuffer());if(!valid(bytes))throw new Error('YTDLP_CHECKSUM_MISMATCH');
  await writeFile(path,bytes);
 }
 await chmod(path,0o755);console.log(`yt-dlp ${version}: ${name}, SHA256 verificado, ${bytes.length} bytes.`);
}else console.log('yt-dlp não incluído: importador TikTok desativado neste build.');
