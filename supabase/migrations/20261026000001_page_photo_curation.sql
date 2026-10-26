-- ─────────────────────────────────────────────────────────────────────────────
-- page_photo_curation — per-page editorial choices for automatically matched
-- photos (2026-10-26).
--
-- Public pages (/grads/<slug>, location guides) now pick their photos from
-- the photos that are already public (portfolio_images, school_page_photos,
-- *_location_photos), matched by school / place (lib/pagePhotos). Nothing is
-- copied: this table only records what the photographer decided for ONE page.
--
--   mode 'pin'  — always show this photo on this page, in `position` order
--   mode 'hide' — never show this photo on this page (other pages unaffected)
--   is_hero     — the page's hero photo (must be pinned; one per page)
--
-- Keyed by image_url because the photo can come from any of the public tables
-- and its URL is the one identity they share (engine derivatives are
-- content-addressed). A row whose photo stops being public is simply ignored,
-- so a pin can never re-publish anything.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.page_photo_curation (
  id          uuid primary key default gen_random_uuid(),
  -- "grads/sjsu", "couples/palace-of-fine-arts", "family/redwood-grove-nature-preserve"
  page_key    text not null
    check (page_key ~ '^(grads|couples|family|portrait)/[a-z0-9]+(-[a-z0-9]+)*$'),
  image_url   text not null check (image_url ~ '^https?://'),
  mode        text not null check (mode in ('pin', 'hide')),
  position    integer not null default 0,
  is_hero     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint page_photo_curation_hero_is_pinned check (not is_hero or mode = 'pin')
);

create unique index if not exists page_photo_curation_page_image_key
  on public.page_photo_curation (page_key, image_url);
create unique index if not exists page_photo_curation_one_hero_per_page
  on public.page_photo_curation (page_key) where is_hero;

-- Admin routes and server rendering run as service_role. The grant lives here
-- because the local test reset recreates the public schema without defaults.
revoke all on public.page_photo_curation from anon, authenticated;
grant all on public.page_photo_curation to service_role;
alter table public.page_photo_curation enable row level security;
alter table public.page_photo_curation force row level security;
