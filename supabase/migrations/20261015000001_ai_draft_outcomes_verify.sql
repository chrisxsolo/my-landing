-- Verify for 20261015000001_ai_draft_outcomes.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_draft_outcomes'
  ) then
    raise exception 'ai_draft_outcomes table missing';
  end if;

  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_draft_outcomes'
      and column_name in (
        'id','created_at','inquiry_id','ai_words','sent_words','similarity',
        'sent_unchanged','factual_edits','stylistic_edits','edit_kinds','was_regenerated'
      )
  ) <> 11 then
    raise exception 'ai_draft_outcomes is missing expected columns';
  end if;

  raise notice 'ai_draft_outcomes OK';
end $$;
