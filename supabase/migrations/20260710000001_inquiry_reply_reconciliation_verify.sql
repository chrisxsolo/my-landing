-- Verify 20260710000001_inquiry_reply_reconciliation.

do $$
declare
  missing text;
  stuck int;
begin
  select string_agg(col, ', ') into missing
  from unnest(array[
    'needs_reply', 'last_inbound_at', 'last_outbound_at', 'last_message_at',
    'last_message_direction', 'status_source', 'gmail_thread_ids'
  ]) as col
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'inquiries'
      and c.column_name = col
  );
  if missing is not null then
    raise exception 'inquiries is missing columns: %', missing;
  end if;

  select count(*) into stuck
  from public.inquiries
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
  if stuck > 0 then
    raise exception '% inquiries still "new" despite booking evidence', stuck;
  end if;

  raise notice 'inquiry_reply_reconciliation verified OK';
end $$;
