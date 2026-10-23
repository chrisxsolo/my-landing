-- The flag exists, is not null and defaults to false (no existing row is
-- retroactively treated as a hand-picked thread).
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'photography_sessions'
  and column_name = 'email_facts_thread_pinned';
