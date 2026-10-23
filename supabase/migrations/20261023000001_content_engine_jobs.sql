-- ─────────────────────────────────────────────────────────────────────────────
-- content_engine_jobs — durable queue for a content run.
--
-- Until now the browser WAS the orchestrator: the admin tab called analyze,
-- then package, then generate, in order, and closing the tab abandoned the run
-- half-finished. This table moves the run server-side so a worker can finish it
-- while nobody is watching.
--
-- One row is one run of the pipeline for one session. The phase column is the
-- cursor (analyze → curate → package → generate → done); the worker executes
-- ONE step per loop and writes its progress back, so an invocation can die at
-- any point and the next one resumes from the same row.
--
-- Duplicate protection is layered and none of it lives here alone:
--   1. the partial unique index below — at most one queued/running job per
--      session, so pressing the button twice cannot start two runs;
--   2. create_content_package already refuses a second active package;
--   3. session_content_items.idempotency_key is unique and generation upserts
--      with ignoreDuplicates, so a replayed generate step cannot write a second
--      journal post.
--
-- attempts is only consumed when a crashed run is reclaimed (an expired lease),
-- NOT when a healthy worker hands the job back as 'queued' to continue in a
-- fresh invocation — otherwise a long shoot would exhaust its own retries.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.content_engine_jobs (
  id                      uuid primary key default gen_random_uuid(),
  photography_session_id  uuid not null
    references public.photography_sessions(id) on delete cascade,

  -- Set once the run adopts or creates a package, so a resumed run never
  -- generates into a different one.
  package_id              uuid
    references public.session_content_packages(id) on delete set null,

  status                  text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','cancelled')),
  phase                   text not null default 'analyze'
    check (phase in ('analyze','curate','package','generate','done')),

  -- Crash recoveries, not continuations (see the header note).
  attempts                int not null default 0,
  -- Monotonic count of executed steps; the worker caps it so a pathological
  -- loop can never bill forever.
  steps_run               int not null default 0,

  -- Progress counters, for the "12 of 20 photos" line in the workspace.
  photos_total            int not null default 0,
  photos_done             int not null default 0,
  types_total             int not null default 0,
  types_done              int not null default 0,

  -- Non-fatal problems (a failed curation pass, one failed content type) that
  -- the run carried on past. Fatal ones land in last_error.
  soft_errors             jsonb not null default '[]'::jsonb,
  last_error              text,

  -- Held by the worker that is executing the job; an expired lease is
  -- reclaimable, which is what makes a killed invocation recoverable.
  lease_expires_at        timestamptz,

  created_at              timestamptz not null default now(),
  started_at              timestamptz,
  finished_at             timestamptz,
  updated_at              timestamptz not null default now()
);

-- At most one live run per session.
create unique index if not exists content_engine_jobs_one_active_per_session
  on public.content_engine_jobs (photography_session_id)
  where status in ('queued','running');

create index if not exists content_engine_jobs_claimable_idx
  on public.content_engine_jobs (status, created_at);

create index if not exists content_engine_jobs_session_idx
  on public.content_engine_jobs (photography_session_id, created_at desc);

comment on table public.content_engine_jobs is
  'Durable queue for background content runs. One row = one pipeline run for one session.';
comment on column public.content_engine_jobs.attempts is
  'Crash recoveries only — a clean hand-off back to queued does not consume one.';

drop trigger if exists content_engine_jobs_set_updated_at on public.content_engine_jobs;
create trigger content_engine_jobs_set_updated_at
before update on public.content_engine_jobs
for each row execute function public.set_updated_at();

-- Same posture as the rest of the engine tables (spec §5): only the service
-- role — i.e. the worker and the admin routes — ever sees this queue.
revoke all on public.content_engine_jobs from anon, authenticated;
grant all on public.content_engine_jobs to service_role;
alter table public.content_engine_jobs enable row level security;
alter table public.content_engine_jobs force row level security;
-- Intentionally no anon/authenticated policies.

-- ── enqueue_content_engine_job ──────────────────────────────────────────────
-- Idempotent enqueue: returns the live job when one already exists, so a
-- double-click (or a retry of the HTTP request) can never start a second run.
-- ai_processing_allowed is enforced HERE, server-side, like the analysis claim.
create or replace function public.enqueue_content_engine_job(p_session_id uuid)
returns table (job_id uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
  v_existing uuid;
  v_new uuid;
begin
  select s.ai_processing_allowed into v_allowed
    from public.photography_sessions s where s.id = p_session_id;
  if v_allowed is null then
    raise exception 'photography session not found';
  end if;
  if not v_allowed then
    raise exception 'ai processing is not allowed for this session';
  end if;

  select j.id into v_existing from public.content_engine_jobs j
   where j.photography_session_id = p_session_id
     and j.status in ('queued','running')
   limit 1;
  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  begin
    insert into public.content_engine_jobs (photography_session_id)
    values (p_session_id)
    returning id into v_new;
    return query select v_new, true;
  exception when unique_violation then
    -- a concurrent enqueue won the index; adopt its job
    select j.id into v_existing from public.content_engine_jobs j
     where j.photography_session_id = p_session_id
       and j.status in ('queued','running')
     limit 1;
    return query select v_existing, false;
  end;
end;
$$;

-- ── claim_content_engine_job ────────────────────────────────────────────────
-- Atomic claim of the oldest runnable job: queued, or running with an expired
-- lease (a worker that died mid-run). FOR UPDATE SKIP LOCKED means two workers
-- never take the same job. Jobs that have burned through their attempts are
-- retired as failed rather than looping forever.
create or replace function public.claim_content_engine_job(
  p_lease_seconds int default 120,
  p_max_attempts int default 5
) returns setof public.content_engine_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.content_engine_jobs
     set status = 'failed',
         last_error = coalesce(last_error, 'run exceeded the maximum number of attempts'),
         finished_at = now(),
         lease_expires_at = null,
         updated_at = now()
   where status in ('queued','running')
     and attempts >= p_max_attempts
     and (lease_expires_at is null or lease_expires_at <= now());

  return query
  update public.content_engine_jobs j
     set status = 'running',
         -- only a stolen (expired) lease counts as a retry
         attempts = j.attempts + case when j.status = 'running' then 1 else 0 end,
         started_at = coalesce(j.started_at, now()),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where j.id = (
     select j2.id from public.content_engine_jobs j2
      where (j2.status = 'queued'
             or (j2.status = 'running' and j2.lease_expires_at <= now()))
        and j2.attempts < p_max_attempts
      order by j2.created_at
      limit 1
      for update skip locked
   )
   returning j.*;
end;
$$;

revoke all on function public.enqueue_content_engine_job(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_content_engine_job(uuid) to service_role;
revoke all on function public.claim_content_engine_job(int, int)
  from public, anon, authenticated;
grant execute on function public.claim_content_engine_job(int, int) to service_role;
