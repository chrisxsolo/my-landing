do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='testimonials'
                   and column_name='photography_session_id') then
    raise exception 'testimonials.photography_session_id missing';
  end if;
  raise notice 'VERIFY OK: testimonials column';
end $$;
