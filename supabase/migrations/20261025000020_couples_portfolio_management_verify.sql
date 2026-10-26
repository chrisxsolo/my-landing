-- Verify for 20261025000020_couples_portfolio_management. Read-only.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'portfolio_images' and column_name = 'published') then
    raise exception 'portfolio_images.published missing';
  end if;
  if (select count(*) from public.portfolio_images
       where category_slug = 'couples' and category_hero) > 1 then
    raise exception 'more than one couples hero';
  end if;
  if exists (select 1 from public.portfolio_images
              where category_slug = 'couples' and session_label is null) then
    raise exception 'a couples portfolio photo has no session label';
  end if;
end $$;
