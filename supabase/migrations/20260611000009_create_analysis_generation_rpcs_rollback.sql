-- Function-only migration: no data guards needed (spec §14 pre-launch mode).
begin;
drop function if exists public.record_generation_result(uuid, text, text, text, jsonb);
drop function if exists public.claim_generation_type(uuid, text, int);
drop function if exists public.record_analysis_batch(uuid, jsonb);
drop function if exists public.claim_photos_for_analysis(uuid, uuid[], int, int);
commit;
