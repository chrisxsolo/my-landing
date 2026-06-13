-- Full-funnel revenue attribution (Phase 1: capture & stitch).
--
-- Adds the missing front-of-funnel layer to first-party analytics:
--   1. visitor_sessions — a persistent anonymous visitor, captured on first
--      arrival with landing page, referrers, and UTM tags. The id is generated
--      client-side (same trust model as content_events) and is the join key
--      that ties a booked inquiry back to whatever first brought the visitor in.
--   2. content_events gains anonymous_session_id (visitor key) + meta (small
--      funnel-event detail e.g. estimated total), and its event_type allowlist
--      widens to cover the estimator/availability/inquiry funnel steps.
--   3. inquiries gains anonymous_session_id — THE stitch. With it,
--      payments(inquiry_id) → inquiries(anonymous_session_id) → visitor_sessions
--      yields real revenue-by-source/landing-page/campaign attribution.
--
-- All changes are additive and nullable. No backfill: rows predating this
-- migration simply have a null visitor key and fall to the labeled fallback.

-- ── 1. visitor_sessions ──────────────────────────────────────────────────────
create table if not exists public.visitor_sessions (
  anonymous_session_id text primary key check (length(anonymous_session_id) <= 64),
  landing_page text null check (landing_page is null or length(landing_page) <= 200),
  first_referrer text null check (first_referrer is null or length(first_referrer) <= 255),
  latest_referrer text null check (latest_referrer is null or length(latest_referrer) <= 255),
  utm_source text null check (utm_source is null or length(utm_source) <= 120),
  utm_medium text null check (utm_medium is null or length(utm_medium) <= 120),
  utm_campaign text null check (utm_campaign is null or length(utm_campaign) <= 120),
  utm_content text null check (utm_content is null or length(utm_content) <= 120),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists visitor_sessions_first_seen_idx on public.visitor_sessions (first_seen_at);
create index if not exists visitor_sessions_source_idx on public.visitor_sessions (utm_source);
create index if not exists visitor_sessions_landing_idx on public.visitor_sessions (landing_page);

revoke all on public.visitor_sessions from anon, authenticated;
grant all on public.visitor_sessions to service_role;
alter table public.visitor_sessions enable row level security;
alter table public.visitor_sessions force row level security;

-- ── 2. content_events: visitor key + funnel detail + widened event allowlist ──
alter table public.content_events
  add column if not exists anonymous_session_id text null
    check (anonymous_session_id is null or length(anonymous_session_id) <= 64);
alter table public.content_events
  add column if not exists meta jsonb null;

create index if not exists content_events_visitor_idx
  on public.content_events (anonymous_session_id);

-- Widen the inline event_type CHECK to cover the new funnel steps. The original
-- constraint is auto-named content_events_event_type_check.
alter table public.content_events drop constraint if exists content_events_event_type_check;
alter table public.content_events add constraint content_events_event_type_check
  check (event_type in (
    'page_view','cta_click','portfolio_open',
    'pricing_view','estimator_start','estimator_complete','availability_selected',
    'inquiry_start','inquiry_submit'
  ));

-- ── 3. inquiries: the stitch back to the visitor session ─────────────────────
alter table public.inquiries
  add column if not exists anonymous_session_id text null
    check (anonymous_session_id is null or length(anonymous_session_id) <= 64);

create index if not exists inquiries_visitor_idx
  on public.inquiries (anonymous_session_id);
