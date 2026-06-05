-- Per-image SEO alt text for blog posts.
-- cover_image_alt: alt text for the cover image.
-- extra_image_alts: alt text for each extra image, aligned by index to extra_image_urls.
alter table public.blog_posts
  add column if not exists cover_image_alt text,
  add column if not exists extra_image_alts text[];
