-- Rollback: restore default-off column defaults. The backfilled true values
-- are NOT reverted — there is no record of which rows were false before the
-- migration, so flipping them all off would destroy legitimately-granted
-- permissions. Revert individual rows manually if needed.

alter table photography_sessions alter column marketing_permission set default false;
alter table photography_sessions alter column ai_processing_allowed set default false;
