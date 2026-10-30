-- LOCAL ONLY. Apply AFTER 004, with coordinator authorization and rollback smoke.
-- Created by `supabase migration new tiktok_import_sessions` (CLI 2.102.0).
begin;
create table public.import_sources(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 metadata jsonb,
 media_id uuid unique references public.media_assets(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes'
);
alter table public.import_sources enable row level security;
revoke all on public.import_sources from public,anon,authenticated;
grant select,insert,update,delete on public.import_sources to service_role;
-- Deliberately no anon/authenticated policies: API authorizes every operation.
create index import_sources_owner_created on public.import_sources(owner_id,created_at);
create index import_sources_created on public.import_sources(created_at);

create table private.import_slot(
 singleton boolean primary key default true check(singleton),
 holder uuid,locked_until timestamptz
);
insert into private.import_slot(singleton) values(true);
alter table private.import_slot enable row level security;
revoke all on private.import_slot from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,update on private.import_slot to service_role;

create function public.claim_import_slot(p_holder uuid,p_seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed boolean;
begin
 if p_holder is null or p_seconds not between 1 and 120 then raise exception 'INVALID_SLOT'; end if;
 update private.import_slot set holder=p_holder,locked_until=now()+make_interval(secs=>p_seconds)
 where singleton and (locked_until is null or locked_until<=now()) returning true into claimed;
 return coalesce(claimed,false);
end $$;
create function public.release_import_slot(p_holder uuid) returns void
language sql security invoker set search_path='' as $$
 update private.import_slot set holder=null,locked_until=null where singleton and holder=p_holder
$$;

create function public.reserve_import_source(p_owner uuid) returns public.import_sources
language plpgsql security invoker set search_path='' as $$
declare result public.import_sources;
begin
 perform pg_advisory_xact_lock(762001139);
 if (select count(*) from public.import_sources where owner_id=p_owner and created_at>now()-interval '1 hour')>=10
 or (select count(*) from public.import_sources where created_at>now()-interval '1 hour')>=50
 then raise exception 'IMPORT_RATE_LIMIT'; end if;
 insert into public.import_sources(owner_id) values(p_owner) returning * into result;
 return result;
end $$;

-- Selection stays immutable. Only TikTok imports get the independent 2h source cap.
alter table public.media_assets drop constraint media_assets_clip_check;
alter table public.media_assets add constraint media_assets_clip_check check(clip is null or coalesce(
 jsonb_typeof(clip)='object' and (clip-'startSeconds'-'endSeconds')='{}'::jsonb and
 jsonb_typeof(clip->'startSeconds')='number' and jsonb_typeof(clip->'endSeconds')='number' and
 (clip->>'startSeconds')::numeric>=0 and
 (clip->>'endSeconds')::numeric<=case when source_type='tiktok' then 7200 else 180 end and
 (clip->>'endSeconds')::numeric-(clip->>'startSeconds')::numeric between 0.1 and 90 and
 ((clip->>'startSeconds')::numeric*1000)=trunc((clip->>'startSeconds')::numeric*1000) and
 ((clip->>'endSeconds')::numeric*1000)=trunc((clip->>'endSeconds')::numeric*1000),false));
alter table public.media_assets add column import_source_id uuid references public.import_sources(id);
alter table public.media_assets add column import_snapshot jsonb;
alter table public.media_assets add constraint media_import_snapshot_pair check(
 (import_source_id is null and import_snapshot is null) or
 (source_type='tiktok' and import_source_id is not null and import_snapshot is not null and jsonb_typeof(import_snapshot)='object' and clip is not null));

create function public.create_tiktok_import(p_source_id uuid,p_owner uuid,p_clip jsonb) returns public.media_assets
language plpgsql security invoker set search_path='' as $$
declare source public.import_sources;result public.media_assets;new_id uuid;
begin
 select * into source from public.import_sources where id=p_source_id and owner_id=p_owner for update;
 if not found or source.metadata is null then raise exception 'SOURCE_NOT_FOUND'; end if;
 -- Idempotent retries remain valid after expiry; a new import does not.
 if source.media_id is not null then
  select * into result from public.media_assets where id=source.media_id;
  if result.clip is distinct from p_clip then raise exception 'IMPORT_SELECTION_CONFLICT'; end if;
  return result;
 end if;
 if source.expires_at<=now() then raise exception 'SOURCE_EXPIRED'; end if;
 if p_clip is null or jsonb_typeof(p_clip) is distinct from 'object' or (p_clip-'startSeconds'-'endSeconds')<>'{}'::jsonb
 or jsonb_typeof(p_clip->'startSeconds') is distinct from 'number' or jsonb_typeof(p_clip->'endSeconds') is distinct from 'number'
 then raise exception 'CLIP_OUT_OF_RANGE'; end if;
 if (p_clip->>'startSeconds')::numeric<0
 or (p_clip->>'endSeconds')::numeric>(source.metadata->>'durationSeconds')::numeric
 or (p_clip->>'endSeconds')::numeric-(p_clip->>'startSeconds')::numeric not between 0.1 and 90
 or (source.metadata->>'durationSeconds')::numeric not between 0.001 and 7200
 then raise exception 'CLIP_OUT_OF_RANGE'; end if;
 new_id=gen_random_uuid();
 insert into public.media_assets(id,owner_id,source_type,source_url,storage_key,clip,import_source_id,import_snapshot)
 values(new_id,p_owner,'tiktok',source.metadata->>'sourceUrl',new_id::text||'/pending.mp4',p_clip,source.id,source.metadata);
 update public.media_assets set status='queued' where id=new_id returning * into result;
 update public.import_sources set media_id=new_id where id=source.id;
 return result;
end $$;

create function private.immutable_import_source() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.import_source_id is distinct from old.import_source_id or new.import_snapshot is distinct from old.import_snapshot
 or (old.import_source_id is not null and (new.source_type is distinct from old.source_type or new.source_url is distinct from old.source_url or new.owner_id is distinct from old.owner_id))
 then raise exception 'Import source is immutable'; end if;
 return new;
end $$;
revoke all on function private.immutable_import_source() from public,anon,authenticated;
create trigger immutable_import_source before update on public.media_assets for each row execute function private.immutable_import_source();

revoke all on function public.claim_import_slot(uuid,integer),public.release_import_slot(uuid),public.reserve_import_source(uuid),public.create_tiktok_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_import_slot(uuid,integer),public.release_import_slot(uuid),public.reserve_import_source(uuid),public.create_tiktok_import(uuid,uuid,jsonb) to service_role;
commit;
