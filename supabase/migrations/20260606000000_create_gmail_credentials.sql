-- ─────────────────────────────────────────────────────────────────────────────
-- Gmail OAuth credentials — dedicated private table  (INCIDENT REMEDIATION)
--
-- Moves the raw Google OAuth access/refresh tokens OUT of the general-purpose
-- `site_settings` table (where RLS-off exposed them to the anon key) into a
-- dedicated, locked-down table that only the service-role client can touch.
--
-- Apply this BEFORE locking site_settings and BEFORE reconnecting Gmail.
-- service_role has BYPASSRLS, so server code (lib/gmailTokens.ts, the OAuth
-- callback, the status route) keeps working. anon/authenticated get NOTHING.
--
-- Singleton table: a single row (id = 1) holds the current connection.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gmail_credentials (
  id            smallint primary key default 1,
  access_token  text,
  refresh_token text,
  expiry_date   bigint,          -- epoch milliseconds
  email         text,
  updated_at    timestamptz not null default now(),
  constraint gmail_credentials_singleton check (id = 1)
);

-- Default-deny: no anon/authenticated access at all.
revoke all on public.gmail_credentials from anon, authenticated;

alter table public.gmail_credentials enable row level security;
alter table public.gmail_credentials force  row level security;
-- No policies → only service_role (BYPASSRLS) can read/write. The browser can
-- never see the refresh token. FORCE RLS also subjects the table owner role.
