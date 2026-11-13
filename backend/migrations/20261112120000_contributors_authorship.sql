-- Publicação colaborativa (PR A): contribuidores, autoria estável e invariantes de propriedade.
-- ADITIVA e retrocompatível: nenhuma linha existente é alterada; o backend anterior continua inserindo
-- granadas (author_id nulo) e mídias (contributor_id nulo). Granadas históricas e de administrador ficam sem autor.
-- Não aplicar em produção sem autorização e backup; rollback em backend/rollbacks/. Ver docs/COLABORACAO-IDENTIDADE-20261112.md.
begin;

-- Contribuidor = dono estável de publicações. Não é o uid de login: uma sessão anônima do Supabase não é recuperável,
-- então o vínculo (sessão → contribuidor) pode ganhar novas linhas (PR C) sem reescrever autoria de granadas/vídeos.
create table public.contributors(
 id uuid primary key default gen_random_uuid(),
 nickname text not null constraint contributors_nickname_check check(length(btrim(nickname)) between 2 and 24),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.contributor_links(
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 contributor_id uuid not null references public.contributors(id),
 created_at timestamptz not null default now()
);
create index contributor_links_contributor on public.contributor_links(contributor_id);
alter table public.contributors enable row level security;
alter table public.contributor_links enable row level security;
revoke all on public.contributors,public.contributor_links from public,anon,authenticated;
grant select,insert,update on public.contributors to service_role;
grant select,insert on public.contributor_links to service_role;

alter table public.grenades add column author_id uuid references public.contributors(id);
alter table public.media_assets add column contributor_id uuid references public.contributors(id);
create index grenades_author_created on public.grenades(author_id,created_at) where author_id is not null;
create index media_assets_contributor_created on public.media_assets(contributor_id,created_at) where contributor_id is not null;

-- Limites por contribuidor (janela móvel). Administradores e registros históricos não têm contribuidor e não são afetados.
create function private.contributor_quota(kind text) returns integer language sql immutable set search_path='' as $$
 select case kind when 'media_hour' then 10 when 'media_day' then 30 when 'grenade_day' then 30 when 'media_day_global' then 200 end
$$;
revoke all on function private.contributor_quota(text) from public,anon,authenticated;
grant execute on function private.contributor_quota(text) to service_role;

-- Mídia: o contribuidor vem SEMPRE do vínculo do dono (nunca do chamador), também nas RPCs de importação, que não mudam.
create function private.media_contributor() returns trigger language plpgsql security invoker set search_path='' as $$
declare cid uuid;
begin
 if tg_op='UPDATE' then
  if new.contributor_id is distinct from old.contributor_id or new.owner_id is distinct from old.owner_id then raise exception 'IMMUTABLE_OWNERSHIP'; end if;
  return new;
 end if;
 select contributor_id into cid from public.contributor_links where auth_user_id=new.owner_id;
 new.contributor_id:=cid;
 if cid is not null then
  -- Ordem fixa dos locks (global, depois o contribuidor) evita deadlock; as cotas ficam atômicas entre conexões.
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor-media-global',0));
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor:'||cid::text,0));
  if (select count(*) from public.media_assets where contributor_id=cid and created_at>now()-interval '1 hour')>=private.contributor_quota('media_hour')
   or (select count(*) from public.media_assets where contributor_id=cid and created_at>now()-interval '1 day')>=private.contributor_quota('media_day')
   or (select count(*) from public.media_assets where contributor_id is not null and created_at>now()-interval '1 day')>=private.contributor_quota('media_day_global')
  then raise exception 'CONTRIBUTOR_QUOTA_EXCEEDED'; end if;
 end if;
 return new;
end $$;
revoke all on function private.media_contributor() from public,anon,authenticated;
grant execute on function private.media_contributor() to service_role;
create trigger media_contributor before insert or update on public.media_assets for each row execute function private.media_contributor();

-- Granada: autoria imutável (inclusive NULL→valor e valor→NULL), vídeo do próprio autor e cota diária.
-- Vale para qualquer papel, inclusive service_role: um bug do backend não consegue transferir propriedade.
create function private.grenade_authorship() returns trigger language plpgsql security invoker set search_path='' as $$
declare mc uuid;
begin
 if tg_op='UPDATE' and new.author_id is distinct from old.author_id then raise exception 'IMMUTABLE_OWNERSHIP'; end if;
 if new.author_id is null then return new; end if;
 select contributor_id into mc from public.media_assets where id=new.video_id;
 if tg_op='INSERT' then
  if mc is distinct from new.author_id then raise exception 'VIDEO_NOT_OWNED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor:'||new.author_id::text,0));
  if (select count(*) from public.grenades where author_id=new.author_id and created_at>now()-interval '1 day')>=private.contributor_quota('grenade_day')
  then raise exception 'CONTRIBUTOR_QUOTA_EXCEEDED'; end if;
 elsif new.video_id is distinct from old.video_id then
  -- Reedição por administrador troca por mídia sem contribuidor; nunca por mídia de OUTRO contribuidor.
  if mc is not null and mc<>new.author_id then raise exception 'VIDEO_NOT_OWNED'; end if;
 end if;
 return new;
end $$;
revoke all on function private.grenade_authorship() from public,anon,authenticated;
grant execute on function private.grenade_authorship() to service_role;
create trigger grenade_authorship before insert or update on public.grenades for each row execute function private.grenade_authorship();

-- Quem escreve com chave pública + JWT (administrador) não consegue forjar autoria; granadas com autor só nascem no backend.
drop policy grenades_insert on public.grenades;
create policy grenades_insert on public.grenades for insert to authenticated with check(public.is_admin() and author_id is null);

-- Cadastro atômico e idempotente por sessão. Só service_role; o apelido nunca decide permissão.
create function public.register_contributor(p_auth_user uuid,p_nickname text) returns public.contributors
language plpgsql security invoker set search_path='' as $$
declare cid uuid; result public.contributors;
begin
 perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor-link:'||p_auth_user::text,0));
 select contributor_id into cid from public.contributor_links where auth_user_id=p_auth_user;
 if cid is not null then select * into result from public.contributors where id=cid; return result; end if;
 insert into public.contributors(nickname) values(p_nickname) returning * into result;
 insert into public.contributor_links(auth_user_id,contributor_id) values(p_auth_user,result.id);
 return result;
end $$;
revoke all on function public.register_contributor(uuid,text) from public,anon,authenticated;
grant execute on function public.register_contributor(uuid,text) to service_role;

commit;
