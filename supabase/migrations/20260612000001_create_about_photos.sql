-- about_photos: one optional photo per hardcoded About-page fact slug.
-- Written only via /api/admin/about-photos (requireAdmin + service role).
create table if not exists public.about_photos (
  id uuid primary key default gen_random_uuid(),
  fact_slug text not null unique,
  image_url text not null,
  storage_path text not null,
  alt_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public-read bucket for the fact photos (10 MB cap, image types only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'about-photos',
  'about-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;
