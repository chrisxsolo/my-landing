-- Inquiry reply-status reconciliation (2026-07-10).
--
-- The timeline sync stamped reply/invoice/contract timestamps on inquiries but
-- never reconciled `status`, so inquiries with obvious booking progress stayed
-- "new" / "needs reply" forever (e.g. an inquiry with reply_sent_at, an invoice
-- and a contract still showing as untouched).
--
-- Adds persisted communication state derived from the actual Gmail
-- conversation, plus a manual-override marker so automatic sync never undoes a
-- status the photographer chose by hand.

alter table public.inquiries
  add column if not exists needs_reply boolean,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_direction text,
  add column if not exists status_source text not null default 'automatic',
  add column if not exists gmail_thread_ids text[] not null default '{}';

alter table public.inquiries
  drop constraint if exists inquiries_last_message_direction_check;
alter table public.inquiries
  add constraint inquiries_last_message_direction_check
  check (last_message_direction is null or last_message_direction in ('inbound', 'outbound'));

alter table public.inquiries
  drop constraint if exists inquiries_status_source_check;
alter table public.inquiries
  add constraint inquiries_status_source_check
  check (status_source in ('automatic', 'manual'));

comment on column public.inquiries.needs_reply is
  'TRUE when the latest client message is newer than the latest outbound reply. NULL for rows never reconciled against Gmail.';
comment on column public.inquiries.last_inbound_at is
  'Timestamp of the most recent inbound email from the client (falls back to the inquiry submission itself).';
comment on column public.inquiries.last_outbound_at is
  'Timestamp of the most recent outbound communication evidence (Gmail sent message or stamped milestone like invoice/contract/reply).';
comment on column public.inquiries.last_message_at is
  'Timestamp of the most recent message in either direction.';
comment on column public.inquiries.last_message_direction is
  'Direction of the most recent message: inbound (client) or outbound (photographer).';
comment on column public.inquiries.status_source is
  'How the current status was set. "manual" statuses are never changed by automatic timeline sync.';
comment on column public.inquiries.gmail_thread_ids is
  'Gmail thread IDs matched to this inquiry during reconciliation.';

-- One-time repair: an inquiry with a stamped reply or booking-progress
-- evidence (invoice, contract, deposit, confirmation, gallery, confirmed
-- booking, paid) was clearly responded to — it must never sit in "new".
update public.inquiries
   set status = 'responded'
 where status = 'new'
   and (
     reply_sent_at is not null
     or invoice_sent_at is not null
     or contract_sent_at is not null
     or deposit_paid_at is not null
     or confirmation_sent_at is not null
     or gallery_delivered_at is not null
     or booking_confirmed = true
     or payment_status = 'paid'
   );

-- Rows with a stamped reply have no pending client message we know about yet;
-- Gmail reconciliation refines this with real latest-message direction later.
update public.inquiries
   set needs_reply = false
 where needs_reply is null
   and reply_sent_at is not null;
