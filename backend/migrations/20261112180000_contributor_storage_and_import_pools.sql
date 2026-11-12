-- NÃO APLICADA em nenhum Supabase. Depende de 20261112120000_contributors_authorship.sql (aplicar depois dela, com backup e autorização).
-- Correções da revisão independente do PR #19:
--   S1  orçamento de BYTES para contribuidores (reserva atômica, pendentes, por contribuidor e global);
--   S2  reservas de importação e slot do processador separados por papel (contribuidor nunca consome a capacidade do admin).
-- Aditiva: nenhuma linha existente é reescrita (a coluna nova tem default constante); administradores e histórico não são afetados.
begin;

-- ===== S1: contabilidade de bytes por mídia ================================================================
-- storage_charge_bytes = quanto de Storage a linha pode ocupar. Entra com a RESERVA MÁXIMA (fonte + trecho) e só pode CAIR,
-- na transição para `ready` (tamanho real). Nunca é definida nem alterada pelo chamador (vale também para service_role).
-- Falhas e abandonos mantêm a reserva inteira: o objeto pode continuar no Storage e uma URL assinada pode ainda estar válida.
alter table public.media_assets add column storage_charge_bytes bigint not null default 0 check(storage_charge_bytes between 0 and 100000000);

-- Limites (alterar exige nova migration: fail-closed). Bytes ≤ capacidade livre do Storage; confirmar no projeto real antes de abrir.
create or replace function private.contributor_quota(kind text) returns integer language sql immutable set search_path='' as $$
 select case kind
  when 'media_hour' then 10 when 'media_day' then 30 when 'grenade_day' then 30 when 'media_day_global' then 200
  when 'pending_contributor' then 2 when 'pending_global' then 10
  when 'storage_contributor_bytes' then 150000000 when 'storage_global_bytes' then 400000000
  when 'upload_window_minutes' then 150  -- URLs assinadas de upload valem 2 h + 30 min de margem
 end
$$;

-- Reserva máxima por mídia: upload simples = 50 MB (limite do bucket); upload com corte = fonte 50 MB + trecho 50 MB; importação = trecho 50 MB.
create function private.media_charge(p_source_type text,p_clip jsonb) returns bigint language sql immutable set search_path='' as $$
 select (case when p_source_type='upload' and p_clip is not null then 100000000 else 50000000 end)::bigint
$$;
revoke all on function private.media_charge(text,jsonb) from public,anon,authenticated;
grant execute on function private.media_charge(text,jsonb) to service_role;

