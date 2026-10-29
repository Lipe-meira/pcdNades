-- NOT APPLIED. Apply after 001/002 in coordinated maintenance.
-- No existing rows/objects changed; widen source type and final duration only.
begin;
alter table public.media_assets drop constraint media_assets_source_type_check;
alter table public.media_assets add constraint media_assets_source_type_check check(source_type in ('upload','youtube','tiktok','instagram'));
alter table public.media_assets add column clip jsonb;
alter table public.media_assets add constraint media_assets_clip_check check(clip is null or coalesce(
 jsonb_typeof(clip)='object' and (clip-'startSeconds'-'endSeconds')='{}'::jsonb and
 jsonb_typeof(clip->'startSeconds')='number' and jsonb_typeof(clip->'endSeconds')='number' and
 (clip->>'startSeconds')::numeric>=0 and (clip->>'endSeconds')::numeric<=180 and
 (clip->>'endSeconds')::numeric-(clip->>'startSeconds')::numeric between 0.1 and 90 and
 ((clip->>'startSeconds')::numeric*1000)=trunc((clip->>'startSeconds')::numeric*1000) and
 ((clip->>'endSeconds')::numeric*1000)=trunc((clip->>'endSeconds')::numeric*1000),false));
create or replace function private.validate_media_state() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.clip is distinct from old.clip then raise exception 'Clip selection is immutable'; end if;
 if tg_op='INSERT' then
  if new.status<>'awaiting_upload' then raise exception 'Invalid initial media state'; end if;
 elsif new.status<>old.status then
  if not ((old.status='awaiting_upload' and new.status='queued') or
          (old.status='queued' and new.status='processing') or
          (old.status='processing' and new.status in ('ready','failed'))) then
   raise exception 'Invalid media state transition';
  end if;
 end if;
 if new.status='ready' then
  if new.metadata is null or not (new.metadata ?& array['durationSeconds','bytes','mimeType']) or
    jsonb_typeof(new.metadata->'durationSeconds') is distinct from 'number' or jsonb_typeof(new.metadata->'bytes') is distinct from 'number' or
    (new.metadata->>'durationSeconds')::numeric not between 0.001 and 90 or
    (new.metadata->>'bytes')::numeric not between 1 and 50000000 or new.metadata->>'mimeType'<>'video/mp4' then
   raise exception 'Invalid ready media metadata';
  end if;
 end if;
 if (new.status='processing')<>(new.locked_until is not null) then raise exception 'Invalid media lease'; end if;
 new.updated_at=now(); return new;
end $$;

commit;
-- Storage stays 50,000,000 bytes: no bucket change needed.
