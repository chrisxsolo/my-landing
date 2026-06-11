-- Content-engine live-schema compatibility audit (spec §3 intro, §9.3, §14).
-- Run against the baseline-loaded local DB or production (read-only).
-- Every check raises on failure, so a clean run = compatible schema.

do $$
begin
  -- blog_posts: required columns exist, excerpt/meta_title absent
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='blog_posts'
     and column_name in ('title','body','slug','category','sites','cover_image_url',
       'extra_image_urls','meta_description','meta_keywords','og_image_url',
       'cover_image_alt','extra_image_alts','published_at')
  having count(*) = 13;
  if not found then raise exception 'blog_posts is missing expected columns'; end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='blog_posts'
               and column_name in ('excerpt','meta_title')) then
    raise exception 'blog_posts unexpectedly has excerpt/meta_title — update spec §9.3';
  end if;

  -- portfolio_images.content_hash exists (text)
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='portfolio_images'
                   and column_name='content_hash' and data_type='text') then
    raise exception 'portfolio_images.content_hash missing — migration 7 must create it';
  end if;

  -- FK target id types
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='client_sessions'
                   and column_name='id' and data_type='uuid') then
    raise exception 'client_sessions.id is not uuid';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='inquiries'
                   and column_name='id' and data_type='bigint') then
    raise exception 'inquiries.id is not bigint';
  end if;

  -- shared trigger function
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() missing';
  end if;

  -- image_library identity columns used by the journal publisher
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='image_library'
     and column_name in ('title','alt','image_url','source_type','source_post_id',
                         'source_post_slug','source_role','in_portfolio')
  having count(*) = 8;
  if not found then raise exception 'image_library missing expected columns'; end if;

  -- guide tables used by the guide publisher
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='family_location_photos'
     and column_name in ('location_slug','image_url','alt_text','caption','published','sort_order')
  having count(*) = 6;
  if not found then raise exception 'family_location_photos missing expected columns'; end if;
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='couples_location_photos'
     and column_name in ('location_slug','image_url','alt_text','caption','published','sort_order')
  having count(*) = 6;
  if not found then raise exception 'couples_location_photos missing expected columns'; end if;

  raise notice 'AUDIT OK: live schema is compatible with the content-engine spec';
end $$;

-- Informational (run against PRODUCTION read-only; recorded 2026-06-10: 173 / 43 / 0)
-- select count(*) total, count(content_hash) with_hash from public.portfolio_images;
-- select count(*) dupes from (select content_hash from public.portfolio_images
--   where content_hash is not null group by 1 having count(*)>1) d;
