-- Minute-level production trigger for the publication worker (2026-11-06).
--
-- Why pg_cron and not the existing tickers: the Vercel team is on the Hobby
-- plan (daily cron only), and the GitHub Actions "every 5 minutes" workflow
-- actually fires every 3–8 HOURS in this repository (schedule lag on a quiet
-- repo). A scheduled post has to go live in its chosen minute, so the database
-- itself ticks the worker: pg_cron runs every minute and pg_net makes one
-- bearer-authenticated GET to the canonical production host. The worker route
-- does the actual work and is idempotent, so a duplicate or missed tick is
-- harmless (missed work is caught up on the next tick).
--
-- The secret and the URL live in Supabase Vault, never in this file. They are
-- set once with set_publication_worker_credentials() (service role only). With
-- no credentials stored, the tick is a no-op — fail closed.
--
-- Local stacks preload pg_cron as well, so this applies in tests too; the
-- credentials are simply absent there and nothing is called.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-time setup (and rotation) of the Vault entries. SECURITY DEFINER so the
-- service role can call it through PostgREST without Vault being exposed.
create or replace function public.set_publication_worker_credentials(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Pinned to this site's hosts: a service-role caller can never point the
  -- tick (and its bearer) at another domain.
  if p_url is null or p_url !~ '^https://(www\.)?soloxsnaps\.com/api/content-publishing/worker$' then
    raise exception 'url must be the canonical soloxsnaps.com worker route';
  end if;
  if p_secret is null or length(p_secret) < 16 then
    raise exception 'secret is too short';
  end if;

  select id into v_id from vault.secrets where name = 'publication_worker_url';
  if v_id is null then perform vault.create_secret(p_url, 'publication_worker_url', 'Canonical URL pg_cron ticks for scheduled publishing');
  else perform vault.update_secret(v_id, p_url); end if;

  select id into v_id from vault.secrets where name = 'publication_worker_cron_secret';
  if v_id is null then perform vault.create_secret(p_secret, 'publication_worker_cron_secret', 'Bearer secret for the publication worker (= CRON_SECRET)');
  else perform vault.update_secret(v_id, p_secret); end if;
end;
$$;

-- The tick. Returns the pg_net request id, or null when nothing was sent.
create or replace function public.tick_publication_worker()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text; v_secret text; v_request bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'publication_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'publication_worker_cron_secret';
  if v_url is null or v_secret is null then
    return null; -- not configured: never call anything
  end if;
  select net.http_get(
    url := v_url,
    headers := jsonb_build_object('authorization', 'Bearer ' || v_secret, 'x-publication-tick', 'pg_cron'),
    timeout_milliseconds := 55000
  ) into v_request;
  return v_request;
end;
$$;

revoke all on function public.set_publication_worker_credentials(text, text) from public, anon, authenticated;
grant execute on function public.set_publication_worker_credentials(text, text) to service_role;
revoke all on function public.tick_publication_worker() from public, anon, authenticated;

-- cron.schedule(name, …) replaces a job of the same name, so re-running this
-- migration never creates a second ticker.
select cron.schedule('publication-worker-tick', '* * * * *', $$select public.tick_publication_worker()$$);
