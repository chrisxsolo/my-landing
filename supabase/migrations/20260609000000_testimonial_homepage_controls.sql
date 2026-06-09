-- Homepage featured-testimonial controls.
-- `published_at IS NOT NULL` already marks a testimonial as published; this adds
-- the curation fields the homepage section and admin dashboard need:
--   featured       → opt a testimonial into the homepage section
--   display_order  → arrange featured testimonials intentionally (nulls sort last)
alter table public.testimonials
  add column if not exists featured boolean not null default false,
  add column if not exists display_order integer;

-- Partial index covering the exact homepage query: approved + published + featured,
-- ordered by display_order. Keeps the public fetch fast and small.
create index if not exists testimonials_homepage_idx
  on public.testimonials (display_order)
  where status = 'approved' and featured = true and published_at is not null;
