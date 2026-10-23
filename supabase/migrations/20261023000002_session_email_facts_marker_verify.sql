-- Every marker column exists with the expected type, and the table's
-- service-role-only access is unchanged.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'photography_sessions'
  and column_name in (
    'email_facts_thread_ids', 'email_facts_last_message_id',
    'email_facts_last_message_at', 'email_facts_extracted_at')
order by column_name;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'photography_sessions'
order by grantee, privilege_type;
