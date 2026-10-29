-- Run only in the dedicated pcdNades project as an administrative connection.
-- Every fixture is transaction-local and rolled back, including auth users.
begin;
select set_config('pcdnades.admin',gen_random_uuid()::text,true);
select set_config('pcdnades.viewer',gen_random_uuid()::text,true);
select set_config('pcdnades.media',gen_random_uuid()::text,true);
select set_config('pcdnades.grenade',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('pcdnades.admin')::uuid,'pcdnades-admin-fixture@example.invalid'),
 (current_setting('pcdnades.viewer')::uuid,'pcdnades-viewer-fixture@example.invalid');
insert into private.administrators values(current_setting('pcdnades.admin')::uuid);
insert into public.media_assets(id,owner_id,source_type,storage_key)
values(current_setting('pcdnades.media')::uuid,current_setting('pcdnades.admin')::uuid,'upload','verification/rollback-only.mp4');
-- Exercise the real trigger's lifecycle; no Storage file is claimed to exist.
update public.media_assets set status='queued' where id=current_setting('pcdnades.media')::uuid;
update public.media_assets set status='processing',locked_until=now()+interval '15 minutes' where id=current_setting('pcdnades.media')::uuid;
update public.media_assets set status='ready',locked_until=null,
metadata='{"bytes":123,"durationSeconds":5,"mimeType":"video/mp4"}' where id=current_setting('pcdnades.media')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pcdnades.admin'),true);
do $$ begin
 if not public.is_admin() then raise exception 'Admin RPC failed'; end if;
 if (select count(*) from public.media_assets)<>1 then raise exception 'Admin media visibility failed'; end if;
end $$;
insert into public.grenades(id,title,map_id,type,side,instructions,target,video_id)
values(current_setting('pcdnades.grenade')::uuid,'Rollback fixture','mirage','smoke','T','Verification only','{"x":0,"y":1}',current_setting('pcdnades.media')::uuid);
update public.grenades set title='Updated fixture' where id=current_setting('pcdnades.grenade')::uuid;
do $$ begin
 if not exists(select 1 from public.grenades where id=current_setting('pcdnades.grenade')::uuid and title='Updated fixture') then raise exception 'Admin CRUD failed'; end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('pcdnades.viewer'),true);
do $$ begin
 if public.is_admin() then raise exception 'Viewer acquired admin'; end if;
 if exists(select 1 from public.media_assets) then raise exception 'Viewer accessed media'; end if;
 update public.grenades set title='Forbidden' where id=current_setting('pcdnades.grenade')::uuid;
 if found then raise exception 'Viewer updated grenade'; end if;
 delete from public.grenades where id=current_setting('pcdnades.grenade')::uuid;
 if found then raise exception 'Viewer deleted grenade'; end if;
 begin
  insert into public.grenades(title,map_id,type,side,instructions,target,video_id)
  values('Forbidden','mirage','smoke','T','Forbidden','{"x":0.5,"y":0.5}',current_setting('pcdnades.media')::uuid);
  raise exception 'Viewer inserted grenade';
 exception
  when insufficient_privilege then null;
  when raise_exception then
   -- BEFORE trigger cannot see ready media under viewer RLS and rejects first.
   if sqlerrm<>'Video must be ready' then raise; end if;
 end;
 begin
  perform 1 from private.administrators;
  raise exception 'Viewer read administrators';
 exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if (select count(*) from public.maps)<>3 then raise exception 'Public map catalog failed'; end if;
 if not exists(select 1 from public.grenades where id=current_setting('pcdnades.grenade')::uuid) then raise exception 'Public grenade read failed'; end if;
 begin
  perform 1 from public.media_assets;
  raise exception 'Anon read media';
 exception when insufficient_privilege then null; end;
 begin
  perform public.is_admin();
  raise exception 'Anon invoked admin RPC';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Admin delete and published-video terminal state protection.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pcdnades.admin'),true);
delete from public.grenades where id=current_setting('pcdnades.grenade')::uuid;
reset role;
do $$ begin
 begin
  update public.media_assets set status='queued' where id=current_setting('pcdnades.media')::uuid;
  raise exception 'Terminal media state reactivated';
 exception when raise_exception then
  if sqlerrm<>'Invalid media state transition' then raise; end if;
 end;
end $$;
select 'PASS: public reads, viewer denied writes/private data, admin CRUD, media lifecycle' as verification;
rollback;
