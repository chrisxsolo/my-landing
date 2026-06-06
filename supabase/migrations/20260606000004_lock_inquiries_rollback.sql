-- ROLLBACK for 20260606000004_lock_inquiries.sql
-- WARNING: re-opens direct anon/authenticated Data API access to client PII.

alter table public.inquiries no force row level security;
alter table public.inquiries disable row level security;

grant all privileges on table public.inquiries to anon, authenticated;
