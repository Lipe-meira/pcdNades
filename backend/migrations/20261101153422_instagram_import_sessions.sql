-- Additive, local testing first. Never modify existing TikTok rows or objects.
begin;
alter table public.media_assets drop constraint media_assets_clip_check;
alter table public.media_assets add constraint media_assets_clip_check check(clip is null or coalesce(
 jsonb_typeof(clip)='object' and (clip-'startSeconds'-'endSeconds')='{}'::jsonb and
 jsonb_typeof(clip->'startSeconds')='number' and jsonb_typeof(clip->'endSeconds')='number' and
 (clip->>'startSeconds')::numeric>=0 and
 (clip->>'endSeconds')::numeric<=case when source_type in ('tiktok','instagram') then 7200 else 180 end and
 (clip->>'endSeconds')::numeric-(clip->>'startSeconds')::numeric between 0.1 and 90 and
 ((clip->>'startSeconds')::numeric*1000)=trunc((clip->>'startSeconds')::numeric*1000) and
 ((clip->>'endSeconds')::numeric*1000)=trunc((clip->>'endSeconds')::numeric*1000),false));
alter table public.media_assets drop constraint media_import_snapshot_pair;
alter table public.media_assets add constraint media_import_snapshot_pair check(
 (import_source_id is null and import_snapshot is null) or
 (source_type in ('tiktok','instagram') and import_source_id is not null and import_snapshot is not null and jsonb_typeof(import_snapshot)='object' and clip is not null));
create function public.create_instagram_import(p_source_id uuid,p_owner uuid,p_clip jsonb) returns public.media_assets
language plpgsql security invoker set search_path='' as $$
declare source public.import_sources;result public.media_assets;new_id uuid;
begin
 select * into source from public.import_sources where id=p_source_id and owner_id=p_owner for update;
 if not found or source.metadata is null or source.metadata->>'provider' is distinct from 'instagram' then raise exception 'SOURCE_NOT_FOUND'; end if;
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
 values(new_id,p_owner,'instagram',source.metadata->>'sourceUrl',new_id::text||'/pending.mp4',p_clip,source.id,source.metadata);
 update public.media_assets set status='queued' where id=new_id returning * into result;
 update public.import_sources set media_id=new_id where id=source.id;
 return result;
end $$;

revoke all on function public.create_instagram_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_instagram_import(uuid,uuid,jsonb) to service_role;
commit;
