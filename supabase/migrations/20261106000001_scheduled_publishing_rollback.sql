-- Rollback for 20261106000001_scheduled_publishing.
-- FIRST stop execution: run 20261106000002_publication_worker_cron_rollback.sql
-- (unschedules the tick). Then revert the app deploy; queued rows simply stop
-- being worked and every already-published post stays live.
-- The drops below destroy queued drafts and the schedule history and are NOT
-- the default rollback — keep the tables unless the data is unwanted.
-- blog_posts is never touched.
drop function if exists public.publication_trigger_status();
drop function if exists public.publish_blog_post_draft(uuid, uuid, uuid, jsonb, boolean);
drop function if exists public.publish_scheduled_content_item(uuid, uuid, boolean);
drop function if exists public.claim_publication_schedule_now(uuid, int, int);
drop function if exists public.claim_publication_schedules(int, int, int);
drop table if exists public.publication_schedules;
drop table if exists public.publication_worker_runs;
drop table if exists public.blog_post_drafts;
-- The private blog-drafts bucket is left in place (objects may still be wanted).
