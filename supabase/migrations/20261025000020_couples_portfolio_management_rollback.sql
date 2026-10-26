-- Rollback for 20261025000020_couples_portfolio_management.

drop trigger if exists portfolio_images_fill_from_session on public.portfolio_images;
drop function if exists public.portfolio_images_fill_from_session();
drop index if exists public.portfolio_images_one_hero_per_category;
drop index if exists public.portfolio_images_category_published_idx;
alter table public.portfolio_images drop constraint if exists portfolio_images_dimensions_check;
alter table public.portfolio_images
  drop column if exists published,
  drop column if exists session_label,
  drop column if exists category_hero,
  drop column if exists width,
  drop column if exists height;
