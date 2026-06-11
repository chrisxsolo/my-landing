-- Analysis + generation claim/record RPCs (spec §8.1 step 1+4-5, §8.2).
-- security definer with pinned search_path; EXECUTE revoked from
-- PUBLIC/anon/authenticated (spec §5). Local-only until the Plan-6 gate.

-- ── claim_photos_for_analysis ───────────────────────────────────────────────
-- Atomic claim: only pending/failed photos or expired processing leases are
-- claimable; unexpired claims cannot be stolen. ai_processing_allowed is
-- enforced HERE (server-side gate, spec §3.1), not just in the route.
create or replace function public.claim_photos_for_analysis(
  p_session_id uuid,
  p_photo_ids uuid[] default null,      -- null = any eligible photo
  p_max_photos int default 4,
  p_lease_seconds int default 180
) returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  select s.ai_processing_allowed into v_allowed
    from public.photography_sessions s where s.id = p_session_id;
  if v_allowed is null then raise exception 'photography session not found'; end if;
  if not v_allowed then
    raise exception 'ai processing is not allowed for this session';
  end if;

  return query
  with claimed as (
    update public.session_photos sp
       set analysis_status = 'processing',
           analysis_started_at = now(),
           analysis_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           analysis_attempt = sp.analysis_attempt + 1,
           analysis_error = null
     where sp.id in (
       select sp2.id from public.session_photos sp2
        where sp2.photography_session_id = p_session_id
          and not sp2.excluded
          and (p_photo_ids is null or sp2.id = any (p_photo_ids))
          and (sp2.analysis_status in ('pending','failed')
               or (sp2.analysis_status = 'processing'
                   and sp2.analysis_lease_expires_at <= now()))
        order by sp2.sort_order, sp2.created_at
        limit greatest(p_max_photos, 0)
        for update skip locked
     )
     returning sp.id, sp.sort_order, sp.created_at
  )
  select c.id from claimed c
  order by c.sort_order, c.created_at;
end;
$$;

