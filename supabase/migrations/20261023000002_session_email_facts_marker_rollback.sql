alter table public.photography_sessions
  drop column if exists email_facts_thread_ids,
  drop column if exists email_facts_last_message_id,
  drop column if exists email_facts_last_message_at,
  drop column if exists email_facts_extracted_at;
