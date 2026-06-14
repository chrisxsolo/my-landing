-- Adds an optional `school` tag to portfolio_images so grad photos can be
-- filtered by campus on /portfolio?category=grads&school=<slug>. Value is the
-- school slug (e.g. "uc-berkeley") matching GRAD_SCHOOLS in
-- lib/portfolioCategoryContent.ts. Existing permissive RLS policies on
-- portfolio_images already cover the new column, so no policy change is needed.
alter table public.portfolio_images add column if not exists school text;

create index if not exists portfolio_images_school_idx
  on public.portfolio_images (school);
