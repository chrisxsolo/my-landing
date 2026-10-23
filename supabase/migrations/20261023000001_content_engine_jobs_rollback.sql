-- Rollback for 20261023000001_content_engine_jobs.
-- Drops the queue only. Nothing a run produced (packages, items, published
-- rows) belongs to this table, so no content is affected.
drop function if exists public.claim_content_engine_job(int, int);
drop function if exists public.enqueue_content_engine_job(uuid);
drop trigger if exists content_engine_jobs_set_updated_at on public.content_engine_jobs;
drop index if exists public.content_engine_jobs_session_idx;
drop index if exists public.content_engine_jobs_claimable_idx;
drop index if exists public.content_engine_jobs_one_active_per_session;
drop table if exists public.content_engine_jobs;
