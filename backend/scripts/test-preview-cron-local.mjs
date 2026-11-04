// SQL-only regression. No HTTP, Auth, Storage, Edge, monitor or remote connection.
// Requires a NEW isolated container with pg_cron installed and scheduler disabled.
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const container=process.argv[2];
assert.match(container??'',/^pcdnades-cron-sql-review-/);
function run(args,input='') {return new Promise((resolve,reject)=>{
 const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';
 p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
 p.on('error',reject);p.on('close',code=>resolve({code,out,err}));p.stdin.end(input);
});}
const inspect=await run(['inspect',container]);assert.equal(inspect.code,0);
assert.equal(JSON.parse(inspect.out)[0].HostConfig.NetworkMode,'none');
const sql=(text,user='postgres')=>run(['exec','-i',container,'psql','-X','-U',user,'-d','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const ok=async(text,user)=>{const r=await sql(text,user);assert.equal(r.code,0,r.err);return r.out.trim();};
assert.equal(await ok('show cron.launch_active_jobs;'),'off');
assert.equal(await ok('select count(*) from cron.job;'),'0','Use a fresh test container');
// Vault is a SQL fixture, not a claim of testing managed secret encryption.
// This database is disposable, network-isolated and must contain no real secrets.
assert.equal(await ok('select count(*) from vault.secrets;','supabase_admin'),'0');
await ok(`drop extension supabase_vault;
 create schema if not exists vault;
 create table vault.decrypted_secrets(name text, decrypted_secret text);
 insert into vault.decrypted_secrets values
 ('preview_sweep_url','https://synthetic.invalid/functions/v1/preview-sweep'),
 ('preview_sweep_token','synthetic-only'),('preview_sweep_apikey','synthetic-only');
 grant usage on schema vault,cron to postgres;
 grant select on vault.decrypted_secrets,cron.job to postgres;
 grant execute on function cron.alter_job(bigint,text,text,text,text,boolean) to postgres;`,'supabase_admin');
const installer=await readFile(new URL('../supabase/ops/preview-cron.sql',import.meta.url),'utf8');
// Two real sessions contend on the same transaction advisory lock.
const results=await Promise.all([sql(installer),sql(installer)]);
assert.equal(results.filter(r=>r.code===0).length,1,results.map(r=>r.err).join('\n'));
assert.match(results.find(r=>r.code!==0).err,/Job already exists/);
assert.equal(await ok("select count(*) from cron.job where not active and schedule='*/3 * * * *';"),'1');
assert.equal(await ok('select count(*) from cron.job_run_details;'),'0');
const before=await ok('select md5(row_to_json(j)::text) from cron.job j;');
assert.notEqual((await sql(installer)).code,0);
assert.equal(await ok('select md5(row_to_json(j)::text) from cron.job j;'),before);
// Roll back the only newly created job; do not execute its command.
await ok("select cron.unschedule('pcdnades-preview-sweep');");
await ok("select cron.schedule('pcdnades-preview-sweep-lab','*/3 * * * *','select 1'); select cron.alter_job(jobid,active:=false) from cron.job;");
assert.match((await sql(installer)).err,/Job already exists/);
await ok("select cron.unschedule('pcdnades-preview-sweep-lab');");
await ok("delete from vault.decrypted_secrets where name='preview_sweep_token';",'supabase_admin');
assert.match((await sql(installer)).err,/Missing Vault secrets/);
assert.equal(await ok('select count(*) from cron.job;'),'0');
assert.equal(await ok('select count(*) from cron.job_run_details;'),'0');
console.log('PASS: concurrent install, inactive creation, repeat/alias refusal, missing secret, zero executions. SQL-only local pg_cron.');
