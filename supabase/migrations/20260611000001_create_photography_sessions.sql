-- Canonical marketing-session parent (spec §3.1).
create extension if not exists "pgcrypto";

create table if not exists public.photography_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid null references public.client_sessions(id) on delete set null,
  inquiry_id bigint null references public.inquiries(id) on delete set null,

  internal_client_name text null,
  public_display_name text null,
  service_type text not null check (service_type in
    ('grads','couples','families','portraits','maternity','events','other')),
  school_slug text null,
  primary_location text null,
  secondary_locations text[] not null default '{}',
  session_date date null,
  start_time time null,
  lighting_condition text null check (lighting_condition is null or lighting_condition in
    ('morning','midday','afternoon','golden_hour','blue_hour','night','mixed')),
  graduation_year int null check (graduation_year is null or graduation_year between 2000 and 2100),
  degree text null,
  outfit_count int null check (outfit_count is null or outfit_count >= 1),
  group_size int null check (group_size is null or group_size >= 1),

  internal_notes text null,
  public_session_summary text null,

  marketing_permission boolean not null default false,
  marketing_permission_source text null check (marketing_permission_source is null or
    marketing_permission_source in
    ('contract','email','testimonial_form','manual_confirmation','portfolio_collaboration')),
  marketing_permission_confirmed_at timestamptz null,
  marketing_permission_revoked_at timestamptz null,

  ai_processing_allowed boolean not null default false,
  ai_processing_basis text null check (ai_processing_basis is null or ai_processing_basis in
    ('contract','privacy_policy','portfolio_collaboration','manual_confirmation','internal_business_policy')),
  ai_processing_policy_version text null,
  ai_processing_confirmed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_photography_session_per_client_session
  on public.photography_sessions (client_session_id)
  where client_session_id is not null;
create index if not exists photography_sessions_school_idx on public.photography_sessions (school_slug);
create index if not exists photography_sessions_service_idx on public.photography_sessions (service_type);
create index if not exists photography_sessions_date_idx on public.photography_sessions (session_date desc);

drop trigger if exists photography_sessions_set_updated_at on public.photography_sessions;
create trigger photography_sessions_set_updated_at
before update on public.photography_sessions
for each row execute function public.set_updated_at();

revoke all on public.photography_sessions from anon, authenticated;
grant all on public.photography_sessions to service_role;
alter table public.photography_sessions enable row level security;
alter table public.photography_sessions force row level security;
-- Intentionally no anon/authenticated policies (spec §5).
