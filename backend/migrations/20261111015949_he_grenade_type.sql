-- Permite a granada HE (high explosive) em grenades.type e nos destinos do Solo Exec.
-- Não altera linhas existentes, grants nem RLS: apenas amplia a lista de valores aceitos.
begin;
alter table public.grenades drop constraint grenades_type_check;
alter table public.grenades add constraint grenades_type_check check (type in ('smoke','flashbang','molotov','he','solo_exec'));
-- CREATE OR REPLACE preserva owner e privilégios (revoke/grant da migration 20261101152756 continuam valendo).
create or replace function private.valid_solo_destinations(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare point jsonb;
begin
 if value is null or jsonb_typeof(value) <> 'array' then return false; end if;
 if jsonb_array_length(value) not between 1 and 12 then return false; end if;
 for point in select jsonb_array_elements(value) loop
  if jsonb_typeof(point) <> 'object' or (point - 'x' - 'y' - 'type') <> '{}'::jsonb
   or jsonb_typeof(point->'x') is distinct from 'number' or jsonb_typeof(point->'y') is distinct from 'number'
   or jsonb_typeof(point->'type') is distinct from 'string' or point->>'type' not in ('smoke','flashbang','molotov','he') then return false; end if;
  if (point->>'x')::numeric not between 0 and 1 or (point->>'y')::numeric not between 0 and 1 then return false; end if;
 end loop;
 return true;
end $$;
commit;
