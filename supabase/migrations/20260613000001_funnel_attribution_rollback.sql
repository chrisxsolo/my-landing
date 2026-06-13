-- Rollback for 20260613000001_funnel_attribution.

drop index if exists public.inquiries_visitor_idx;
alter table public.inquiries drop constraint if exists inquiries_anonymous_session_id_check;
alter table public.inquiries drop column if exists anonymous_session_id;

drop index if exists public.content_events_visitor_idx;
alter table public.content_events drop column if exists meta;
alter table public.content_events drop constraint if exists content_events_anonymous_session_id_check;
alter table public.content_events drop column if exists anonymous_session_id;

-- Restore the original (pre-funnel) event_type allowlist.
alter table public.content_events drop constraint if exists content_events_event_type_check;
alter table public.content_events add constraint content_events_event_type_check
  check (event_type in
    ('page_view','cta_click','portfolio_open','inquiry_start','inquiry_submit'));

drop table if exists public.visitor_sessions;
