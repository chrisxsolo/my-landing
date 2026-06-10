-- Couples-guide location galleries.
-- One row per uploaded photograph, associated to a location by its slug (matches
-- CouplesLocationData.slug in lib/couplesGuide/locations/*).
--
-- Access model (RLS):
--   * anon / authenticated  → SELECT only, and only rows where published = true.
--     No INSERT / UPDATE / DELETE (no grants + no policies → denied).
--   * service_role          → full access (bypasses RLS); all admin writes and
--     server-side reads go through it via server-only route handlers.
-- Image bytes live in a PUBLIC storage bucket (couples-photos) so the delivered
-- image_url renders in the browser via next/image, the same way family-photos and
-- grad-photos do.
-- Idempotent: safe to re-run (IF NOT EXISTS, DROP POLICY IF EXISTS, ON CONFLICT).
-- Mirrors 20260609120000_create_family_location_photos.sql.

create extension if not exists "pgcrypto";

create table if not exists public.couples_location_photos (
  id uuid primary key default gen_random_uuid(),
  location_slug text not null,
  image_url text not null,
  storage_path text,
  alt_text text,
  caption text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couples_location_photos_slug_not_blank check (length(trim(location_slug)) > 0),
  constraint couples_location_photos_image_not_blank check (length(trim(image_url)) > 0),
  constraint couples_location_photos_sort_order_check check (sort_order >= 0),
  constraint couples_location_photos_dimensions_check check (
    (width is null and height is null) or (width > 0 and height > 0)
  )
);

drop trigger if exists couples_location_photos_set_updated_at on public.couples_location_photos;

create trigger couples_location_photos_set_updated_at
before update on public.couples_location_photos
for each row execute function public.set_updated_at();

-- Primary read path: published photos for one location, featured first then order.
create index if not exists couples_location_photos_location_idx
on public.couples_location_photos(location_slug, published, featured desc, sort_order);

-- Grants: anon/authenticated get SELECT only (read), gated further by the policy
-- below to published rows. Service role gets everything (and bypasses RLS).
revoke all on public.couples_location_photos from anon, authenticated;
grant select on public.couples_location_photos to anon, authenticated;
grant all on public.couples_location_photos to service_role;

alter table public.couples_location_photos enable row level security;
alter table public.couples_location_photos force row level security;

-- Public (anon + signed-in) may read ONLY published photos. There are
-- deliberately no INSERT/UPDATE/DELETE policies, so those are denied for everyone
-- except the service role — writes happen exclusively in server-only admin routes.
drop policy if exists "Public read published couples photos" on public.couples_location_photos;
create policy "Public read published couples photos"
  on public.couples_location_photos
  for select
  to anon, authenticated
  using (published = true);

-- Public storage bucket for delivered marketing photos (same model as family-photos).
-- Uploads/deletes are performed server-side with the service role; public read
-- lets next/image fetch the optimized source.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'couples-photos',
  'couples-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
