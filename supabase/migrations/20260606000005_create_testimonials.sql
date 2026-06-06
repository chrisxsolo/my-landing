create extension if not exists "pgcrypto";

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  message text not null,
  consent_to_marketing boolean not null default false,
  consent_version text not null default '2026-06-06',
  display_name_preference text not null default 'first_name_last_initial',
  status text not null default 'pending',
  source text not null default 'direct_link',
  gallery_id text,
  session_type text,
  admin_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint testimonials_first_name_length check (char_length(trim(first_name)) between 1 and 100),
  constraint testimonials_last_name_length check (char_length(trim(last_name)) between 1 and 100),
  constraint testimonials_email_length check (email is null or char_length(email) <= 254),
  constraint testimonials_message_length check (char_length(trim(message)) between 20 and 2000),
  constraint testimonials_consent_required check (consent_to_marketing = true),
  constraint testimonials_display_name_preference_check check (
    display_name_preference in ('first_name_last_initial', 'full_name', 'first_name_only', 'anonymous')
  ),
  constraint testimonials_status_check check (status in ('pending', 'approved', 'rejected', 'archived')),
  constraint testimonials_source_check check (source in ('direct_link', 'gallery', 'email', 'manual')),
  constraint testimonials_gallery_id_length check (gallery_id is null or char_length(gallery_id) <= 120),
  constraint testimonials_session_type_length check (session_type is null or char_length(session_type) <= 120),
  constraint testimonials_admin_notes_length check (admin_notes is null or char_length(admin_notes) <= 2000)
);

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
before update on public.testimonials
for each row
execute function public.set_updated_at();

create index if not exists testimonials_status_idx on public.testimonials(status);
create index if not exists testimonials_submitted_at_idx on public.testimonials(submitted_at desc);
create index if not exists testimonials_source_idx on public.testimonials(source);

revoke all on public.testimonials from anon, authenticated;
grant all on public.testimonials to service_role;

alter table public.testimonials enable row level security;
alter table public.testimonials force row level security;
-- Intentionally no anon/authenticated policies. All access goes through
-- server-only routes using the service role after validation or admin auth.
