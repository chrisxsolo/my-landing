-- ─────────────────────────────────────────────────────────────────────────────
-- content_engine_schools — custom schools added from Content Engine Session facts.
--
-- The seven page-backed schools (csueb, santa-clara, sf-state, sjsu, stanford,
-- uc-berkeley, usf) stay in code (lib/contentEngine/taxonomy.ts) because each
-- one backs a /grads/<slug> page. This table only holds schools added later
-- (e.g. UC Law SF). photography_sessions.school_slug already stores a plain
-- slug with no constraint, so existing sessions are untouched.
--
-- A custom school is a fact for AI copy only. It never gets a school page,
-- gallery, or campus-spots placement, so adding one cannot publish anything.
--
-- Duplicates: the app compares normalized names, short names and aliases
-- before inserting (lib/contentEngine/schools.ts). The unique indexes here
-- are the backstop for a double-submit or two tabs racing.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.content_engine_schools (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 80)
    check (slug not in ('csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf')),
  name        text not null check (length(btrim(name)) between 2 and 160),
  short_name  text null check (short_name is null or length(btrim(short_name)) between 1 and 60),
  -- normalized name (schoolMatchKey) — two spellings of one school share it
  name_key    text not null check (length(name_key) > 0),
  aliases     text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create unique index if not exists content_engine_schools_slug_key
  on public.content_engine_schools (slug);
create unique index if not exists content_engine_schools_name_key_key
  on public.content_engine_schools (name_key);

-- Admin routes run as service_role. The grant lives here because the local
-- test reset recreates the public schema without default privileges.
revoke all on public.content_engine_schools from anon, authenticated;
grant all on public.content_engine_schools to service_role;
alter table public.content_engine_schools enable row level security;
alter table public.content_engine_schools force row level security;
