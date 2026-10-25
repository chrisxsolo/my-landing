-- Rollback for 20261025000002_content_engine_schools.
-- Sessions keep their school_slug text; a session pointing at a removed custom
-- school will fail the facts check until its school is changed or re-added.
drop index if exists public.content_engine_schools_name_key_key;
drop index if exists public.content_engine_schools_slug_key;
drop table if exists public.content_engine_schools;
