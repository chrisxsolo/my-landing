-- Fix (2026-07-17): session_content_items.published_target_type has a CHECK
-- constraint listing the original six target types, which 20260717000001/2
-- failed to extend — publishing a grad_spot_photo or portrait_location_photo
-- item rolled back with a constraint violation (caught on the first real
-- campus-spot publish). Re-create the constraint mirroring
-- PUBLICATION_TARGET_TYPES in lib/contentEngine/taxonomy.ts — keep the two in
-- sync whenever a target type is added.

alter table public.session_content_items
  drop constraint if exists session_content_items_published_target_type_check;

alter table public.session_content_items
  add constraint session_content_items_published_target_type_check
  check (
    published_target_type is null
    or published_target_type = any (array[
      'blog_post', 'portfolio_image', 'school_page_photo',
      'family_location_photo', 'couples_location_photo',
      'portrait_location_photo', 'grad_spot_photo',
      'testimonial', 'none'
    ])
  );
