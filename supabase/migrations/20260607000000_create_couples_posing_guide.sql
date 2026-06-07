create extension if not exists "pgcrypto";

create table if not exists public.couples_inspiration_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text,
  external_source_url text,
  title text not null,
  internal_notes text,
  client_notes text,
  creator_name text,
  attribution_text text,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  related_prompt_number integer,
  width integer,
  height integer,
  alt_text text,
  visibility text not null default 'private',
  is_published boolean not null default false,
  display_order integer not null default 0,
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couples_inspiration_title_not_blank check (length(trim(title)) > 0),
  constraint couples_inspiration_source_check check (
    storage_path is not null or external_source_url is not null
  ),
  constraint couples_inspiration_visibility_check check (
    visibility in ('private', 'client_shareable', 'public')
  ),
  constraint couples_inspiration_public_rights_check check (
    visibility <> 'public' or rights_confirmed = true
  ),
  constraint couples_inspiration_prompt_number_check check (
    related_prompt_number is null or related_prompt_number between 1 and 23
  ),
  constraint couples_inspiration_dimensions_check check (
    (width is null and height is null) or (width > 0 and height > 0)
  ),
  constraint couples_inspiration_display_order_check check (display_order >= 0)
);

drop trigger if exists couples_inspiration_images_set_updated_at
on public.couples_inspiration_images;

create trigger couples_inspiration_images_set_updated_at
before update on public.couples_inspiration_images
for each row execute function public.set_updated_at();

create index if not exists couples_inspiration_display_order_idx
on public.couples_inspiration_images(display_order, created_at);

create index if not exists couples_inspiration_visibility_idx
on public.couples_inspiration_images(visibility, is_published, rights_confirmed);

create index if not exists couples_inspiration_categories_idx
on public.couples_inspiration_images using gin(categories);

create index if not exists couples_inspiration_tags_idx
on public.couples_inspiration_images using gin(tags);

revoke all on public.couples_inspiration_images from anon, authenticated;
grant all on public.couples_inspiration_images to service_role;

alter table public.couples_inspiration_images enable row level security;
alter table public.couples_inspiration_images force row level security;
-- No anon or authenticated policies. The custom admin cookie is validated by
-- server-only route handlers, which then use the service role.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'couples-posing-inspiration',
  'couples-posing-inspiration',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage operations are also server-only through the service role. Keeping
-- the bucket private ensures every delivered asset uses a short-lived signed URL.
