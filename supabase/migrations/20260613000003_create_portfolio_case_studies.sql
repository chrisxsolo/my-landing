-- portfolio_case_studies: per-session story blocks rendered on /portfolio
-- (location, time of day, what the client wanted, gallery preview, testimonial).
-- Admin-curated via the browser (anon) Supabase client in the admin Case Studies
-- tab, so RLS mirrors portfolio_images: permissive public read + write.
create table if not exists public.portfolio_case_studies (
  id bigint generated always as identity primary key,
  category_slug text not null,
  school text,
  title text not null,
  client_name text,
  location text,
  time_of_day text,
  client_goal text,
  summary text,
  testimonial_quote text,
  testimonial_author text,
  cover_image_url text,
  preview_image_urls text[] not null default '{}',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_case_studies_category_idx
  on public.portfolio_case_studies (category_slug, active, sort_order);

-- Keep updated_at fresh on every write (shared trigger fn already in the DB).
drop trigger if exists set_portfolio_case_studies_updated_at on public.portfolio_case_studies;
create trigger set_portfolio_case_studies_updated_at
  before update on public.portfolio_case_studies
  for each row execute function public.set_updated_at();

-- Permissive public RLS — same pattern as portfolio_images (anon read + write).
alter table public.portfolio_case_studies enable row level security;

drop policy if exists "portfolio_case_studies_public_read"
on public.portfolio_case_studies;

create policy "portfolio_case_studies_public_read"
on public.portfolio_case_studies
for select
using (true);

drop policy if exists "portfolio_case_studies_public_write"
on public.portfolio_case_studies;

create policy "portfolio_case_studies_public_write"
on public.portfolio_case_studies
for all
using (true)
with check (true);
