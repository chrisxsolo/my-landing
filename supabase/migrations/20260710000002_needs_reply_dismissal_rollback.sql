-- Rollback for 20260710000002_needs_reply_dismissal.
-- Note: the one-time repair (needs_reply = false on stale completed sessions)
-- is intentionally not reverted — those flags were factually stale.

alter table public.inquiries
  drop column if exists needs_reply_dismissed_at;
