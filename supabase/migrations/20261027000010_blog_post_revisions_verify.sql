-- Verify for 20261027000010_blog_post_revisions (read-only: no writes, no deletes).
do $$
begin
  if to_regclass('public.blog_post_revisions') is null then
    raise exception 'blog_post_revisions is missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'blog_post_revisions_post_changed_idx'
  ) then
    raise exception 'blog_post_revisions_post_changed_idx is missing';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_blog_post_revision' and p.prosecdef
  ) then
    raise exception 'record_blog_post_revision() is missing or not security definer';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.blog_posts'::regclass and tgname = 'blog_posts_record_revision' and not tgisinternal
  ) then
    raise exception 'blog_posts_record_revision trigger is missing';
  end if;
  if has_table_privilege('anon', 'public.blog_post_revisions', 'SELECT') then
    raise exception 'anon must not read blog_post_revisions';
  end if;
  if has_table_privilege('authenticated', 'public.blog_post_revisions', 'SELECT') then
    raise exception 'authenticated must not read blog_post_revisions';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.blog_post_revisions'::regclass) then
    raise exception 'row level security is not forced on blog_post_revisions';
  end if;
end $$;
