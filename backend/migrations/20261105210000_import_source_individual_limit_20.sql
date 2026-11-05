-- Individual reservation limit only. Global50 and rolling1h remain unchanged.
-- CREATE OR REPLACE preserves existing owner and execution grants.
begin;
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
commit;
