-- Pending review/application by the orchestrator. No historical migration is modified.
-- Existing lineups retain target, video and timestamps; their origin defaults to NULL.
begin;

alter table public.grenades
  add column origin_x double precision,
  add column origin_y double precision,
  add constraint grenades_origin_pair_bounds check (
    (origin_x is null and origin_y is null)
    or (
      origin_x is not null and origin_y is not null
      and origin_x between 0 and 1
      and origin_y between 0 and 1
    )
  );

-- PostgreSQL floating-point ordering puts NaN above every finite value;
-- BETWEEN 0 AND 1 rejects NaN as well as positive/negative infinity.
-- No grants, policies, triggers, Storage objects or media rows are changed.
commit;
