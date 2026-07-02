-- Rollback for 20260702000002_service_aware_couples_fields.
-- NOTE: re-tightening the check constraints fails if any row already uses the
-- new values ('prom' service, new lighting values). Clear those rows first.

alter table public.photography_sessions
  drop constraint if exists photography_sessions_vibe_check,
  drop constraint if exists photography_sessions_relationship_type_check;

alter table public.photography_sessions
  drop column if exists vibe,
  drop column if exists relationship_type,
  drop column if exists outfit_styling,
  drop column if exists best_moment;

alter table public.photography_sessions
  drop constraint if exists photography_sessions_lighting_condition_check;
alter table public.photography_sessions
  add constraint photography_sessions_lighting_condition_check check (
    lighting_condition is null or lighting_condition in
    ('morning','midday','afternoon','golden_hour','blue_hour','night','mixed'));

alter table public.photography_sessions
  drop constraint if exists photography_sessions_service_type_check;
alter table public.photography_sessions
  add constraint photography_sessions_service_type_check check (service_type in
    ('grads','couples','families','portraits','maternity','events','other'));
