-- Verify for 20261027000020_portfolio_grads_category_fix (read-only).
do $$
declare
  v_orphans integer;
  v_dangling integer;
begin
  -- While a graduation category exists, no portfolio row may still sit on the
  -- alias slug with no category.
  if exists (select 1 from public.portfolio_categories where slug = 'graduation') then
    select count(*) into v_orphans
      from public.portfolio_images
     where category_slug = 'grads' and category_id is null;
    if v_orphans > 0 then
      raise exception '% portfolio_images rows still have category_slug = grads with no category_id', v_orphans;
    end if;
  end if;

  -- Every category id a portfolio row carries must name a real category.
  select count(*) into v_dangling
    from public.portfolio_images p
    left join public.portfolio_categories c on c.id = p.category_id
   where p.category_id is not null and c.id is null;
  if v_dangling > 0 then
    raise exception '% portfolio_images rows point at a category that does not exist', v_dangling;
  end if;
end $$;
