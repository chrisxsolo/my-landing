-- ─────────────────────────────────────────────────────────────────────────────
-- photo_tag_reviews — the photographer's tagging review decisions and cached
-- AI vision suggestions, one row per library photo (2026-10-27).
--
-- A photo's tagging STATUS is never stored: lib/photoTagging computes it live
-- from the existing categorization fields (portfolio_images, Content Engine
-- session facts, school_spot_photos), the same facts the public pages use.
-- This table only adds what has no home yet:
--   not_applicable  — fields the photographer marked "does not apply" (location, spot)
--   dismissed       — suggestion ids ("spot:sather-gate") never to offer again
--   ai_*            — vision suggestions, kept so a photo is analyzed once per input
--
-- photo_key = "portfolio:<id>" | "engine:<session_photos uuid>". No foreign key:
-- the key spans two tables, and a row for a deleted photo is simply ignored.
-- Nothing here can publish a photo — deleting every row only resets reviews.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.photo_tag_reviews (
  photo_key       text primary key
    check (photo_key ~ '^(portfolio:[0-9]{1,12}|engine:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  not_applicable  text[] not null default '{}'
    check (not_applicable <@ array['location','spot']::text[]),
  dismissed       text[] not null default '{}'
    check (cardinality(dismissed) <= 200),
  ai_suggestions  jsonb
    check (ai_suggestions is null or jsonb_typeof(ai_suggestions) = 'array'),
  ai_input_hash   text check (ai_input_hash is null or length(ai_input_hash) <= 64),
  ai_model        text check (ai_model is null or length(ai_model) <= 100),
  ai_analyzed_at  timestamptz,
  updated_at      timestamptz not null default now()
);

-- Admin API only (service role). The grant lives here because the local test
-- reset recreates the public schema without defaults.
revoke all on public.photo_tag_reviews from anon, authenticated;
grant all on public.photo_tag_reviews to service_role;
alter table public.photo_tag_reviews enable row level security;
alter table public.photo_tag_reviews force row level security;
