-- Reverte 20261112180000_contributor_storage_and_import_pools.sql (volta ao estado de 20261112120000).
-- ATENÇÃO: perde a contabilidade de bytes (storage_charge_bytes) e o histórico de uso do slot. Linhas de mídia e granadas são preservadas.
-- Sem estas regras, contribuidores voltam a poder reservar uploads sem orçamento de bytes: mantenha CONTRIBUTOR_UPLOADS_ENABLED=false/CONTRIBUTORS_ENABLED=false antes de reverter.
-- Para desfazer as duas migrations: rode ESTE arquivo primeiro e depois 20261112120000_contributors_authorship_rollback.sql.
begin;
create or replace function public.release_import_slot(p_holder uuid) returns void
language sql security invoker set search_path='' as $$
 update private.import_slot set holder=null,locked_until=null where singleton and holder=p_holder
$$;
drop function public.claim_import_slot(uuid,integer,uuid);
drop table private.import_slot_usage;
create or replace function public.reserve_import_source(p_owner uuid) returns public.import_sources
language plpgsql security invoker set search_path='' as $$
declare result public.import_sources;
begin
 perform pg_advisory_xact_lock(762001139);
 if (select count(*) from public.import_sources where owner_id=p_owner and created_at>now()-interval '1 hour')>=20
 or (select count(*) from public.import_sources where created_at>now()-interval '1 hour')>=50
 then raise exception 'IMPORT_RATE_LIMIT'; end if;
 insert into public.import_sources(owner_id) values(p_owner) returning * into result;
 return result;
end $$;
drop function private.import_limit(text);

drop function public.contributor_reclaim_candidates(integer);
drop function public.contributor_storage_report();
create or replace function private.media_contributor() returns trigger language plpgsql security invoker set search_path='' as $$
declare cid uuid;
begin
 if tg_op='UPDATE' then
  if new.contributor_id is distinct from old.contributor_id or new.owner_id is distinct from old.owner_id then raise exception 'IMMUTABLE_OWNERSHIP'; end if;
  return new;
 end if;
 select contributor_id into cid from public.contributor_links where auth_user_id=new.owner_id;
 new.contributor_id:=cid;
 if cid is not null then
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor-media-global',0));
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor:'||cid::text,0));
  if (select count(*) from public.media_assets where contributor_id=cid and created_at>now()-interval '1 hour')>=private.contributor_quota('media_hour')
   or (select count(*) from public.media_assets where contributor_id=cid and created_at>now()-interval '1 day')>=private.contributor_quota('media_day')
   or (select count(*) from public.media_assets where contributor_id is not null and created_at>now()-interval '1 day')>=private.contributor_quota('media_day_global')
  then raise exception 'CONTRIBUTOR_QUOTA_EXCEEDED'; end if;
 end if;
 return new;
end $$;
create or replace function private.contributor_quota(kind text) returns integer language sql immutable set search_path='' as $$
 select case kind when 'media_hour' then 10 when 'media_day' then 30 when 'grenade_day' then 30 when 'media_day_global' then 200 end
$$;
drop function private.media_charge(text,jsonb);
alter table public.media_assets drop column storage_charge_bytes;
commit;
