-- Privacy-conscious first-party analytics (spec §3.6, §10). High volume: bigint identity.
create table if not exists public.content_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in
    ('page_view','cta_click','portfolio_open','inquiry_start','inquiry_submit')),
  path text not null check (length(path) <= 200),
  viewed_at timestamptz not null default now(),
  referrer_domain text null,
  content_type text null,
  content_id text null,
  photography_session_id uuid null
    references public.photography_sessions(id) on delete set null,
  content_item_id uuid null
    references public.session_content_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists content_events_viewed_idx on public.content_events (viewed_at);
create index if not exists content_events_path_idx on public.content_events (path);
create index if not exists content_events_type_idx on public.content_events (event_type);
create index if not exists content_events_content_idx on public.content_events (content_type, content_id);
create index if not exists content_events_session_idx on public.content_events (photography_session_id);
create index if not exists content_events_content_item_idx on public.content_events (content_item_id);

revoke all on public.content_events from anon, authenticated;
grant all on public.content_events to service_role;
alter table public.content_events enable row level security;
alter table public.content_events force row level security;
