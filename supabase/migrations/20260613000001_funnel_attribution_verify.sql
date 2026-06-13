-- Verify 20260613000001_funnel_attribution applied cleanly.

-- visitor_sessions exists with the expected columns.
select 'visitor_sessions missing' as check
where not exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'visitor_sessions'
);

-- content_events gained the visitor key + meta.
select 'content_events.anonymous_session_id missing' as check
where not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'content_events'
    and column_name = 'anonymous_session_id'
);
select 'content_events.meta missing' as check
where not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'content_events'
    and column_name = 'meta'
);

-- inquiries gained the stitch column.
select 'inquiries.anonymous_session_id missing' as check
where not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'inquiries'
    and column_name = 'anonymous_session_id'
);

-- The widened allowlist accepts a new funnel event type.
select 'event_type allowlist not widened' as check
where not exists (
  select 1 from pg_constraint
  where conname = 'content_events_event_type_check'
    and pg_get_constraintdef(oid) like '%estimator_complete%'
);
