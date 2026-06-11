-- DB-backed school-page galleries; canonical photo is the session_photos row (spec §3.5).
create table if not exists public.school_page_photos (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null check (length(trim(school_slug)) > 0),
  session_photo_id uuid not null
    references public.session_photos(id) on delete cascade,
  alt_override text null,
  caption text null,
  sort_order int not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_slug, session_photo_id)
);

create index if not exists school_page_photos_slug_active_idx
  on public.school_page_photos (school_slug, active);

drop trigger if exists school_page_photos_set_updated_at on public.school_page_photos;
create trigger school_page_photos_set_updated_at
before update on public.school_page_photos
for each row execute function public.set_updated_at();

revoke all on public.school_page_photos from anon, authenticated;
grant all on public.school_page_photos to service_role;
alter table public.school_page_photos enable row level security;
alter table public.school_page_photos force row level security;
