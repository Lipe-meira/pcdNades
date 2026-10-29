-- NOT APPLIED. Apply after 001/002 in coordinated maintenance.
-- No existing rows/objects changed; widen source type and final duration only.
begin;
alter table public.media_assets drop constraint media_assets_source_type_check;
alter table public.media_assets add constraint media_assets_source_type_check check(source_type in ('upload','youtube','tiktok','instagram'));
create or replace function private.validate_media_state() returns trigger language plpgsql security invoker set search_path='' as $$
begin
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
    (new.metadata->>'durationSeconds')::numeric not between 0.001 and 40 or
    (new.metadata->>'bytes')::numeric<=0 or new.metadata->>'mimeType'<>'video/mp4' then
   raise exception 'Invalid ready media metadata';
  end if;
 end if;
 if (new.status='processing')<>(new.locked_until is not null) then raise exception 'Invalid media lease'; end if;
 new.updated_at=now(); return new;
end $$;

commit;
-- Storage stays 50,000,000 bytes: no bucket change needed.
