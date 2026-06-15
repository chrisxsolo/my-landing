-- Rollback for 20260614000001_rls_tier2_lockdown.sql
-- Restores the prior (insecure) state: RLS disabled on the formerly-open tables and
-- the permissive USING(true) write policies recreated. Use only to recover the old
-- behavior if the migrated admin code is rolled back.

-- Re-disable RLS on the public-content + sensitive tables.
drop policy if exists "public_read_links"                on public.links;
alter table public.links          disable row level security;

drop policy if exists "public_read_grad_poses"           on public.grad_poses;
alter table public.grad_poses     disable row level security;

drop policy if exists "public_read_location_spots"       on public.location_spots;
alter table public.location_spots disable row level security;

drop policy if exists "public_read_published_blog_posts" on public.blog_posts;
alter table public.blog_posts     disable row level security;

alter table public.image_library  disable row level security;
alter table public.link_clicks    disable row level security;
alter table public.link_views     disable row level security;

-- Recreate the permissive write policies.
create policy "portfolio_images_public_write"       on public.portfolio_images       for all to public using (true) with check (true);
create policy "portfolio_categories_public_write"   on public.portfolio_categories   for all to public using (true) with check (true);
create policy "portfolio_case_studies_public_write" on public.portfolio_case_studies for all to public using (true) with check (true);
create policy "bay_area_locations_public_write"     on public.bay_area_locations     for all to public using (true) with check (true);
create policy "service write"                        on public.professional_availability for all to public using (true);
