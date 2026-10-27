-- Portfolio photos saved under the display alias "grads" with no category.
--
-- The admin "import grad photos" button looked the graduation category up by
-- the slug "grads", but portfolio_categories stores it as "graduation" (the
-- read path maps graduation → grads, lib/photoMetadata). The lookup failed, so
-- 16 rows were written with category_slug = 'grads' and category_id = NULL:
-- they render in the grads grid but belong to no category row, so the admin
-- category filter and the category id joins never see them.
--
-- This moves every such row onto the real graduation category — only when
-- that category exists — and rewrites its slug to the category's own slug, the
-- same shape every other write path (admin form, publish RPC) produces.
-- Idempotent: once mapped, no row matches the WHERE clause again.
-- Rows are never deleted and no other column changes.

update public.portfolio_images p
   set category_id = c.id,
       category_slug = c.slug
  from public.portfolio_categories c
 where c.slug = 'graduation'
   and p.category_slug = 'grads'
   and p.category_id is null;
