-- Manual, transactional verification for the orchestrator AFTER applying 004.
-- Not executed by the backend agent. Requires an existing lineup with ready media
-- and an authorized database test role. No Storage access; all row changes roll back.
begin;
do $$
declare
  lineup_id uuid;
  before_row jsonb;
  after_row jsonb;
  pair double precision[];
begin
  select g.id, to_jsonb(g) into lineup_id, before_row
    from public.grenades g
    join public.media_assets m on m.id=g.video_id and m.status='ready'
    order by g.id limit 1 for update of g;
  if lineup_id is null then
    raise exception 'Provide a test lineup with ready media before this smoke test';
  end if;

  update public.grenades set origin_x=0,origin_y=1 where id=lineup_id;
  if not exists(select 1 from public.grenades where id=lineup_id and origin_x=0 and origin_y=1) then
    raise exception 'Inclusive boundary origin was not stored';
  end if;
  update public.grenades set origin_x=1,origin_y=0 where id=lineup_id;
  update public.grenades set origin_x=null,origin_y=null where id=lineup_id;

  foreach pair slice 1 in array array[
    array[null::double precision,0], array[0,null::double precision],
    array[-0.001::double precision,0], array[0,1.001::double precision],
    array['NaN'::double precision,0], array[0,'NaN'::double precision],
    array['Infinity'::double precision,0], array[0,'-Infinity'::double precision]
  ] loop
    begin
      update public.grenades set origin_x=pair[1],origin_y=pair[2] where id=lineup_id;
      raise exception 'Invalid origin pair was accepted';
    exception when check_violation then
      null; -- Expected; the invalid statement was rolled back by this subtransaction.
    end;
  end loop;

  select to_jsonb(g) into after_row from public.grenades g where id=lineup_id;
  if (before_row-'origin_x'-'origin_y'-'updated_at') is distinct from
     (after_row-'origin_x'-'origin_y'-'updated_at') then
    raise exception 'Origin update unexpectedly changed other lineup fields';
  end if;
  if after_row->'origin_x'<>'null'::jsonb or after_row->'origin_y'<>'null'::jsonb then
    raise exception 'Invalid update changed the cleared origin';
  end if;
end $$;
rollback;
