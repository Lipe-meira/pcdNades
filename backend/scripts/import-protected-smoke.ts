// Explicit local diagnostic. Does not enable capabilities, access Supabase or persist video.
// Run only against a user-authorized TikTok URL; stop on platform/network denial.
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {extractTikTok,importSection} from '../src/import-runtime.js';
const sourceUrl=process.argv[2];if(!sourceUrl)throw new Error('Informe uma URL TikTok explicitamente autorizada para este teste.');
const dir=await mkdtemp(join(tmpdir(),'pcdnades-protected-')),controller=new AbortController();const timer=setTimeout(()=>controller.abort(),110000);timer.unref();
try{
 const resolved=await extractTikTok(sourceUrl,controller,dir);
 console.log(JSON.stringify({phase:'inspection',...resolved.metadata,metadataBytes:resolved.metadataBytes}));
 const result=await importSection(resolved.metadata,{startSeconds:0,endSeconds:Math.min(10,resolved.metadata.durationSeconds)},join(dir,'clip.mp4'),dir,{maxBytes:50000000,maxDurationSeconds:90},controller,async stage=>{console.log(JSON.stringify({stage}));});
 console.log(JSON.stringify({phase:'final-validation',result,localOnly:true,supabaseStorageValidated:false,vercelValidated:false}));
}catch(error){console.log(JSON.stringify({phase:'stopped',code:error instanceof Error&&'code'in error?error.code:'IMPORT_FAILED',localOnly:true}));process.exitCode=1;}
finally{clearTimeout(timer);await rm(dir,{recursive:true,force:true});}
