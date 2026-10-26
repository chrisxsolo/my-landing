-- ─────────────────────────────────────────────────────────────────────────────
-- campus_spot_auto_photos — photos the sync placed on EMPTY campus spots of
-- /grad-guide/campus-spots (2026-10-27).
--
-- Nothing is copied: a row points at an existing public photo by image_url
-- (the identity every public photo table shares). The sync
-- (lib/campusSpotFill) only writes here, never to location_spots, so a photo
-- the photographer chose (location_spots.image_url or a spot tag) always
-- wins at render time and is never overwritten.
--
--   (school_slug, spot_key) primary key — one automatic photo per spot
--   image_url unique                    — one photo never fills two spots
--   evidence                            — why it matched (tag | place | session | text)
--
-- A row whose photo stops being public is ignored at render time and
-- released by the next sync, so a row can never publish anything.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.campus_spot_auto_photos (
  school_slug     text not null
    check (school_slug in ('csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf')),
  spot_key        text not null
    check (spot_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(spot_key) between 2 and 80),
  image_url       text not null check (image_url ~ '^https?://'),
  evidence        text not null check (evidence in ('tag','place','session','text')),
  evidence_detail text check (evidence_detail is null or length(evidence_detail) <= 300),
  assigned_at     timestamptz not null default now(),
  primary key (school_slug, spot_key)
);

create unique index if not exists campus_spot_auto_photos_image_key
  on public.campus_spot_auto_photos (image_url);

-- Atomic, conditional assignment: fills the spot only if it has no automatic
-- photo yet and the photo is not already used for another spot. Concurrent
-- syncs can never overwrite each other. Returns true when this call assigned it.
create or replace function public.claim_campus_spot_photo(
  p_school_slug text, p_spot_key text, p_image_url text, p_evidence text, p_evidence_detail text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  insert into public.campus_spot_auto_photos (school_slug, spot_key, image_url, evidence, evidence_detail)
  values (p_school_slug, p_spot_key, p_image_url, p_evidence, left(p_evidence_detail, 300))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- Server rendering and the sync run as service_role. The grant lives here
-- because the local test reset recreates the public schema without defaults.
revoke all on public.campus_spot_auto_photos from anon, authenticated;
grant all on public.campus_spot_auto_photos to service_role;
alter table public.campus_spot_auto_photos enable row level security;
alter table public.campus_spot_auto_photos force row level security;

revoke all on function public.claim_campus_spot_photo(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_campus_spot_photo(text, text, text, text, text) to service_role;
