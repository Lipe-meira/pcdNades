import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const suffix=process.argv[2]??'';if(!/^(?:-r[0-9]+)?$/.test(suffix))throw Error('Invalid suffix');
const here=dirname(fileURLToPath(import.meta.url)),runtime=resolve(here,'runtime'+suffix),project='pcdn-pr19-352c-20261112'+suffix;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8e6});
const configPath=resolve(runtime,'compose.json');
if(existsSync(resolve(runtime,'expiry-reconfigure.ready')))throw Error('Expiry probe already started: inspect saved state');
const initial=JSON.parse(readFileSync(configPath));initial.services.auth.environment.GOTRUE_RATE_LIMIT_ANONYMOUS_USERS='1000';initial.services.auth.environment.GOTRUE_JWT_EXP='30';initial.services.auth.environment.GOTRUE_RATE_LIMIT_HEADER='X-Forwarded-For';writeFileSync(configPath,JSON.stringify(initial,null,2));
docker('cp',resolve(here,'gateway.mjs'),project+'-gateway-1:/lab/gateway.mjs');docker('compose','-f',configPath,'restart','gateway');docker('compose','-f',configPath,'up','-d','auth');await new Promise(r=>setTimeout(r,1500));
docker('cp',resolve(here,'expiry.ts'),project+'-runner-1:/app/backend/lab-expiry.ts');
const child=spawn('docker',['exec',project+'-runner-1','node','--import','tsx','lab-expiry.ts']),log=createWriteStream(resolve(runtime,'expiry.log'));child.stdout.pipe(log);child.stderr.pipe(log);let finished=false,exitCode;child.on('exit',c=>{finished=true;exitCode=c;});
while(!existsSync(resolve(runtime,'expiry-reconfigure.ready'))){if(finished)throw Error('Expiry probe exited before reconfiguration');await new Promise(r=>setTimeout(r,300));}
const config=JSON.parse(readFileSync(configPath));config.services.auth.environment.GOTRUE_RATE_LIMIT_ANONYMOUS_USERS='2';writeFileSync(configPath,JSON.stringify(config,null,2));
docker('compose','-f',configPath,'up','-d','auth');
writeFileSync(resolve(runtime,'expiry-reconfigure.done'),'Auth rate limit 2; Storage unchanged');
while(!finished)await new Promise(r=>setTimeout(r,500));
process.exitCode=exitCode??1;console.log('Expiry probe exit',exitCode);
