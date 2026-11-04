-- Manual installation template. Never run automatically in migrations.
-- Create the three named Vault secrets in the target environment first.
-- Verify the function uses verify_jwt=false and validates its own token.
-- Review extension availability, privileges and monitoring before execution.
-- Run as postgres, with one designated operator. Installation NEVER activates it.
-- All installers/maintenance must share this advisory lock; it does not constrain
-- privileged actors using cron.schedule directly. Do not lock cron.job itself.
do $$
declare missing text; installed_id bigint;
begin
 if current_user <> 'postgres' then
   raise exception 'Run with the designated postgres owner; do not change managed grants';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(762001141);
 select string_agg(required.name, ', ' order by required.name) into missing
 from (values ('preview_sweep_url'), ('preview_sweep_token'), ('preview_sweep_apikey')) as required(name)
 where (select count(*) from vault.decrypted_secrets s where s.name=required.name) <> 1
    or exists (select 1 from vault.decrypted_secrets s where s.name=required.name and nullif(s.decrypted_secret, '') is null);
 if missing is not null then raise exception 'Missing Vault secrets: %', missing; end if;
 if exists (select 1 from cron.job where jobname='pcdnades-preview-sweep'
            or jobname like 'pcdnades-preview-sweep-%'
            or command like '%preview_sweep_token%'
            or command like '%/functions/v1/preview-sweep%') then
   raise exception 'Job already exists; inspect it before installation';
 end if;
 installed_id := cron.schedule('pcdnades-preview-sweep', '*/3 * * * *', $job$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='preview_sweep_url'),
   headers := jsonb_build_object(
     'Content-Type', 'application/json',
     'apikey', (select decrypted_secret from vault.decrypted_secrets where name='preview_sweep_apikey'),
     'x-preview-sweep-token', (select decrypted_secret from vault.decrypted_secrets where name='preview_sweep_token')
   ),
   body := '{}'::jsonb,
   timeout_milliseconds := 65000
 );
$job$);
 perform cron.alter_job(installed_id, active := false);
 if not exists (select 1 from cron.job where jobid=installed_id
                and username=current_user and active=false and schedule='*/3 * * * *') then
   raise exception 'Inactive installation could not be confirmed';
 end if;
end $$;
