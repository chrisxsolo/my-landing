-- Verify 20261014000001_ai_email_assistant.

do $$
declare
  missing text;
  bad int;
begin
  select string_agg(t, ', ') into missing
  from unnest(array['ai_writing_rules', 'ai_approved_examples', 'ai_email_usage']) as t
  where not exists (
    select 1 from information_schema.tables i
    where i.table_schema = 'public' and i.table_name = t
  );
  if missing is not null then
    raise exception 'missing tables: %', missing;
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'ai_writing_rules_rule_key_idx'
  ) then
    raise exception 'ai_writing_rules_rule_key_idx is missing — duplicate rules would be storable';
  end if;

  -- A rule that reaches the prompt must be an approved style rule. Anything
  -- approved in another category would be silently ignored by the prompt
  -- builder, which is a data bug worth failing on.
  select count(*) into bad
  from public.ai_writing_rules
  where status = 'approved' and category not in ('style', 'policy');
  if bad > 0 then
    raise exception '% approved rules have an unusable category', bad;
  end if;

  raise notice 'ai_email_assistant verified OK';
end $$;
