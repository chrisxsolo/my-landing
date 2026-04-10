alter table public.bay_area_locations enable row level security;

drop policy if exists "bay_area_locations_public_read"
on public.bay_area_locations;

create policy "bay_area_locations_public_read"
on public.bay_area_locations
for select
using (true);

drop policy if exists "bay_area_locations_public_write"
on public.bay_area_locations;

create policy "bay_area_locations_public_write"
on public.bay_area_locations
for all
using (true)
with check (true);
