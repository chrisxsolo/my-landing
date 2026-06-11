do $$
begin
  if (select count(*) from pg_indexes where schemaname='public'
      and tablename='content_events') < 6 then  -- pkey + 5
    raise exception 'content_events indexes missing';
  end if;
  if has_table_privilege('anon','public.content_events','insert') then
    raise exception 'content_events writable by anon (writes must go through /api/track-event)';
  end if;
  raise notice 'VERIFY OK: content_events';
end $$;
