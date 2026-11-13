-- Reverte 20261112120000_contributors_authorship.sql.
-- ATENÇÃO: apaga contribuidores, vínculos, author_id e contributor_id (autoria colaborativa). Granadas e mídias são preservadas.
-- Faça backup antes. O backend com CONTRIBUTORS_ENABLED=true deixa de funcionar sem estas colunas: desligue a flag e publique o backend anterior primeiro.
begin;
drop trigger grenade_authorship on public.grenades;
drop trigger media_contributor on public.media_assets;
drop policy grenades_insert on public.grenades;
create policy grenades_insert on public.grenades for insert to authenticated with check(public.is_admin());
drop function public.register_contributor(uuid,text);
drop function private.grenade_authorship();
drop function private.media_contributor();
drop function private.contributor_quota(text);
alter table public.grenades drop column author_id;
alter table public.media_assets drop column contributor_id;
drop table public.contributor_links;
drop table public.contributors;
commit;
