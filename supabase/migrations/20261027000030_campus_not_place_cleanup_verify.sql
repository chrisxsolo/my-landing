-- Verify for 20261027000030_campus_not_place_cleanup (read-only).
do $$
declare
  school_keys  constant text[] := array['csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf'];
  n_active int;
  n_review int;
  n_linked int;
begin
  if to_regclass('public.migration_undo_20261027000030') is null then
    raise exception 'migration_undo_20261027000030 is missing — the cleanup did not run';
  end if;
  if has_table_privilege('anon', 'public.migration_undo_20261027000030', 'SELECT') then
    raise exception 'anon must not read migration_undo_20261027000030';
  end if;

  select count(*) filter (where active), count(*) filter (where needs_review)
    into n_active, n_review
    from public.bay_area_locations
   where origin = 'engine' and 'campus' = any(environments) and location_key = any(school_keys);
  if n_active > 0 then raise exception '% engine-made campus row(s) are still published', n_active; end if;
  if n_review > 0 then raise exception '% engine-made campus row(s) still wait in review', n_review; end if;

  -- A campus row may keep its links only while published content references it.
  select count(*) into n_linked
    from public.location_sessions ls
    join public.bay_area_locations l on l.id = ls.location_id
   where l.origin = 'engine' and 'campus' = any(l.environments) and l.location_key = any(school_keys)
     and l.featured_photo_id is null
     and not exists (select 1 from public.location_guides g where g.published and g.location_key = l.location_key)
     and not exists (select 1 from public.blog_posts b
                      where b.published_at is not null and b.body like '%/bay-area-locations/' || l.slug || '%');
  if n_linked > 0 then raise exception '% session link(s) to an unreferenced campus row remain', n_linked; end if;
end $$;
