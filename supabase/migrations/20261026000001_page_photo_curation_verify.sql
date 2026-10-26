-- Verify for 20261026000001_page_photo_curation.
do $$
declare
  v_failed boolean;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'page_photo_curation'
      and column_name in ('id','page_key','image_url','mode','position','is_hero','created_at','updated_at')
  ) <> 8 then
    raise exception 'page_photo_curation is missing expected columns';
  end if;

  if not has_table_privilege('service_role', 'public.page_photo_curation', 'INSERT')
     or not has_table_privilege('service_role', 'public.page_photo_curation', 'SELECT') then
    raise exception 'service_role cannot write page_photo_curation';
  end if;
  if has_table_privilege('anon', 'public.page_photo_curation', 'SELECT')
     or has_table_privilege('anon', 'public.page_photo_curation', 'INSERT') then
    raise exception 'anon must not read or write page_photo_curation';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'page_photo_curation'
  ) then
    raise exception 'page_photo_curation must have RLS enabled and forced';
  end if;

  insert into public.page_photo_curation (page_key, image_url, mode, is_hero)
  values ('grads/verify-test', 'https://example.com/a.jpg', 'pin', true);

  v_failed := false;
  begin
    insert into public.page_photo_curation (page_key, image_url, mode)
    values ('grads/verify-test', 'https://example.com/a.jpg', 'hide');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'duplicate page/photo row was accepted'; end if;

  v_failed := false;
  begin
    insert into public.page_photo_curation (page_key, image_url, mode, is_hero)
    values ('grads/verify-test', 'https://example.com/b.jpg', 'pin', true);
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a second hero on one page was accepted'; end if;

  v_failed := false;
  begin
    insert into public.page_photo_curation (page_key, image_url, mode, is_hero)
    values ('grads/verify-test', 'https://example.com/c.jpg', 'hide', true);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a hidden hero was accepted'; end if;

  v_failed := false;
  begin
    insert into public.page_photo_curation (page_key, image_url, mode)
    values ('blog/verify-test', 'https://example.com/d.jpg', 'pin');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown page type was accepted'; end if;

  delete from public.page_photo_curation where page_key = 'grads/verify-test';
end $$;
