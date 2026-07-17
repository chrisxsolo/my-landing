-- Rollback for 20260717000003: restores the original six-type check. Will FAIL
-- if any grad_spot_photo / portrait_location_photo items have been published —
-- take those down (or null their target type) before rolling back.

alter table public.session_content_items
  drop constraint if exists session_content_items_published_target_type_check;

alter table public.session_content_items
  add constraint session_content_items_published_target_type_check
  check (
    published_target_type is null
    or published_target_type = any (array[
      'blog_post', 'portfolio_image', 'school_page_photo',
      'family_location_photo', 'couples_location_photo',
      'testimonial', 'none'
    ])
  );
