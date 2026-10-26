-- Couples launch (1/2): portfolio management columns.
--
-- portfolio_images
--   published      — hide a photo everywhere without deleting it
--   session_label  — groups photos by session in the admin Couples Portfolio tab
--   category_hero  — the hero photo for a category landing page (one per category)
--   width/height   — pixel size, so galleries keep each photo's real aspect ratio
-- A BEFORE INSERT trigger fills size + session label from the Content Engine's
-- session_photos row, so photos published by the engine arrive pre-grouped.

alter table public.portfolio_images
  add column if not exists published boolean not null default true,
  add column if not exists session_label text,
  add column if not exists category_hero boolean not null default false,
  add column if not exists width integer,
  add column if not exists height integer;

alter table public.portfolio_images
  drop constraint if exists portfolio_images_dimensions_check;
alter table public.portfolio_images
  add constraint portfolio_images_dimensions_check
  check ((width is null or width > 0) and (height is null or height > 0));

create unique index if not exists portfolio_images_one_hero_per_category
  on public.portfolio_images (category_slug) where category_hero;
create index if not exists portfolio_images_category_published_idx
  on public.portfolio_images (category_slug, published);

create or replace function public.portfolio_images_fill_from_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_width integer;
  v_height integer;
  v_label text;
begin
  if new.width is not null and new.height is not null and new.session_label is not null then
    return new;
  end if;
  select sp.width, sp.height,
         concat_ws(' · ',
           nullif(trim(ps.public_display_name), ''),
           nullif(trim(ps.primary_location), ''),
           to_char(ps.session_date, 'Mon YYYY'))
    into v_width, v_height, v_label
    from public.session_photos sp
    join public.photography_sessions ps on ps.id = sp.photography_session_id
   where sp.public_derivative_url = new.image_url
   limit 1;
  if found then
    if new.width is null and new.height is null then
      new.width := v_width;
      new.height := v_height;
    end if;
    new.session_label := coalesce(new.session_label, nullif(v_label, ''));
  end if;
  return new;
end $$;

drop trigger if exists portfolio_images_fill_from_session on public.portfolio_images;
create trigger portfolio_images_fill_from_session
before insert on public.portfolio_images
for each row execute function public.portfolio_images_fill_from_session();

-- Backfill: engine-published rows get their session's size + label.
update public.portfolio_images pi
   set width = coalesce(pi.width, sp.width),
       height = coalesce(pi.height, sp.height),
       session_label = coalesce(pi.session_label, nullif(concat_ws(' · ',
         nullif(trim(ps.public_display_name), ''),
         nullif(trim(ps.primary_location), ''),
         to_char(ps.session_date, 'Mon YYYY')), ''))
  from public.session_photos sp
  join public.photography_sessions ps on ps.id = sp.photography_session_id
 where sp.public_derivative_url = pi.image_url;

-- Backfill: manually uploaded couples sets, grouped by the location they show.
update public.portfolio_images
   set session_label = 'Palace of Fine Arts'
 where category_slug = 'couples' and session_label is null
   and location = 'Palace of Fine Arts';
update public.portfolio_images
   set session_label = 'Crissy Field'
 where category_slug = 'couples' and session_label is null
   and (title ilike '%crissy field%' or alt ilike '%crissy field%');

-- Couples hero: the photo already promoted with the Featured checkbox.
update public.portfolio_images
   set category_hero = true
 where id = (
   select id from public.portfolio_images
    where category_slug = 'couples' and featured
    order by sort_order, id
    limit 1)
   and not exists (
   select 1 from public.portfolio_images
    where category_slug = 'couples' and category_hero);
