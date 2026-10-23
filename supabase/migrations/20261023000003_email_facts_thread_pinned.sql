-- Only a thread the photographer picked by hand should be sticky.
--
-- The first live run recorded the thread it CHOSE in email_facts_thread_ids,
-- and resolveSessionContact treated that like an explicitly linked thread —
-- so a wrong automatic choice became permanent and every later run repeated
-- it. The marker still records what was read (the freshness check needs it);
-- this flag separates "what we read last time" from "what you told us to read".
alter table public.photography_sessions
  add column if not exists email_facts_thread_pinned boolean not null default false;

comment on column public.photography_sessions.email_facts_thread_pinned is
  'True only when the photographer chose email_facts_thread_ids by hand; an automatic choice is never re-pinned.';
