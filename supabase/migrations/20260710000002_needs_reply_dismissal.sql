-- Needs-reply dismissal (2026-07-10).
--
-- needs_reply was derived purely from "latest inbound newer than latest
-- outbound", so a conversation-ending client message ("thank you!") flagged
-- the inquiry forever: nothing in the UI cleared the flag, and every Gmail
-- reconciliation pass recomputed it right back to true.
--
-- Adds a dismissal marker. Reconciliation only re-flags an inquiry when a
-- client message arrives AFTER the dismissal instant.

alter table public.inquiries
  add column if not exists needs_reply_dismissed_at timestamptz;

comment on column public.inquiries.needs_reply_dismissed_at is
  'When the photographer manually cleared the needs-reply flag. Reconciliation re-flags only on an inbound message newer than this instant.';

-- One-time repair: completed sessions (gallery delivered) stuck on a stale
-- conversation-ending client message are dismissed as of that message, so any
-- NEWER client email still re-flags them.
update public.inquiries
   set needs_reply = false,
       needs_reply_dismissed_at = last_inbound_at
 where needs_reply = true
   and gallery_delivered_at is not null
   and last_inbound_at is not null
   and last_inbound_at < now() - interval '14 days';
