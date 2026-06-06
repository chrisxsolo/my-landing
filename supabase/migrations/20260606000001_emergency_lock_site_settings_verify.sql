-- VERIFICATION for the site_settings + gmail_credentials lockdown.
-- Run in the Supabase SQL editor. NEGATIVE checks must error/return 0;
-- POSITIVE checks (service role) must succeed. Do NOT print token values.

-- ── NEGATIVE: anon cannot read site_settings (incl. any gmail_tokens row) ──
begin;
set local role anon;
-- Expect: permission denied / RLS → 0 rows or error.
select count(*) as anon_site_settings_visible from public.site_settings;
rollback;

-- ── NEGATIVE: anon cannot write site_settings ──
begin;
set local role anon;
-- Expect: ERROR (permission denied / RLS).
insert into public.site_settings (key, value) values ('attack', 'x');
rollback;

-- ── NEGATIVE: anon cannot touch gmail_credentials at all ──
begin;
set local role anon;
select count(*) as anon_gmail_creds_visible from public.gmail_credentials; -- expect error/0
rollback;

-- ── NEGATIVE: authenticated (non-admin) cannot read site_settings/gmail_credentials ──
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","email":"nobody@example.com"}';
select count(*) as authed_site_settings_visible from public.site_settings;     -- expect 0/error
select count(*) as authed_gmail_creds_visible  from public.gmail_credentials;   -- expect 0/error
rollback;

-- ── POSITIVE: service role still works (run via the service-role connection) ──
-- (Outside a SET ROLE block.) Confirm counts are non-zero / table reachable.
-- select count(*) from public.site_settings;     -- expect 41
-- select count(*) from public.gmail_credentials;  -- expect 0 or 1 (after reconnect)

-- ── Secret sweep: confirm no leftover token-shaped secrets remain in settings ──
-- (Run as service role. Review output manually; do not paste results anywhere.)
-- select key from public.site_settings
--   where key ilike '%token%' or key ilike '%secret%' or key ilike '%password%'
--      or key ilike '%api_key%' or value ilike '%refresh_token%';
