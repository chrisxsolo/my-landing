-- ─────────────────────────────────────────────────────────────────────────────
-- Availability privacy — PART 2 of 2: lock down the base table  (BREAKING ORDER)
--
-- ⚠️  Apply this ONLY AFTER the matching app code is deployed. It removes the
--     public anon key's access to the `availability` base table. If the old
--     code (which used the anon key for admin writes + the booking calendar) is
--     still live when this runs, the admin panel and booking page will break.
--
-- After deploy, the data paths are:
--   • Admin reads/writes  → /api/admin/availability        (service role, requireAdmin)
--   • Conversation upsert → /api/admin/availability         (service role, requireAdmin)
--   • Public booking page → public.availability_public view (anon/authenticated SELECT)
--   • Server pages / APIs → base table via service role     (BYPASSRLS — unaffected)
--
-- service_role has BYPASSRLS and keeps its grants, so all server routes and the
-- availability_public view continue to work. anon/authenticated lose all direct
-- access to the base table.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Remove the broad table-level grants the public roles currently hold.
revoke all on public.availability from anon, authenticated;

-- 2. Enable RLS with no policies for anon/authenticated → default-deny on the
--    base table for those roles (belt-and-suspenders alongside the revoke).
alter table public.availability enable row level security;
