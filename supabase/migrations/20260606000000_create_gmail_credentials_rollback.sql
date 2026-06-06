-- ROLLBACK for 20260606000000_create_gmail_credentials.sql
--
-- WARNING: dropping this table loses the stored Gmail connection. Prefer simply
-- reconnecting Gmail over restoring tokens. Do NOT copy tokens back into
-- site_settings (that is the exposure this migration fixed).

drop table if exists public.gmail_credentials;
