begin;
-- Existing records keep a null destination list and retain their original type.
alter table public.grenades add column destinations jsonb;
alter table public.grenades drop constraint grenades_type_check;
alter table public.grenades add constraint grenades_type_check check (type in ('smoke','flashbang','molotov','solo_exec'));
create function private.valid_solo_destinations(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare point jsonb;
begin
 if value is null or jsonb_typeof(value) <> 'array' then return false; end if;
 if jsonb_array_length(value) not between 1 and 12 then return false; end if;
 for point in select jsonb_array_elements(value) loop
  if jsonb_typeof(point) <> 'object' or (point - 'x' - 'y' - 'type') <> '{}'::jsonb
   or jsonb_typeof(point->'x') is distinct from 'number' or jsonb_typeof(point->'y') is distinct from 'number'
   or jsonb_typeof(point->'type') is distinct from 'string' or point->>'type' not in ('smoke','flashbang','molotov') then return false; end if;
  if (point->>'x')::numeric not between 0 and 1 or (point->>'y')::numeric not between 0 and 1 then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function private.valid_solo_destinations(jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.valid_solo_destinations(jsonb) to authenticated,service_role;
alter table public.grenades add constraint grenades_solo_destinations_check check (
 (type='solo_exec' and origin_x is not null and origin_y is not null and private.valid_solo_destinations(destinations) and target = ((destinations->0) - 'type'))
 or (type<>'solo_exec' and destinations is null)
);
commit;
