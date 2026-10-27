-- Rollback for 20261027000005_ai_tables_rls_and_fk_indexes.
-- Drops the covering indexes. RLS stays enabled on purpose: re-exposing drafted
-- client emails to the anon key is never a safe state to roll back into.
drop index if exists public.payments_inquiry_id_idx;
drop index if exists public.photo_sync_runs_retry_of_idx;
drop index if exists public.content_engine_jobs_package_id_idx;
drop index if exists public.school_page_photos_session_photo_id_idx;
drop index if exists public.portfolio_images_category_id_idx;
drop index if exists public.photography_sessions_inquiry_id_idx;
