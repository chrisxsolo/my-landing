do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='portfolio_images_content_hash_unique') then
    raise exception 'portfolio_images_content_hash_unique missing';
  end if;
  raise notice 'VERIFY OK: portfolio content_hash unique index';
end $$;
