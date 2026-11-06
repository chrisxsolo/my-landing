-- Rollback for 20261106000002_publication_worker_cron.
-- Step 1 of any rollback of scheduled publishing: stops the ticker so nothing
-- publishes. Queued schedules and drafts are untouched. The Vault entries are
-- removed so a re-created job cannot call anything until credentials are set again.
select cron.unschedule('publication-worker-tick') where exists (select 1 from cron.job where jobname = 'publication-worker-tick');
drop function if exists public.tick_publication_worker();
drop function if exists public.set_publication_worker_credentials(text, text);
delete from vault.secrets where name in ('publication_worker_url', 'publication_worker_cron_secret');
-- Extensions are left installed (harmless, and other jobs may use them).
