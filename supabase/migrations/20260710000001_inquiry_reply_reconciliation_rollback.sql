-- Rollback for 20260710000001_inquiry_reply_reconciliation.
-- Note: the one-time status repair (new → responded) is intentionally not
-- reverted — those rows were factually responded to.

alter table public.inquiries
  drop constraint if exists inquiries_last_message_direction_check,
  drop constraint if exists inquiries_status_source_check;

alter table public.inquiries
  drop column if exists needs_reply,
  drop column if exists last_inbound_at,
  drop column if exists last_outbound_at,
  drop column if exists last_message_at,
  drop column if exists last_message_direction,
  drop column if exists status_source,
  drop column if exists gmail_thread_ids;
