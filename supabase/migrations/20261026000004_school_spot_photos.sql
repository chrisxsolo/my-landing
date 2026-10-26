-- ─────────────────────────────────────────────────────────────────────────────
-- school_spot_photos — which campus spot a public photo shows, for the school
-- location guides (/grads/<slug>/spots) (2026-10-26).
--
-- The photographer tags a photo with one spot ("tower-hall-lawn") from Admin →
-- Page Photos. Nothing is copied: like page_photo_curation, a row is keyed by
-- image_url, the one identity every public photo table shares. A row whose
-- photo stops being public (unpublished, excluded, permission revoked) is
-- ignored at render time, so a tag can never publish anything.
--
--   spot_key     — a key from lib/schoolSpots.ts (validated by the API)
--   is_featured  — the photo that leads that spot's section (one per spot)
--   position     — order inside the spot's section
--
-- One spot per photo per school. AI suggestions are never written here.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.school_spot_photos (
  id           uuid primary key default gen_random_uuid(),
  school_slug  text not null
    check (school_slug in ('csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf')),
  image_url    text not null check (image_url ~ '^https?://'),
  spot_key     text not null
    check (spot_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(spot_key) between 2 and 80),
  is_featured  boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists school_spot_photos_school_image_key
  on public.school_spot_photos (school_slug, image_url);
create unique index if not exists school_spot_photos_one_featured_per_spot
  on public.school_spot_photos (school_slug, spot_key) where is_featured;

-- Admin routes and server rendering run as service_role. The grant lives here
-- because the local test reset recreates the public schema without defaults.
revoke all on public.school_spot_photos from anon, authenticated;
grant all on public.school_spot_photos to service_role;
alter table public.school_spot_photos enable row level security;
alter table public.school_spot_photos force row level security;
