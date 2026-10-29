create schema if not exists private;
create table private.administrators(user_id uuid primary key references auth.users(id) on delete cascade);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.administrators where user_id=auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon,authenticated,service_role;
create table public.maps(id text primary key,name text not null,radar jsonb not null);
create table public.media_assets(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 source_type text not null check(source_type in ('upload','youtube','tiktok')),source_url text,
 status text not null default 'awaiting_upload' check(status in ('awaiting_upload','queued','processing','ready','failed')),
 stage text,error jsonb,metadata jsonb,storage_key text not null unique,
 attempts int not null default 0,locked_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.grenades(
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 120),
 map_id text not null references public.maps(id),type text not null check(type in ('smoke','flashbang','molotov')),
 side text not null check(side in ('T','CT')),instructions text not null check(length(trim(instructions)) between 1 and 10000),
 target jsonb not null,video_id uuid not null references public.media_assets(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(jsonb_typeof(target->'x')='number' and jsonb_typeof(target->'y')='number' and target ? 'x' and target ? 'y'),
 check((target->>'x')::numeric between 0 and 1 and (target->>'y')::numeric between 0 and 1)
);
create index on public.grenades(map_id,type);
create index on public.media_assets(status,created_at);
create function private.validate_grenade() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.media_assets where id=new.video_id and status='ready') then raise exception 'Video must be ready'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger grenade_ready before insert or update on public.grenades for each row execute function private.validate_grenade();
alter table public.maps enable row level security;
alter table public.grenades enable row level security;
alter table public.media_assets enable row level security;
revoke all on public.maps,public.grenades,public.media_assets from anon,authenticated;
grant select on public.maps,public.grenades to anon,authenticated;
grant insert,update,delete on public.grenades to authenticated;
grant select on public.media_assets to authenticated;
create policy maps_read on public.maps for select using(true);
create policy grenades_read on public.grenades for select using(true);
create policy grenades_insert on public.grenades for insert to authenticated with check(public.is_admin());
create policy grenades_update on public.grenades for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy grenades_delete on public.grenades for delete to authenticated using(public.is_admin());
create policy media_admin_read on public.media_assets for select to authenticated using(public.is_admin());
-- Media is only mutated by the trusted API/worker after authorization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('videos-staging','videos-staging',false,50000000,array['video/mp4']) on conflict(id) do nothing;
