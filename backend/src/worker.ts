import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const storage=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}}).storage.from('videos-staging');
async function processOne(){
 const {rows}=await pool.query(`with candidate as (select id from public.media_assets where status='queued' or (status='processing' and locked_until<now() and attempts<3) order by created_at for update skip locked limit 1) update public.media_assets m set status='processing',stage='validating',attempts=attempts+1,locked_until=now()+interval '15 minutes',updated_at=now() from candidate c where m.id=c.id returning m.*`);
 const asset=rows[0];if(!asset)return false;
 const dir=await mkdtemp(join(tmpdir(),'pcdnades-'));
 try{
 const download=await storage.download(asset.storage_key);if(download.error)throw new Error('STORAGE_UNAVAILABLE');if(download.data.size>50000000)throw new Error('FILE_TOO_LARGE');
 const input=join(dir,'input.mp4'),output=join(dir,'playback.mp4');await writeFile(input,Buffer.from(await download.data.arrayBuffer()));
 const probe=await run('ffprobe',['-v','error','-protocol_whitelist','file','-show_format','-show_streams','-of','json',input],{timeout:30000,maxBuffer:1024*1024});
 const info=JSON.parse(probe.stdout),video=info.streams.find((s:any)=>s.codec_type==='video');const duration=Number(info.format.duration);
 if(!video||!info.format.format_name?.includes('mp4')||!Number.isFinite(duration)||duration<=0||duration>180||video.width>1920||video.height>1920)throw new Error('INVALID_MEDIA');
 await pool.query("update public.media_assets set stage='transcoding' where id=$1",[asset.id]);
 await run('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file','-i',input,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-t','180','-fs','50000000',output],{timeout:600000,maxBuffer:1024*1024});
 const bytes=await readFile(output);const key=`${asset.id}/playback.mp4`;const result=await storage.upload(key,bytes,{contentType:'video/mp4',upsert:true});if(result.error)throw new Error('STORAGE_UNAVAILABLE');
 await pool.query("update public.media_assets set status='ready',stage=null,error=null,storage_key=$2,metadata=$3,locked_until=null,updated_at=now() where id=$1",[asset.id,key,JSON.stringify({bytes:bytes.length,durationSeconds:duration,width:video.width,height:video.height,mimeType:'video/mp4'})]);
 await storage.remove([asset.storage_key]);
 }catch(error){await pool.query("update public.media_assets set status='failed',stage=null,error=$2,locked_until=null,updated_at=now() where id=$1",[asset.id,JSON.stringify({code:'PROCESSING_FAILED',message:'Não foi possível processar o vídeo. Envie outro MP4.'})]);console.error('Media processing failed',asset.id,error instanceof Error?error.message:'unknown');}
 finally{await rm(dir,{recursive:true,force:true});}
 return true;
}
try{while(await processOne()){ /* Run queue until empty; scheduler invokes again. */ }}finally{await pool.end();}
