import {createClient} from '@supabase/supabase-js';import {writeFile,rename,mkdir} from 'node:fs/promises';import {dirname,resolve} from 'node:path';import {setTimeout as sleep} from 'node:timers/promises';
import {serviceFetch} from '../src/service-fetch.js';import {runSourcePreviewMaintenance} from '../src/source-preview-supabase.js';import {maintenanceRunner} from '../src/maintenance-runner.js';
import pg from 'pg';
const origin=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,file=process.env.MAINTENANCE_HEALTH_FILE;
if(!origin||!key||!file||!process.env.DATABASE_URL)throw new Error('Configuração privada do coletor ausente.');
const health=resolve(file),db=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:serviceFetch}}),controller=new AbortController();
process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
await mkdir(dirname(health),{recursive:true,mode:0o700});
const lock=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:5000});
lock.on('error',()=>controller.abort());
try{
 await lock.connect();const acquired=await lock.query('select pg_try_advisory_lock(762001140) as acquired');if(!acquired.rows[0].acquired)throw new Error('MAINTENANCE_ALREADY_RUNNING');
 await maintenanceRunner({now:Date.now,sweep:async signal=>{try{await lock.query('select 1');}catch{controller.abort();throw new Error('MAINTENANCE_LOCK_LOST');}if(controller.signal.aborted)throw new Error('MAINTENANCE_LOCK_LOST');return runSourcePreviewMaintenance(db,origin,signal);},sleep:(ms,signal)=>sleep(ms,undefined,{signal}),report:async status=>{const tmp=`${health}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(status),{mode:0o600});await rename(tmp,health);console.log(JSON.stringify(status));}},controller.signal);
}catch{console.error('Coletor encerrado sem confirmação de saúde; conferir supervisor/healthfile.');process.exitCode=1;}finally{await lock.end();}
