-- ─────────────────────────────────────────────────────────────────────────────
-- Photo-level locations and the photo sync run log (2026-10-27).
--
-- 1. session_photos.photo_location — where THIS photo was taken, when known.
--    A session can cover several places (Palace of Fine Arts, then Legion of
--    Honor, then Crissy Field), so the session's primary_location is context,
--    not a fact about every photo. Null = no photo-level fact; readers fall
--    back to the session as context only.
--      photo_location_source  manual = the photographer set or confirmed it
--                             gps    = matched from the photo's own GPS to a
--                                      verified place (never from looks alone)
--    Setting one photo's location never changes another photo.
--
-- 2. photo_sync_runs — one row per campus-spot / location-library sync, so a
--    failed sync is visible in the admin and can be retried. Nothing here can
--    publish a photo; deleting every row only loses history.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.session_photos
  add column if not exists photo_location text
    check (photo_location is null or length(btrim(photo_location)) between 1 and 200),
  add column if not exists photo_location_source text
    check (photo_location_source is null or photo_location_source in ('manual','gps')),
  add column if not exists photo_location_confirmed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'session_photos_photo_location_pair'
  ) then
    alter table public.session_photos add constraint session_photos_photo_location_pair
      check ((photo_location is null) = (photo_location_source is null));
  end if;
end $$;

create table if not exists public.photo_sync_runs (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('campus_spots','location_library')),
  -- null = every session / every spot; otherwise the session uuid synced
  scope        text check (scope is null or scope ~ '^[0-9a-f-]{36}$'),
  status       text not null default 'running' check (status in ('running','ok','error')),
  trigger      text not null default 'admin' check (trigger in ('admin','worker','retry')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text check (error is null or length(error) <= 2000),
  detail       jsonb check (detail is null or jsonb_typeof(detail) = 'object'),
  retry_of     bigint references public.photo_sync_runs(id) on delete set null
);

create index if not exists photo_sync_runs_kind_started_idx
  on public.photo_sync_runs (kind, started_at desc);

-- Admin API and server jobs only (service role).
revoke all on public.photo_sync_runs from anon, authenticated;
grant all on public.photo_sync_runs to service_role;
alter table public.photo_sync_runs enable row level security;
alter table public.photo_sync_runs force row level security;