create or replace function private.media_contributor() returns trigger language plpgsql security invoker set search_path='' as $$
declare cid uuid; charge bigint; actual numeric; src numeric;
begin
 if tg_op='UPDATE' then
  if new.contributor_id is distinct from old.contributor_id or new.owner_id is distinct from old.owner_id then raise exception 'IMMUTABLE_OWNERSHIP'; end if;
  -- A cobrança não vem do chamador: só a conciliação ao ficar pronta pode reduzi-la, e nunca acima da reserva.
  new.storage_charge_bytes:=old.storage_charge_bytes;
  -- R1: o processador worker-transcode grava playback-N.mp4 e RETÉM source.mp4 (dois objetos), mas a cobrança só conheceria um.
  -- Upload de contribuidor sem corte só fica pronto mantendo a storage_key da fonte; com corte a chave do trecho é legítima (fonte + trecho cobrados).
  if new.contributor_id is not null and new.source_type='upload' and new.clip is null and new.status='ready' and old.status<>'ready' and new.storage_key is distinct from old.storage_key
  then raise exception 'CONTRIBUTOR_STORAGE_UNACCOUNTED'; end if;
  -- R2: qualquer ENTRADA em fila/processamento (ex.: complete tardio de upload cuja janela de 150 min já venceu, que saiu da contagem de
  -- pendentes) passa pela mesma admissão atômica do INSERT: mesmos locks, mesma ordem, e conta os OUTROS pendentes. A linha não é apagada
  -- nem tem a reserva de bytes alterada: a URL assinada pode continuar válida, e depois que uma vaga abrir o complete pode ser repetido.
  if new.contributor_id is not null and old.status not in ('queued','processing') and new.status in ('queued','processing') then
   perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor-media-global',0));
   perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor:'||new.contributor_id::text,0));
   if (select count(*) from public.media_assets where contributor_id=new.contributor_id and id<>new.id and (status in ('queued','processing') or (status='awaiting_upload' and created_at>now()-make_interval(mins=>private.contributor_quota('upload_window_minutes')))))>=private.contributor_quota('pending_contributor')
   then raise exception 'CONTRIBUTOR_PENDING_LIMIT'; end if;
   if (select count(*) from public.media_assets where contributor_id is not null and id<>new.id and (status in ('queued','processing') or (status='awaiting_upload' and created_at>now()-make_interval(mins=>private.contributor_quota('upload_window_minutes')))))>=private.contributor_quota('pending_global')
   then raise exception 'CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED'; end if;
  end if;
  if new.contributor_id is not null and new.status='ready' and old.status<>'ready' and jsonb_typeof(new.metadata->'bytes')='number' then
   actual:=(new.metadata->>'bytes')::numeric;
   if actual between 1 and 50000000 then
    src:=case when new.clip is not null and new.source_type='upload'
     then case when jsonb_typeof(new.metadata->'sourceBytes')='number' and (new.metadata->>'sourceBytes')::numeric between 1 and 50000000 then (new.metadata->>'sourceBytes')::numeric else 50000000 end
     else 0 end;
    new.storage_charge_bytes:=least(old.storage_charge_bytes,(actual+src)::bigint);
   end if;
  end if;
  return new;
 end if;
 select contributor_id into cid from public.contributor_links where auth_user_id=new.owner_id;
 new.contributor_id:=cid;new.storage_charge_bytes:=0;
 if cid is not null then
  -- Ordem fixa dos locks (global, depois o contribuidor) evita deadlock; cotas e bytes ficam atômicos entre conexões:
  -- a soma é lida DEPOIS do lock, então enxerga o que as transações anteriores confirmaram.
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor-media-global',0));
  perform pg_advisory_xact_lock(hashtextextended('pcdnades:contributor:'||cid::text,0));
  if (select count(*) from public.media_assets where contributor_id=cid and created_at>now()-interval '1 hour')>=private.contributor_quota('media_hour')
   or (select count(*) from public.media_assets where contributor_id=cid and created_at>now()-interval '1 day')>=private.contributor_quota('media_day')
   or (select count(*) from public.media_assets where contributor_id is not null and created_at>now()-interval '1 day')>=private.contributor_quota('media_day_global')
  then raise exception 'CONTRIBUTOR_QUOTA_EXCEEDED'; end if;
  charge:=private.media_charge(new.source_type,new.clip);
  -- Pendente = ainda pode receber/gastar bytes: em fila/processamento sempre; aguardando upload só enquanto a URL assinada pode valer.
  if (select count(*) from public.media_assets where contributor_id=cid and (status in ('queued','processing') or (status='awaiting_upload' and created_at>now()-make_interval(mins=>private.contributor_quota('upload_window_minutes')))))>=private.contributor_quota('pending_contributor')
  then raise exception 'CONTRIBUTOR_PENDING_LIMIT'; end if;
  if (select coalesce(sum(storage_charge_bytes),0) from public.media_assets where contributor_id=cid)+charge>private.contributor_quota('storage_contributor_bytes')
  then raise exception 'CONTRIBUTOR_STORAGE_EXCEEDED'; end if;
  -- Orçamento GLOBAL: independe de quantas identidades existam.
  if (select count(*) from public.media_assets where contributor_id is not null and (status in ('queued','processing') or (status='awaiting_upload' and created_at>now()-make_interval(mins=>private.contributor_quota('upload_window_minutes')))))>=private.contributor_quota('pending_global')
   or (select coalesce(sum(storage_charge_bytes),0) from public.media_assets where contributor_id is not null)+charge>private.contributor_quota('storage_global_bytes')
  then raise exception 'CONTRIBUTOR_STORAGE_BUDGET_EXHAUSTED'; end if;
  new.storage_charge_bytes:=charge;
 end if;
 return new;
end $$;

-- Operação (somente leitura): nada aqui apaga linha ou objeto. A limpeza real é manual e só depois de remover o objeto do Storage.
create function public.contributor_storage_report() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'budgetBytes',private.contributor_quota('storage_global_bytes'),
  'chargedBytes',(select coalesce(sum(storage_charge_bytes),0) from public.media_assets where contributor_id is not null),
  'pending',(select count(*) from public.media_assets where contributor_id is not null and (status in ('queued','processing') or (status='awaiting_upload' and created_at>now()-make_interval(mins=>private.contributor_quota('upload_window_minutes'))))),
  'unfinishedBytes',(select coalesce(sum(storage_charge_bytes),0) from public.media_assets where contributor_id is not null and status in ('awaiting_upload','failed')))
