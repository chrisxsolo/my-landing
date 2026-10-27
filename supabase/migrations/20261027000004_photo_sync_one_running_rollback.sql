-- Rollback for 20261027000004_photo_sync_one_running.
-- Overlapping syncs become possible again (safe, but may log false failures).
-- Runs closed as stalled stay closed: they had already died.
drop index if exists public.photo_sync_runs_one_running_idx;
