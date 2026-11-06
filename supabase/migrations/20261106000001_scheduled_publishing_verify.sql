-- Verify for 20261106000001_scheduled_publishing (read-only).
do $$
declare t text; fn text;
begin
  foreach t in array array['blog_post_drafts', 'publication_schedules', 'publication_worker_runs'] loop
    if to_regclass('public.' || t) is null then raise exception '% is missing', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT') then raise exception 'anon must not read %', t; end if;
    if has_table_privilege('authenticated', 'public.' || t, 'SELECT') then raise exception 'authenticated must not read %', t; end if;
    if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'row level security is not forced on %', t;
    end if;
  end loop;
  foreach t in array array['publication_schedules_active_item_idx', 'publication_schedules_active_draft_idx', 'publication_schedules_due_idx'] loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = t) then
      raise exception 'index % is missing', t;
    end if;
  end loop;
  foreach fn in array array['claim_publication_schedules', 'claim_publication_schedule_now',
                            'publish_scheduled_content_item', 'publish_blog_post_draft', 'publication_trigger_status'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = fn and p.prosecdef) then
      raise exception '%() is missing or not security definer', fn;
    end if;
  end loop;
  if not exists (select 1 from storage.buckets where id = 'blog-drafts' and public = false) then
    raise exception 'blog-drafts bucket missing or public';
  end if;
  if exists (select 1 from information_schema.role_routine_grants
             where routine_schema = 'public' and routine_name = 'publish_blog_post_draft' and grantee in ('anon', 'authenticated')) then
    raise exception 'anon/authenticated must not execute publish_blog_post_draft';
  end if;
end $$;