$$;
-- Candidatos à limpeza MANUAL: nunca antes da expiração das URLs assinadas (carência mínima = janela), nunca mídia pronta/referenciada.
create function public.contributor_reclaim_candidates(p_grace_minutes integer default 180) returns table(media_id uuid,storage_key text,status text,charge_bytes bigint,created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select m.id,m.storage_key,m.status,m.storage_charge_bytes,m.created_at from public.media_assets m
 where m.contributor_id is not null and m.status in ('awaiting_upload','failed')
  and m.created_at<now()-make_interval(mins=>greatest(coalesce(p_grace_minutes,0),private.contributor_quota('upload_window_minutes')))
  and m.updated_at<now()-make_interval(mins=>greatest(coalesce(p_grace_minutes,0),private.contributor_quota('upload_window_minutes')))
  and not exists(select 1 from public.grenades g where g.video_id=m.id)
  and not exists(select 1 from public.import_sources s where s.media_id=m.id and s.expires_at>now())
 order by m.created_at
$$;
revoke all on function public.contributor_storage_report(),public.contributor_reclaim_candidates(integer) from public,anon,authenticated;
grant execute on function public.contributor_storage_report(),public.contributor_reclaim_candidates(integer) to service_role;

-- ===== S2: pools de importação por papel ===================================================================
-- Administrador = quem NÃO tem vínculo de contribuidor (o cadastro de contribuidor é negado a administradores na API).
create function private.import_limit(kind text) returns integer language sql immutable set search_path='' as $$
 select case kind
  when 'source_hour_contributor' then 6 when 'source_hour_contributors_pool' then 20
  when 'slot_seconds_hour_contributor' then 400 when 'slot_seconds_hour_contributors_pool' then 1200
 end
$$;
revoke all on function private.import_limit(text) from public,anon,authenticated;
grant execute on function private.import_limit(text) to service_role;

-- Reserva de inspeção: o limite individual de 20/h e o total de 50/h continuam valendo para todos; contribuidores ganham
-- teto próprio (6/h cada, 20/h somados). Como os 20 dos contribuidores somam menos que 50, sempre sobram ≥30 para o administrador.
create or replace function public.reserve_import_source(p_owner uuid) returns public.import_sources
language plpgsql security invoker set search_path='' as $$
declare result public.import_sources;
begin
 perform pg_advisory_xact_lock(762001139);
 if exists(select 1 from public.contributor_links where auth_user_id=p_owner) then
  if (select count(*) from public.import_sources where owner_id=p_owner and created_at>now()-interval '1 hour')>=private.import_limit('source_hour_contributor')
  or (select count(*) from public.import_sources s where s.created_at>now()-interval '1 hour' and exists(select 1 from public.contributor_links l where l.auth_user_id=s.owner_id))>=private.import_limit('source_hour_contributors_pool')
  then raise exception 'IMPORT_RATE_LIMIT'; end if;
 end if;
 if (select count(*) from public.import_sources where owner_id=p_owner and created_at>now()-interval '1 hour')>=20
 or (select count(*) from public.import_sources where created_at>now()-interval '1 hour')>=50
 then raise exception 'IMPORT_RATE_LIMIT'; end if;
 insert into public.import_sources(owner_id) values(p_owner) returning * into result;
 return result;
end $$;

-- Slot único do processador (inspeção, prévia e importação): contribuidores têm orçamento de TEMPO por hora (individual e somado);
-- o administrador não tem esse limite. Cobra o pior caso ao assumir e devolve o não usado ao liberar.
create table private.import_slot_usage(
 id uuid primary key default gen_random_uuid(),
 holder uuid not null,owner_id uuid not null,
 claimed_at timestamptz not null default now(),
 seconds integer not null check(seconds between 1 and 120)
);
alter table private.import_slot_usage enable row level security;
revoke all on private.import_slot_usage from public,anon,authenticated;
grant select,insert,update,delete on private.import_slot_usage to service_role;
create index import_slot_usage_claimed on private.import_slot_usage(claimed_at);
create index import_slot_usage_holder on private.import_slot_usage(holder);

create function public.claim_import_slot(p_holder uuid,p_seconds integer,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed boolean;
begin
 if p_holder is null or p_owner is null or p_seconds not between 1 and 120 then raise exception 'INVALID_SLOT'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pcdnades:import-slot-usage',0));
 delete from private.import_slot_usage where claimed_at<now()-interval '2 hours';
 if exists(select 1 from public.contributor_links where auth_user_id=p_owner) and (
  coalesce((select sum(u.seconds) from private.import_slot_usage u where u.owner_id=p_owner and u.claimed_at>now()-interval '1 hour'),0)+p_seconds>private.import_limit('slot_seconds_hour_contributor')
  or coalesce((select sum(u.seconds) from private.import_slot_usage u where u.claimed_at>now()-interval '1 hour' and exists(select 1 from public.contributor_links l where l.auth_user_id=u.owner_id)),0)+p_seconds>private.import_limit('slot_seconds_hour_contributors_pool')
 ) then raise exception 'IMPORT_RATE_LIMIT'; end if;
 update private.import_slot set holder=p_holder,locked_until=now()+make_interval(secs=>p_seconds)
 where singleton and (locked_until is null or locked_until<=now()) returning true into claimed;
 if coalesce(claimed,false) then insert into private.import_slot_usage(holder,owner_id,seconds) values(p_holder,p_owner,p_seconds); end if;
 return coalesce(claimed,false);
end $$;
revoke all on function public.claim_import_slot(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_import_slot(uuid,integer,uuid) to service_role;

-- Mesma assinatura e mesmo efeito de antes; só acrescenta a devolução do tempo não usado (nunca aumenta a cobrança).
create or replace function public.release_import_slot(p_holder uuid) returns void
language sql security invoker set search_path='' as $$
 update private.import_slot_usage set seconds=greatest(1,least(seconds,ceil(extract(epoch from now()-claimed_at))::integer)) where holder=p_holder;
 update private.import_slot set holder=null,locked_until=null where singleton and holder=p_holder;
$$;

commit;
