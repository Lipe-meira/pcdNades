begin;
create table private.preview_sweep_lease (
 singleton boolean primary key default true check (singleton),
 holder uuid,
 locked_until timestamptz,
 check ((holder is null) = (locked_until is null))
);
insert into private.preview_sweep_lease(singleton) values (true);
revoke all on private.preview_sweep_lease from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, update on private.preview_sweep_lease to service_role;

create function public.claim_preview_sweep(p_holder uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare ok boolean;
begin
 if p_holder is null then return false; end if;
 update private.preview_sweep_lease set holder = p_holder, locked_until = clock_timestamp() + interval '2 minutes'
 where singleton and (holder is null or locked_until <= clock_timestamp()) returning true into ok;
 return coalesce(ok, false);
end $$;

create function public.finish_preview_sweep(p_holder uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare ok boolean;
begin
 update private.preview_sweep_lease set holder = null, locked_until = null
 where singleton and holder = p_holder and locked_until > clock_timestamp() returning true into ok;
 if not coalesce(ok, false) then return false; end if;
 update public.import_preview_maintenance set swept_at = clock_timestamp() where singleton;
 if not found then raise exception 'PREVIEW_HEARTBEAT_MISSING'; end if;
 return true;
end $$;

create function public.release_preview_sweep(p_holder uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare ok boolean;
begin
 update private.preview_sweep_lease set holder = null, locked_until = null
 where singleton and holder = p_holder returning true into ok;
 return coalesce(ok, false);
end $$;
revoke all on function public.claim_preview_sweep(uuid), public.finish_preview_sweep(uuid), public.release_preview_sweep(uuid) from public, anon, authenticated;
grant execute on function public.claim_preview_sweep(uuid), public.finish_preview_sweep(uuid), public.release_preview_sweep(uuid) to service_role;
revoke execute on function public.mark_source_preview_sweep() from service_role;
commit;
