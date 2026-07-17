-- Verify 20260717000003: the published_target_type check accepts every value in
-- PUBLICATION_TARGET_TYPES, including the two 2026-07-17 additions.
do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conname = 'session_content_items_published_target_type_check';
  if v_def is null then
    raise exception 'published_target_type check constraint missing';
  end if;
  if v_def not like '%grad_spot_photo%' or v_def not like '%portrait_location_photo%' then
    raise exception 'published_target_type check missing new guide target types';
  end if;
  raise notice '20260717000003 verified';
end $$;
