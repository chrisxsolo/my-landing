-- Rollback for 20261015000001_ai_draft_outcomes.
drop index if exists public.ai_draft_outcomes_inquiry_idx;
drop index if exists public.ai_draft_outcomes_created_at_idx;
drop table if exists public.ai_draft_outcomes;
