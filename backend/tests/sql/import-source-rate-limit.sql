-- Synthetic local PostgreSQL fixture; never run against production.
\set ON_ERROR_STOP on
begin;
do $$
declare a uuid='00000000-0000-4000-8000-000000000001'; b uuid='00000000-0000-4000-8000-000000000002'; c uuid='00000000-0000-4000-8000-000000000003'; n integer;
begin
 for i in 1..19 loop perform public.reserve_import_source(a); end loop;
 select count(*) into n from public.import_sources where owner_id=a; assert n=19,'19 reservations accepted';
 perform public.reserve_import_source(a);
 select count(*) into n from public.import_sources where owner_id=a; assert n=20,'20th reservation accepted';
 begin perform public.reserve_import_source(a); raise exception '21st unexpectedly accepted'; exception when raise_exception then if sqlerrm <> 'IMPORT_RATE_LIMIT' then raise; end if; end;
 select count(*) into n from public.import_sources where owner_id=a; assert n=20,'rejection must not insert';
 -- Expired and failed inspections still count within the window.
 update public.import_sources set expires_at=now()-interval '1 minute';
 begin perform public.reserve_import_source(a); raise exception 'expired sessions unexpectedly ignored'; exception when raise_exception then if sqlerrm <> 'IMPORT_RATE_LIMIT' then raise; end if; end;
 -- Boundary is exclusive: precisely60min old is no longer counted.
 update public.import_sources set created_at=now()-interval '1 hour' where id=(select id from public.import_sources where owner_id=a limit 1);
 perform public.reserve_import_source(a);
 -- Populate other owners to test the shared cap independently of individual cap.
 for i in 1..20 loop perform public.reserve_import_source(b); end loop;
 for i in 1..9 loop perform public.reserve_import_source(c); end loop;
 select count(*) into n from public.import_sources where created_at>now()-interval '1 hour'; assert n=49,'49 global reservations';
 perform public.reserve_import_source(c);
 select count(*) into n from public.import_sources where created_at>now()-interval '1 hour'; assert n=50,'50th global accepted';
 begin perform public.reserve_import_source(c); raise exception '51st global unexpectedly accepted'; exception when raise_exception then if sqlerrm <> 'IMPORT_RATE_LIMIT' then raise; end if; end;
 -- One second inside the moving window still counts.
 update public.import_sources set created_at=now()-interval '1 hour'+interval '1 second' where owner_id=b;
 begin perform public.reserve_import_source(c); raise exception 'window reset too early'; exception when raise_exception then if sqlerrm <> 'IMPORT_RATE_LIMIT' then raise; end if; end;
 update public.import_sources set created_at=now()-interval '1 hour'-interval '1 second' where owner_id=b;
 perform public.reserve_import_source(c);
 assert not has_function_privilege('anon','public.reserve_import_source(uuid)','EXECUTE'),'anon remains denied';
 assert not has_function_privilege('authenticated','public.reserve_import_source(uuid)','EXECUTE'),'authenticated remains denied';
 assert has_function_privilege('service_role','public.reserve_import_source(uuid)','EXECUTE'),'service role remains permitted';
 assert not (select prosecdef from pg_proc where oid='public.reserve_import_source(uuid)'::regprocedure),'security invoker unchanged';
end $$;
rollback;
select 'PASS:19/20/21 individual,49/50/51 global,rolling window,expiry,grants,invoker' as result;
