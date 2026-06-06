-- ROLLBACK for 20260606000001_emergency_lock_site_settings.sql
--
-- WARNING: this RE-OPENS anon access to site_settings. Only use if the new
-- /api/admin/site-settings + /api/admin/drafts routes are unavailable and the
-- old browser-based admin must temporarily work again. Ensure gmail_tokens has
-- already been removed from this table before re-opening.

alter table public.site_settings no force row level security;
alter table public.site_settings disable row level security;

-- Restore the default Supabase table GRANTs for the public roles.
grant select, insert, update, delete on public.site_settings to anon, authenticated;
