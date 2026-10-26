-- ─────────────────────────────────────────────────────────────────────────────
-- school_spot_notes — where to find a campus spot, written by the photographer
-- for the school location guides (/grads/<slug>/spots) (2026-10-26).
--
-- Some spots aren't safe to describe until Chris confirms them on campus (UC
-- Berkeley's preferred cherry trees, the Doe Library ledge). A guide shows a
-- spot's "Where to find it" line only once a row exists here, so nothing
-- unconfirmed is published. Written from Admin → Page Photos only.
--
--   spot_key       — a key from lib/schoolSpots.ts (validated by the API)
--   location_note  — one short plain-text line, rendered as text (never HTML)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.school_spot_notes (
  school_slug    text not null
    check (school_slug in ('csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf')),
  spot_key       text not null
    check (spot_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(spot_key) between 2 and 80),
  location_note  text not null check (length(btrim(location_note)) between 1 and 240),
  updated_at     timestamptz not null default now(),
  primary key (school_slug, spot_key)
);

-- Admin routes and server rendering run as service_role. The grant lives here
-- because the local test reset recreates the public schema without defaults.
revoke all on public.school_spot_notes from anon, authenticated;
grant all on public.school_spot_notes to service_role;
alter table public.school_spot_notes enable row level security;
alter table public.school_spot_notes force row level security;
