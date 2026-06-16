-- Testimonial intelligence: contextual-matching metadata (spec §8).
-- Social proof converts best when it matches the visitor's concern. These admin-
-- curated fields let a testimonial be matched to a school page, a family/couples
-- pricing page, or posing tips (via `tags`, e.g. 'nervous'), and let cards link
-- out to the full gallery and Google review.
alter table public.testimonials
  add column if not exists school text,
  add column if not exists location text,
  add column if not exists session_year smallint,
  add column if not exists client_image_url text,
  add column if not exists gallery_url text,
  add column if not exists google_review_url text,
  add column if not exists tags text[] not null default '{}'::text[];
