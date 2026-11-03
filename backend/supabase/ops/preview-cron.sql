-- Manual installation template. Never run automatically in migrations.
-- Create the three named Vault secrets in the target environment first.
-- Verify the function uses verify_jwt=false and validates its own token.
-- Review extension availability, privileges and monitoring before execution.
do $$
declare missing text;
begin
 select string_agg(required.name, ', ' order by required.name) into missing
 from (values ('preview_sweep_url'), ('preview_sweep_token'), ('preview_sweep_apikey')) as required(name)
 where not exists (select 1 from vault.decrypted_secrets s where s.name=required.name and s.decrypted_secret is not null);
 if missing is not null then raise exception 'Missing Vault secrets: %', missing; end if;
 if exists (select 1 from cron.job where jobname='pcdnades-preview-sweep') then
   raise exception 'Job already exists; inspect it before installation';
 end if;
end $$;
select cron.schedule('pcdnades-preview-sweep', '*/3 * * * *', $job$
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
