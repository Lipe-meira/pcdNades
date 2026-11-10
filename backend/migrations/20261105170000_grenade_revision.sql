begin;
-- A server-controlled, monotonic row version; existing rows begin at 1.
alter table public.grenades add column revision integer not null default 1 check (revision > 0);
create function private.grenade_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op = 'INSERT' then new.revision := 1; else new.revision := old.revision + 1; end if;
 return new;
end $$;
revoke all on function private.grenade_revision() from public, anon, authenticated;
create trigger grenade_revision before insert or update on public.grenades for each row execute function private.grenade_revision();
-- All authenticated edits must use the API compare-and-swap path.
revoke update on public.grenades from public, anon, authenticated;
grant select, update on public.grenades to service_role;
commit;
