-- Versioned generation runs + independently reviewable drafts (spec §3.3, §3.4).
create table if not exists public.session_content_packages (
  id uuid primary key default gen_random_uuid(),
  photography_session_id uuid not null
    references public.photography_sessions(id) on delete cascade,
  generation_number int not null check (generation_number >= 1),
  status text not null default 'generating' check (status in
    ('generating','ready','needs_attention','failed','archived')),
  session_facts_snapshot jsonb not null default '{}',
  model_name text not null,
  model_version text null,
  prompt_version text not null,
  generation_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  unique (photography_session_id, generation_number),
  check ((status = 'archived' and archived_at is not null)
      or (status <> 'archived' and archived_at is null))
);

create unique index if not exists one_active_package_per_session
  on public.session_content_packages (photography_session_id)
  where archived_at is null;

drop trigger if exists session_content_packages_set_updated_at on public.session_content_packages;
create trigger session_content_packages_set_updated_at
before update on public.session_content_packages
for each row execute function public.set_updated_at();

revoke all on public.session_content_packages from anon, authenticated;
grant all on public.session_content_packages to service_role;
alter table public.session_content_packages enable row level security;
alter table public.session_content_packages force row level security;

create table if not exists public.session_content_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null
    references public.session_content_packages(id) on delete cascade,
  content_type text not null check (content_type in
    ('journal_post','portfolio_pick','school_page_photo','guide_photo',
     'social_caption','testimonial_feature','internal_link_suggestion')),
  status text not null default 'draft' check (status in
    ('draft','approved','rejected','publishing','published','failed')),
  payload jsonb not null default '{}',
  payload_revision int not null default 1,

  copied_from_item_id uuid null
    references public.session_content_items(id) on delete set null,

  generation_model text null,
  prompt_version text null,
  generated_at timestamptz null,

  approved_at timestamptz null,
  approved_by text null,
  rejected_at timestamptz null,
  rejection_reason text null,

  publishing_started_at timestamptz null,
  published_target_type text null check (published_target_type is null or
    published_target_type in ('blog_post','portfolio_image','school_page_photo',
      'family_location_photo','couples_location_photo','testimonial','none')),
  published_target_id text null,
  published_ref jsonb null,
  published_at timestamptz null,

  idempotency_key text not null unique,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists session_content_items_unique_published_target
  on public.session_content_items (published_target_type, published_target_id)
  where published_target_id is not null and published_target_type <> 'none';
create index if not exists session_content_items_published_target_lookup
  on public.session_content_items (published_target_type, published_target_id);
create index if not exists session_content_items_package_idx on public.session_content_items (package_id);
create index if not exists session_content_items_status_idx on public.session_content_items (status);
create index if not exists session_content_items_type_idx on public.session_content_items (content_type);

drop trigger if exists session_content_items_set_updated_at on public.session_content_items;
create trigger session_content_items_set_updated_at
before update on public.session_content_items
for each row execute function public.set_updated_at();

revoke all on public.session_content_items from anon, authenticated;
grant all on public.session_content_items to service_role;
alter table public.session_content_items enable row level security;
alter table public.session_content_items force row level security;