-- ── record_analysis_batch ───────────────────────────────────────────────────
-- Batch-atomic commit (spec §8.1 step 4): every photo must belong to the
-- session, be processing, and hold an unexpired lease — ANY violation aborts
-- the whole batch ("violations fail only the affected batch"). Raw payloads
-- over 64KB are replaced by a truncation marker (size-capped, spec §3.2).
create or replace function public.record_analysis_batch(
  p_session_id uuid,
  p_results jsonb
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r jsonb;
  v_id uuid;
  v_photo public.session_photos%rowtype;
  v_fields jsonb;
  v_payload jsonb;
  v_count int := 0;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array'
     or jsonb_array_length(p_results) = 0 then
    raise exception 'p_results must be a non-empty array';
  end if;

  for v_r in select * from jsonb_array_elements(p_results) loop
    v_id := (v_r->>'session_photo_id')::uuid;
    select * into v_photo from public.session_photos where id = v_id for update;
    if not found or v_photo.photography_session_id is distinct from p_session_id then
      raise exception 'photo % is not part of session % — batch rejected', v_id, p_session_id;
    end if;
    if v_photo.analysis_status <> 'processing'
       or v_photo.analysis_lease_expires_at is null
       or v_photo.analysis_lease_expires_at <= now() then
      raise exception 'lease expired or not held for photo % — batch rejected', v_id;
    end if;

    if coalesce((v_r->>'success')::boolean, false) then
      v_fields := coalesce(v_r->'fields', '{}'::jsonb);
      v_payload := case
        when v_r ? 'payload' and length((v_r->'payload')::text) <= 65536 then v_r->'payload'
        when v_r ? 'payload' then jsonb_build_object('truncated', true, 'note', 'payload exceeded 64KB cap')
        else v_photo.analysis_payload
      end;
      update public.session_photos set
        analysis_status = 'completed',
        analyzed_at = now(),
        analysis_error = null,
        analysis_lease_expires_at = null,
        analysis_model = v_r->>'analysis_model',
        analysis_version = v_r->>'analysis_version',
        alt_text = coalesce(v_fields->>'alt_text', alt_text),
        title = coalesce(v_fields->>'title', title),
        description = coalesce(v_fields->>'description', description),
        tags = case when v_fields ? 'tags'
                    then array(select jsonb_array_elements_text(v_fields->'tags'))
                    else tags end,
        quality_score = coalesce((v_fields->>'quality_score')::int, quality_score),
        suggested_category = coalesce(v_fields->>'suggested_category', suggested_category),
        destination_recommendations = coalesce(v_fields->'destination_recommendations',
                                               destination_recommendations),
        analysis_payload = v_payload
      where id = v_id;
    else
      update public.session_photos set
        analysis_status = 'failed',
        analysis_error = left(coalesce(v_r->>'error', 'unknown analysis error'), 2000),
        analysis_lease_expires_at = null,
        analysis_model = v_r->>'analysis_model',
        analysis_version = v_r->>'analysis_version'
      where id = v_id;
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── claim_generation_type ───────────────────────────────────────────────────
-- Atomic per-type claim via jsonb_set on generation_settings.progress[type]
-- (spec §8.2): row-locks the package, never read-modify-writes the whole
-- object, never touches other types' entries or usage. Completed types and
-- live claims return false (no steal); pending/failed/expired claim and
-- increment attempt. ai_processing_allowed enforced server-side here too.
create or replace function public.claim_generation_type(
  p_package_id uuid,
  p_content_type text,
  p_lease_seconds int default 180
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pkg public.session_content_packages%rowtype;
  v_allowed boolean;
  v_entry jsonb;
begin
  select * into v_pkg from public.session_content_packages
   where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if v_pkg.archived_at is not null then raise exception 'package is archived'; end if;

  select s.ai_processing_allowed into v_allowed
    from public.photography_sessions s where s.id = v_pkg.photography_session_id;
  if not coalesce(v_allowed, false) then
    raise exception 'ai processing is not allowed for this session';
  end if;

  v_entry := v_pkg.generation_settings->'progress'->p_content_type;
  if v_entry is null then
    raise exception 'content type % is not selected for this package', p_content_type;
  end if;

  if not (v_entry->>'status' in ('pending','failed')
          or (v_entry->>'status' = 'processing'
              and coalesce((v_entry->>'lease_expires_at')::timestamptz,
                           'epoch'::timestamptz) <= now())) then
    return false;
  end if;

  update public.session_content_packages
     set generation_settings = jsonb_set(
           generation_settings,
           array['progress', p_content_type],
           v_entry || jsonb_build_object(
             'status', 'processing',
             'attempt', coalesce((v_entry->>'attempt')::int, 0) + 1,
             'lease_started_at', to_jsonb(now()),
             'lease_expires_at', to_jsonb(now() + make_interval(secs => p_lease_seconds)),
             'error', null))
   where id = p_package_id;
  return true;
end;
$$;

-- ── record_generation_result ────────────────────────────────────────────────
-- Writes ONE type's terminal progress entry atomically with its usage
-- (spec §11: "written atomically with that type's progress"), then recomputes
-- the package status (spec §8.2): any pending/processing → 'generating';
-- all completed|skipped → 'ready'; otherwise (≥1 failed, all terminal)
-- → 'needs_attention'. 'skipped' from 'failed' is the Skip-failed-type action.
create or replace function public.record_generation_result(
  p_package_id uuid,
  p_content_type text,
  p_outcome text,
  p_error text default null,
  p_usage jsonb default null
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pkg public.session_content_packages%rowtype;
  v_entry jsonb;
  v_progress jsonb;
  v_k text;
  v_s text;
  v_all_terminal boolean := true;
  v_any_failed boolean := false;
  v_new_status text;
begin
  if p_outcome not in ('completed','failed','skipped') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  select * into v_pkg from public.session_content_packages
   where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if v_pkg.archived_at is not null then raise exception 'package is archived'; end if;

  v_entry := v_pkg.generation_settings->'progress'->p_content_type;
  if v_entry is null then
    raise exception 'content type % is not selected for this package', p_content_type;
  end if;
  if p_outcome in ('completed','failed') and v_entry->>'status' <> 'processing' then
    raise exception 'type % is not processing (status=%)', p_content_type, v_entry->>'status';
  end if;
  if p_outcome = 'skipped' and v_entry->>'status' not in ('processing','failed') then
    raise exception 'type % cannot be skipped from status %', p_content_type, v_entry->>'status';
  end if;

  v_entry := v_entry || jsonb_build_object(
    'status', p_outcome,
    'completed_at', case when p_outcome in ('completed','skipped')
                         then to_jsonb(now()) else 'null'::jsonb end,
    'error', case when p_outcome = 'failed' and p_error is not null
                  then to_jsonb(left(p_error, 2000)) else 'null'::jsonb end,
    'usage', coalesce(p_usage, v_entry->'usage', 'null'::jsonb),
    'lease_expires_at', 'null'::jsonb);

  v_progress := jsonb_set(v_pkg.generation_settings->'progress',
                          array[p_content_type], v_entry);

  for v_k in
    select jsonb_array_elements_text(v_pkg.generation_settings->'selected_types')
  loop
    v_s := v_progress->v_k->>'status';
    if v_s in ('pending','processing') then v_all_terminal := false; end if;
    if v_s = 'failed' then v_any_failed := true; end if;
  end loop;

  v_new_status := case
    when not v_all_terminal then 'generating'
    when v_any_failed then 'needs_attention'
    else 'ready' end;

  update public.session_content_packages
     set generation_settings = jsonb_set(generation_settings, '{progress}', v_progress),
         status = v_new_status
   where id = p_package_id;
  return v_new_status;
end;
$$;

revoke all on function public.claim_photos_for_analysis(uuid, uuid[], int, int)
  from public, anon, authenticated;
grant execute on function public.claim_photos_for_analysis(uuid, uuid[], int, int) to service_role;
revoke all on function public.record_analysis_batch(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_analysis_batch(uuid, jsonb) to service_role;
revoke all on function public.claim_generation_type(uuid, text, int)
  from public, anon, authenticated;
grant execute on function public.claim_generation_type(uuid, text, int) to service_role;
revoke all on function public.record_generation_result(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_generation_result(uuid, text, text, text, jsonb) to service_role;
