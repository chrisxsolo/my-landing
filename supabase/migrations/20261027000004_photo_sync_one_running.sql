-- One running photo sync per kind and scope.
--
-- An admin retry, the worker sweep and the background sync queued after an
-- admin action could start the same sync at the same moment. Each sync is
-- idempotent, so the data stayed safe, but the loser could log a false red
-- failure. This index lets the database refuse the second run; the app treats
-- that refusal as "already running" and skips (lib/photoSync/runLog.ts).
--
-- Runs that died without finishing are closed first (they would otherwise
-- block the index and every later run of the same kind).

update public.photo_sync_runs
   set status = 'error',
       error = coalesce(error, 'never finished — the sync stopped before reporting (timeout or crash)'),
       finished_at = coalesce(finished_at, now())
 where status = 'running'
   and started_at < now() - interval '15 minutes';

create unique index if not exists photo_sync_runs_one_running_idx
  on public.photo_sync_runs (kind, coalesce(scope, '*'))
  where status = 'running';
