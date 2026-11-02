begin;
-- Dedicated bucket; an existing differently configured bucket is an error.
do $$ begin
 if exists(select 1 from storage.buckets where id='import-previews' and (public or file_size_limit is distinct from 50000000 or allowed_mime_types is distinct from array['video/mp4']::text[])) then raise exception 'PREVIEW_BUCKET_CONFIGURATION_MISMATCH'; end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('import-previews','import-previews',false,50000000,array['video/mp4']) on conflict(id) do nothing;
create table public.import_preview_jobs(
 source_id uuid primary key references public.import_sources(id),
 owner_id uuid not null references auth.users(id),
 object_key text not null unique check(object_key=source_id::text||'.mp4'),
 expires_at timestamptz not null,
 state text not null check(state in ('reserved','ready','deleting')),
 holder uuid, locked_until timestamptz,
 created_at timestamptz not null default now(),
 check((state='deleting' and holder is not null and locked_until is not null) or (state<>'deleting' and holder is null and locked_until is null))
);
alter table public.import_preview_jobs enable row level security;
revoke all on public.import_preview_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.import_preview_jobs to service_role;
create index import_preview_expiry on public.import_preview_jobs(expires_at);
-- Heartbeat is set only after a successful complete sweep via the Storage API.
create table public.import_preview_maintenance(singleton boolean primary key default true check(singleton), swept_at timestamptz);
insert into public.import_preview_maintenance(singleton) values(true);
alter table public.import_preview_maintenance enable row level security;
revoke all on public.import_preview_maintenance from public,anon,authenticated;
grant select,update on public.import_preview_maintenance to service_role;
create function public.reserve_source_preview(p_source uuid,p_owner uuid) returns public.import_preview_jobs
language plpgsql security invoker set search_path='' as $$
declare session public.import_sources; result public.import_preview_jobs;
begin
 select * into session from public.import_sources where id=p_source and owner_id=p_owner for update;
 if not found or session.expires_at<=now()+interval '5 seconds' or session.expires_at>now()+interval '15 minutes' then raise exception 'PREVIEW_UNAVAILABLE'; end if;
 insert into public.import_preview_jobs(source_id,owner_id,object_key,expires_at,state)
 values(p_source,p_owner,p_source::text||'.mp4',session.expires_at,'reserved') returning * into result;
 return result;
end $$;
create function public.finish_source_preview(p_source uuid,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare updated boolean;
begin
 update public.import_preview_jobs set state='ready' where source_id=p_source and owner_id=p_owner and state='reserved' and expires_at>now()+interval '5 seconds' returning true into updated;
 return coalesce(updated,false);
end $$;
create function public.claim_source_preview_cleanup(p_holder uuid) returns public.import_preview_jobs
language plpgsql security invoker set search_path='' as $$
declare result public.import_preview_jobs;
begin
 if p_holder is null then raise exception 'PREVIEW_UNAVAILABLE'; end if;
 update public.import_preview_jobs set state='deleting',holder=p_holder,locked_until=now()+interval '2 minutes'
 where source_id=(select source_id from public.import_preview_jobs where expires_at<=now()-interval '2 minutes' and (state in ('reserved','ready') or (state='deleting' and locked_until<=now())) order by expires_at for update skip locked limit 1)
 returning * into result;
 return result;
end $$;
create function public.finish_source_preview_cleanup(p_source uuid,p_holder uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare deleted boolean;
begin
 delete from public.import_preview_jobs where source_id=p_source and state='deleting' and holder=p_holder and locked_until>now() returning true into deleted;
 return coalesce(deleted,false);
end $$;
create function public.mark_source_preview_sweep() returns void
language sql security invoker set search_path='' as $$
 update public.import_preview_maintenance set swept_at=now() where singleton;
$$;
revoke all on function public.mark_source_preview_sweep() from public,anon,authenticated;
grant execute on function public.mark_source_preview_sweep() to service_role;
revoke all on function public.reserve_source_preview(uuid,uuid),public.finish_source_preview(uuid,uuid),public.claim_source_preview_cleanup(uuid),public.finish_source_preview_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_source_preview(uuid,uuid),public.finish_source_preview(uuid,uuid),public.claim_source_preview_cleanup(uuid),public.finish_source_preview_cleanup(uuid,uuid) to service_role;
commit;
