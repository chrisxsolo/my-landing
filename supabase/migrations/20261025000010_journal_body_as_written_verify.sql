-- Verify for 20261025000010_journal_body_as_written. Read-only. Tolerant of
-- later replacements of the publish RPC: it only asserts the append is gone.
do $$
begin
  if pg_get_functiondef('public.publish_session_content_item(uuid)'::regprocedure)
       like '%Keep exploring%' then
    raise exception 'publish RPC still appends a Keep exploring section';
  end if;
  if exists (select 1 from public.blog_posts
             where body ~ '\n\n## Keep exploring\n(\n- \[[^]]*\]\([^)\s]*\))+\s*$') then
    raise exception 'a published post still ends with an appended Keep exploring list';
  end if;
end $$;
