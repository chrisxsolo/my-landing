-- Auto-fill session facts from the client's email conversation.
--
-- Additive marker columns on the existing session row — no new table. They
-- record which Gmail thread(s) an extraction read and how far it read, so the
-- workspace can tell "the conversation has moved on" from metadata alone
-- (no AI call), and a thread the photographer disambiguated once stays
-- disambiguated. No email content is ever stored here.
alter table public.photography_sessions
  add column if not exists email_facts_thread_ids text[] null,
  add column if not exists email_facts_last_message_id text null,
  add column if not exists email_facts_last_message_at timestamptz null,
  add column if not exists email_facts_extracted_at timestamptz null;

comment on column public.photography_sessions.email_facts_thread_ids is
  'Gmail thread ids the last fact extraction read (ids only, never content).';
comment on column public.photography_sessions.email_facts_last_message_id is
  'Gmail message id of the newest message the last extraction saw.';
comment on column public.photography_sessions.email_facts_last_message_at is
  'Timestamp of that newest message — the baseline for the new-mail indicator.';
comment on column public.photography_sessions.email_facts_extracted_at is
  'When facts were last extracted from the email conversation.';
