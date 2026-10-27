-- Rollback for 20261027000010_blog_post_revisions.
-- Stops recording revisions and removes the history. blog_posts itself is
-- untouched. Run only if the history is no longer wanted: it cannot be rebuilt.
drop trigger if exists blog_posts_record_revision on public.blog_posts;
drop function if exists public.record_blog_post_revision();
drop table if exists public.blog_post_revisions;
