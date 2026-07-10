-- Verify 20260710000002_needs_reply_dismissal.

do $$
declare
  stale int;
begin
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'inquiries'
      and c.column_name = 'needs_reply_dismissed_at'
  ) then
    raise exception 'inquiries is missing column needs_reply_dismissed_at';
  end if;

  select count(*) into stale
  from public.inquiries
  where needs_reply = true
    and gallery_delivered_at is not null
    and last_inbound_at is not null
    and last_inbound_at < now() - interval '14 days';
  if stale > 0 then
    raise exception '% completed inquiries still flagged needs_reply on a stale message', stale;
  end if;

  raise notice 'needs_reply_dismissal verified OK';
end $$;
