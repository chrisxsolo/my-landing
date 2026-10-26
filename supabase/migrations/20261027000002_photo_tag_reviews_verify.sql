-- Verify for 20261027000002_photo_tag_reviews.
do $$
declare
  v_failed boolean;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'photo_tag_reviews'
      and column_name in ('photo_key','not_applicable','dismissed','ai_suggestions','ai_input_hash','ai_model','ai_analyzed_at','updated_at')
  ) <> 8 then
    raise exception 'photo_tag_reviews is missing expected columns';
  end if;

  if not has_table_privilege('service_role', 'public.photo_tag_reviews', 'INSERT')
     or not has_table_privilege('service_role', 'public.photo_tag_reviews', 'SELECT') then
    raise exception 'service_role cannot write photo_tag_reviews';
  end if;
  if has_table_privilege('anon', 'public.photo_tag_reviews', 'SELECT')
     or has_table_privilege('anon', 'public.photo_tag_reviews', 'INSERT') then
    raise exception 'anon must not read or write photo_tag_reviews';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'photo_tag_reviews'
  ) then
    raise exception 'photo_tag_reviews must have RLS enabled and forced';
  end if;

  insert into public.photo_tag_reviews (photo_key, not_applicable) values ('portfolio:999999999', array['spot']);
  delete from public.photo_tag_reviews where photo_key = 'portfolio:999999999';

  v_failed := false;
  begin
    insert into public.photo_tag_reviews (photo_key) values ('portfolio:1; drop');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a malformed photo key was accepted'; end if;

  v_failed := false;
  begin
    insert into public.photo_tag_reviews (photo_key, not_applicable) values ('portfolio:999999998', array['school']);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'school was accepted as not applicable'; end if;
end $$;
