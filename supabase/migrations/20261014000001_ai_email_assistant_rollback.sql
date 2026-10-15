-- Rollback 20261014000001_ai_email_assistant.
--
-- Drops the three new tables. The "09 AI Instructions / Email Rules" vault note
-- was never modified by the forward migration, so the previous behaviour is
-- fully restored by reverting the application code.

drop table if exists public.ai_email_usage;
drop table if exists public.ai_approved_examples;
drop table if exists public.ai_writing_rules;
