// Dedicated throwaway PostgreSQL container ONLY; never the retained Supabase stack.
import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';import assert from 'node:assert/strict';
const container=process.argv[2];assert.match(container??'',/^pcdnades-maint-lock-[a-z0-9-]+$/);
const run=promisify(execFile),query=async sql=>(await run('docker',['exec',container,'psql','-U','postgres','-At','-c',sql],{timeout:10000})).stdout.trim();
const first=spawn('docker',['exec','-i',container,'psql','-U','postgres','-At'],{stdio:['pipe','pipe','pipe']});first.stderr.resume();
const held=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('LOCK_WAIT_TIMEOUT')),10000);first.stdout.on('data',chunk=>{if(chunk.toString().includes('LOCK_HELD')){clearTimeout(timer);resolve();}});first.on('error',reject);});
first.stdin.end("select pg_advisory_lock(762001140);\n\\echo LOCK_HELD\nselect pg_sleep(30);\n");
await held;
assert.equal(await query('select pg_try_advisory_lock(762001140)'),'f');
await query("select pg_terminate_backend(pid) from pg_locks where locktype='advisory' and objid=762001140 and granted");
assert.equal(await query('select pg_try_advisory_lock(762001140)'),'t');
console.log(JSON.stringify({dedicatedPostgres:true,concurrentSecondDenied:true,recoveredAfterSessionCrash:true,retainedSupabaseTouched:false,result:'PASS'}));
