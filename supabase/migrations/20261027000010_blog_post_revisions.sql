-- Revision history for published blog / journal posts.
--
-- A photo that slipped into a public post could be removed, but nothing kept
-- the state the post was in before any edit, so a mistaken edit or a wrong
-- "remove" had no way back. This table stores the OLD row of blog_posts on
-- every update and delete, written by a trigger so every writer (the admin
-- API, the Content Engine publish RPC, direct SQL) is covered. Restoring a
-- revision is an ordinary update, which the trigger records too, so a restore
-- can itself be undone.
--
-- Only server code with the service role reads or restores revisions
-- (app/api/admin/blog-posts/revisions). Same lockdown as photo_sync_runs.
-- Idempotent and non-destructive: safe to re-run.

create table if not exists public.blog_post_revisions (
  id          bigserial primary key,
  post_id     bigint      not null,
  operation   text        not null check (operation in ('update', 'delete')),
  snapshot    jsonb       not null,
  changed_at  timestamptz not null default now()
);

create index if not exists blog_post_revisions_post_changed_idx
  on public.blog_post_revisions (post_id, changed_at desc);

-- Runs as its owner (bypasses RLS on the revisions table) so any role that is
-- allowed to update blog_posts leaves a revision behind. A no-op update (same
-- row written back) records nothing.
create or replace function public.record_blog_post_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;
  insert into public.blog_post_revisions (post_id, operation, snapshot)
  values (old.id, lower(tg_op), to_jsonb(old));
  return coalesce(new, old);
end;
$$;

revoke all on function public.record_blog_post_revision() from public, anon, authenticated;

drop trigger if exists blog_posts_record_revision on public.blog_posts;
create trigger blog_posts_record_revision
  after update or delete on public.blog_posts
  for each row execute function public.record_blog_post_revision();

revoke all on public.blog_post_revisions from anon, authenticated;
grant all on public.blog_post_revisions to service_role;
grant usage, select on sequence public.blog_post_revisions_id_seq to service_role;
alter table public.blog_post_revisions enable row level security;
alter table public.blog_post_revisions force row level security;
