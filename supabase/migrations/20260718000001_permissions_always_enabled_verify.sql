-- Verify: column defaults are true and no enabled-eligible rows remain off.
select
  (select column_default from information_schema.columns
    where table_name = 'photography_sessions' and column_name = 'marketing_permission')
    as marketing_default,
  (select column_default from information_schema.columns
    where table_name = 'photography_sessions' and column_name = 'ai_processing_allowed')
    as ai_default,
  (select count(*) from photography_sessions
    where marketing_permission = false and marketing_permission_revoked_at is null)
    as marketing_still_off,
  (select count(*) from photography_sessions where ai_processing_allowed = false)
    as ai_still_off;
