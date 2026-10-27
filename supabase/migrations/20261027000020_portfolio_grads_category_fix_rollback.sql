-- Rollback for 20261027000020_portfolio_grads_category_fix.
--
-- Restores the alias slug and the missing category on exactly the rows the
-- forward migration was reviewed against (production, 2026-10-27: the 16
-- portfolio_images rows with category_slug = 'grads' and no category_id).
-- Guarded on the graduation slug so a row the admin has since re-categorised
-- by hand is left alone. Rolling back only re-creates the display quirk the
-- fix removed; nothing is lost either way.

update public.portfolio_images
   set category_id = null,
       category_slug = 'grads'
 where id in (2, 3, 4, 5, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112)
   and category_slug = 'graduation';
