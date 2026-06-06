-- ─────────────────────────────────────────────────────────────────────────────
-- EMERGENCY: lock down public.site_settings  (ACTIVE INCIDENT — Gmail tokens)
--
-- site_settings had RLS DISABLED while storing `gmail_tokens` (Google OAuth
-- access + refresh tokens). Anyone with the public anon key could read them.
--
-- ⚠️  BREAKING ORDER. Apply this ONLY AFTER:
--       1) the migrated admin UI + /api/admin/site-settings & /api/admin/drafts
--          routes are deployed, and
--       2) 20260606000000_create_gmail_credentials.sql is applied and Gmail has
--          been reconnected (so tokens live in gmail_credentials, not here), and
--       3) the exposed gmail_tokens row has been deleted (see incident checklist).
--
--     If old code (anon-key admin writes / settings reads) is still live when
--     this runs, the admin settings UI and cross-device draft sync will break —
--     which is acceptable and preferable to leaving OAuth credentials readable.
--
-- After deploy, the only access paths are:
--   • Admin settings  → /api/admin/site-settings (service role, requireAdmin, allowlist)
--   • Admin drafts    → /api/admin/drafts        (service role, requireAdmin)
--   • Server pages/APIs (reminder templates, getSiteSettings, blocked senders,
--     gmail) → base table via service role (BYPASSRLS — unaffected)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Remove the broad table GRANTs the public roles hold by default.
revoke all on public.site_settings from anon, authenticated;

-- 2. Drop any pre-existing anon/authenticated/public policies (defensive — there
--    should be none today, but make the lockdown idempotent and explicit).
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'site_settings'
  loop
    execute format('drop policy if exists %I on public.site_settings', p.policyname);
  end loop;
end $$;

-- 3. Enable + FORCE RLS with NO policies → default-deny for anon/authenticated.
--    FORCE also subjects the table-owner role. service_role (BYPASSRLS) is
--    unaffected, so all server routes keep working.
alter table public.site_settings enable row level security;
alter table public.site_settings force  row level security;
