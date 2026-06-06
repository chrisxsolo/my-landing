-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1 RLS LOCKDOWN  (low-risk: no app changes required)
--
-- Covers tables that either (a) are read by the PUBLIC grad-guide client
-- components via the anon key (need a narrow anon SELECT), or (b) are touched
-- ONLY by server-side service-role code today (safe to fully deny anon/auth).
--
-- service_role has BYPASSRLS, so every app/api/* route keeps working.
--
-- NOTE: `availability` base-table lockdown is already authored in
-- 20260604000001_availability_lockdown.sql (apply that pair) — intentionally
-- NOT duplicated here to avoid conflicting statements.
--
-- Apply AFTER reviewing; verify with 20260606000002_phase1_rls_lockdown_verify.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── GROUP A: public grad-guide content — anon SELECT only, no writes ─────────
-- These rows are all public content (no draft flag). Revoke write grants from
-- the public roles, keep SELECT, and gate via an explicit SELECT policy.
revoke insert, update, delete on public.grad_photos    from anon, authenticated;
revoke insert, update, delete on public.grad_poses     from anon, authenticated;
revoke insert, update, delete on public.grad_outfits   from anon, authenticated;
revoke insert, update, delete on public.grad_prep_tips from anon, authenticated;
revoke insert, update, delete on public.location_spots from anon, authenticated;

alter table public.grad_photos    enable row level security;
alter table public.grad_poses     enable row level security;
alter table public.grad_outfits   enable row level security;
alter table public.grad_prep_tips enable row level security;
alter table public.location_spots enable row level security;

create policy grad_photos_public_read    on public.grad_photos    for select to anon, authenticated using (true);
create policy grad_poses_public_read     on public.grad_poses     for select to anon, authenticated using (true);
create policy grad_outfits_public_read   on public.grad_outfits   for select to anon, authenticated using (true);
create policy grad_prep_tips_public_read on public.grad_prep_tips for select to anon, authenticated using (true);
create policy location_spots_public_read on public.location_spots for select to anon, authenticated using (true);
-- No INSERT/UPDATE/DELETE policies → writes denied for anon/authenticated.
-- (Admin management of these tables moves to server routes in Phase 2.)

-- ── GROUP B: server-only internal tables — default-deny for anon/auth ────────
revoke all on public.vault_notes          from anon, authenticated;
revoke all on public.chat_conversations   from anon, authenticated;
revoke all on public.chat_messages        from anon, authenticated;
revoke all on public.ai_training_sessions from anon, authenticated;
revoke all on public.link_clicks          from anon, authenticated;
revoke all on public.link_views           from anon, authenticated;

alter table public.vault_notes          enable row level security;
alter table public.chat_conversations   enable row level security;
alter table public.chat_messages        enable row level security;
alter table public.ai_training_sessions enable row level security;
alter table public.link_clicks          enable row level security;
alter table public.link_views           enable row level security;

-- FORCE on the most sensitive internal content.
alter table public.vault_notes force row level security;
-- No policies on Group B → only service_role (BYPASSRLS) can access.

-- ── professional_availability: drop the broad USING(true) policies + deny ────
drop policy if exists "public read"  on public.professional_availability;
drop policy if exists "service write" on public.professional_availability;
revoke all on public.professional_availability from anon, authenticated;
-- RLS already enabled on this table; leave enabled, now with NO policies.
