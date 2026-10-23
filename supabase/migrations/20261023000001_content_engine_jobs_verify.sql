-- Verify for 20261023000001_content_engine_jobs.
do $$
declare
  v_session uuid;
  v_job uuid;
  v_created boolean;
  v_second uuid;
  v_second_created boolean;
  v_claimed uuid;
  v_attempts int;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'content_engine_jobs'
  ) then
    raise exception 'content_engine_jobs table missing';
  end if;

  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'content_engine_jobs'
      and column_name in (
        'id','photography_session_id','package_id','status','phase','attempts',
        'steps_run','photos_total','photos_done','types_total','types_done',
        'soft_errors','last_error','lease_expires_at','created_at','started_at',
        'finished_at','updated_at'
      )
  ) <> 18 then
    raise exception 'content_engine_jobs is missing expected columns';
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'content_engine_jobs_one_active_per_session'
  ) then
    raise exception 'one-active-job-per-session index missing';
  end if;

  -- The worker and the admin routes run as service_role; without this grant the
  -- queue is unwritable (and locally the recreated public schema carries no
  -- default privileges, so it must be granted by this migration).
  if not has_table_privilege('service_role', 'public.content_engine_jobs', 'INSERT')
     or not has_table_privilege('service_role', 'public.content_engine_jobs', 'UPDATE')
     or not has_table_privilege('service_role', 'public.content_engine_jobs', 'SELECT') then
    raise exception 'service_role cannot write content_engine_jobs';
  end if;
  if has_table_privilege('anon', 'public.content_engine_jobs', 'SELECT') then
    raise exception 'anon must not read content_engine_jobs';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'content_engine_jobs'
  ) then
    raise exception 'content_engine_jobs must have RLS enabled and forced';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enqueue_content_engine_job'
  ) then
    raise exception 'enqueue_content_engine_job missing';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_content_engine_job'
  ) then
    raise exception 'claim_content_engine_job missing';
  end if;

  -- Behavioural check on a throwaway session, rolled back at the end.
  insert into public.photography_sessions (service_type, ai_processing_allowed)
  values ('grads', true) returning id into v_session;

  select e.job_id, e.created into v_job, v_created
    from public.enqueue_content_engine_job(v_session) e;
  if v_job is null or not v_created then
    raise exception 'first enqueue should create a job';
  end if;

  -- Second enqueue must adopt the live job, never start a parallel run.
  select e.job_id, e.created into v_second, v_second_created
    from public.enqueue_content_engine_job(v_session) e;
  if v_second <> v_job or v_second_created then
    raise exception 'second enqueue should adopt the existing job';
  end if;

  -- A queued claim must not consume an attempt.
  select j.id, j.attempts into v_claimed, v_attempts
    from public.claim_content_engine_job(120, 5) j;
  if v_claimed <> v_job then
    raise exception 'claim did not return the queued job';
  end if;
  if v_attempts <> 0 then
    raise exception 'claiming a queued job must not consume an attempt (got %)', v_attempts;
  end if;

  -- An unexpired lease cannot be stolen.
  if exists (select 1 from public.claim_content_engine_job(120, 5)) then
    raise exception 'a live lease must not be claimable';
  end if;

  -- An expired lease is reclaimable, and that DOES consume an attempt.
  update public.content_engine_jobs
     set lease_expires_at = now() - interval '1 minute' where id = v_job;
  select j.attempts into v_attempts from public.claim_content_engine_job(120, 5) j;
  if v_attempts <> 1 then
    raise exception 'reclaiming an expired lease should consume an attempt (got %)', v_attempts;
  end if;

  -- Exhausted attempts retire the job instead of looping.
  update public.content_engine_jobs
     set attempts = 5, lease_expires_at = now() - interval '1 minute' where id = v_job;
  perform public.claim_content_engine_job(120, 5);
  if (select status from public.content_engine_jobs where id = v_job) <> 'failed' then
    raise exception 'a job past max attempts should be retired as failed';
  end if;

  -- With no live job, a fresh enqueue is allowed again.
  select e.created into v_created from public.enqueue_content_engine_job(v_session) e;
  if not v_created then
    raise exception 'enqueue after a terminal job should create a new one';
  end if;

  delete from public.photography_sessions where id = v_session;

  raise notice 'content_engine_jobs OK';
end $$;
