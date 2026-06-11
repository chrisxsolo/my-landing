-- One-time private photo uploads + server-verified metadata + AI analysis (spec §3.2).
create table if not exists public.session_photos (
  id uuid primary key default gen_random_uuid(),
  photography_session_id uuid not null
    references public.photography_sessions(id) on delete cascade,

  storage_path text not null,
  content_hash text not null,
  original_filename text null,
  width int null check (width is null or width > 0),
  height int null check (height is null or height > 0),
  mime_type text null,
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes > 0),

  public_derivative_url text null,
  public_derivative_storage_path text null,
  public_derivative_content_hash text null,
  public_derivative_created_at timestamptz null,

  sort_order int not null default 0 check (sort_order >= 0),
  excluded boolean not null default false,

  analysis_status text not null default 'pending' check (analysis_status in
    ('pending','processing','completed','failed','skipped')),
  analysis_error text null,
  analysis_model text null,
  analysis_version text null,
  analyzed_at timestamptz null,
  analysis_started_at timestamptz null,
  analysis_lease_expires_at timestamptz null,
  analysis_attempt int not null default 0,

  alt_text text null,
  title text null,
  description text null,
  tags text[] not null default '{}',
  quality_score int null check (quality_score is null or quality_score between 1 and 10),
  suggested_category text null check (suggested_category is null or suggested_category in
    ('grads','couples','families','portraits','maternity')),
  destination_recommendations jsonb null,
  analysis_payload jsonb null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (photography_session_id, content_hash)
);

create index if not exists session_photos_session_idx on public.session_photos (photography_session_id);
create index if not exists session_photos_analysis_idx on public.session_photos (analysis_status);

drop trigger if exists session_photos_set_updated_at on public.session_photos;
create trigger session_photos_set_updated_at
before update on public.session_photos
for each row execute function public.set_updated_at();

revoke all on public.session_photos from anon, authenticated;
grant all on public.session_photos to service_role;
alter table public.session_photos enable row level security;
alter table public.session_photos force row level security;

-- Private bucket for originals (spec §4.1). No public access; no anon/authenticated
-- storage policies — service role bypasses storage RLS, admin UI uses signed URLs.
insert into storage.buckets (id, name, public)
values ('session-content-originals', 'session-content-originals', false)
on conflict (id) do nothing;
