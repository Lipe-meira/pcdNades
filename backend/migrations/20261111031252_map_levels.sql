-- Andares (mapas com mais de um radar, ex.: Nuke). ADITIVA: só colunas anuláveis e checks; não altera linhas,
-- grants, policies, triggers nem o contrato de grenades.target/origin_x/origin_y (coordenadas continuam normalizadas
-- no mesmo radar 1024x1024). Nível nulo = andar padrão do mapa, então registros anteriores continuam válidos.
begin;
alter table public.grenades add column origin_level text, add column target_level text;

-- Mapas que possuem andares. Para incluir outro mapa no futuro, recrie esta função (create or replace).
create function private.map_has_levels(map_id text) returns boolean
language sql immutable security invoker set search_path='' as $$ select map_id in ('nuke') $$;
revoke all on function private.map_has_levels(text) from public,anon,authenticated;
grant execute on function private.map_has_levels(text) to authenticated,service_role;

-- Destinos do Solo Exec passam a aceitar a chave opcional "level" (upper|lower), mantendo as regras anteriores.
create or replace function private.valid_solo_destinations(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare point jsonb;
begin
 if value is null or jsonb_typeof(value) <> 'array' then return false; end if;
 if jsonb_array_length(value) not between 1 and 12 then return false; end if;
 for point in select jsonb_array_elements(value) loop
  if jsonb_typeof(point) <> 'object' or (point - 'x' - 'y' - 'type' - 'level') <> '{}'::jsonb
   or jsonb_typeof(point->'x') is distinct from 'number' or jsonb_typeof(point->'y') is distinct from 'number'
   or jsonb_typeof(point->'type') is distinct from 'string' or point->>'type' not in ('smoke','flashbang','molotov','he') then return false; end if;
  if point ? 'level' and (jsonb_typeof(point->'level') is distinct from 'string' or point->>'level' not in ('upper','lower')) then return false; end if;
  if (point->>'x')::numeric not between 0 and 1 or (point->>'y')::numeric not between 0 and 1 then return false; end if;
 end loop;
 return true;
end $$;

-- O ponto principal (target) continua sendo {x,y}: ignora também a chave "level" do primeiro destino.
alter table public.grenades drop constraint grenades_solo_destinations_check;
alter table public.grenades add constraint grenades_solo_destinations_check check (
 (type='solo_exec' and origin_x is not null and origin_y is not null and private.valid_solo_destinations(destinations) and target = ((destinations->0) - 'type' - 'level')
   and target_level is not distinct from (destinations->0->>'level'))
 or (type<>'solo_exec' and destinations is null)
);

alter table public.grenades add constraint grenades_levels_check check (
 (origin_level is null or origin_level in ('upper','lower'))
 and (target_level is null or target_level in ('upper','lower'))
 and (origin_level is null or origin_x is not null)
 and (
   (origin_level is null and target_level is null and not jsonb_path_exists(coalesce(destinations,'[]'::jsonb),'$[*].level'))
   or private.map_has_levels(map_id)
 )
);
commit;
