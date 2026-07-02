-- Service-aware content engine (spec §8.5 additive change):
--   1. service_type gains 'prom'
--   2. lighting_condition gains descriptive values used by couples sessions
--      (sunset, soft_shade, overcast, harsh_light, flash) — existing values kept
--   3. couples session-fact columns: vibe, relationship_type, outfit_styling,
--      best_moment — all nullable, so existing grad rows are untouched.
-- Postgres auto-named the original inline checks <table>_<column>_check.

alter table public.photography_sessions
  drop constraint if exists photography_sessions_service_type_check;
alter table public.photography_sessions
  add constraint photography_sessions_service_type_check check (service_type in
    ('grads','couples','families','portraits','maternity','prom','events','other'));

alter table public.photography_sessions
  drop constraint if exists photography_sessions_lighting_condition_check;
alter table public.photography_sessions
  add constraint photography_sessions_lighting_condition_check check (
    lighting_condition is null or lighting_condition in
    ('morning','midday','afternoon','golden_hour','sunset','blue_hour','night',
     'soft_shade','overcast','harsh_light','flash','mixed'));

alter table public.photography_sessions
  add column if not exists vibe text null,
  add column if not exists relationship_type text null,
  add column if not exists outfit_styling text null,
  add column if not exists best_moment text null;

alter table public.photography_sessions
  drop constraint if exists photography_sessions_vibe_check;
alter table public.photography_sessions
  add constraint photography_sessions_vibe_check check (vibe is null or vibe in
    ('romantic','playful','candid','cinematic','cozy','editorial','adventurous','intimate','casual'));

alter table public.photography_sessions
  drop constraint if exists photography_sessions_relationship_type_check;
alter table public.photography_sessions
  add constraint photography_sessions_relationship_type_check check (
    relationship_type is null or relationship_type in
    ('couple','engagement','anniversary','proposal','just_because','date_night'));

comment on column public.photography_sessions.vibe is
  'Session mood facet (couples sessions primarily); feeds deterministic SEO keywords.';
comment on column public.photography_sessions.relationship_type is
  'Couples sessions: couple/engagement/anniversary/proposal/just_because/date_night.';
comment on column public.photography_sessions.outfit_styling is
  'Free-text outfit / styling notes (public — may reach AI prompts).';
comment on column public.photography_sessions.best_moment is
  'Free-text best-moment note (public — may reach AI prompts).';
