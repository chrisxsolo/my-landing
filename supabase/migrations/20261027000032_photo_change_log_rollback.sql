-- Rollback for 20261027000032_photo_change_log.
-- Drops the history table. Only history is lost: every photo keeps its
-- current tags, and the admin's in-tab Undo keeps working without it.
drop table if exists public.photo_change_log;
