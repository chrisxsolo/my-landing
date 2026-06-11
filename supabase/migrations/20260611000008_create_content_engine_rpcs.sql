-- Transactional RPCs (spec §8.2, §8.4, §9). security definer with pinned
-- search_path; EXECUTE revoked from PUBLIC/anon/authenticated (spec §5).

create or replace function public.create_content_package(
  p_session_id uuid,
  p_model_name text,
  p_prompt_version text,
  p_selected_types text[],
  p_session_facts jsonb default '{}'::jsonb,
  p_generation_settings jsonb default '{}'::jsonb,
  p_archive_current boolean default false,
  p_copy_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.photography_sessions%rowtype;
  v_active public.session_content_packages%rowtype;
  v_next int;
  v_pkg_id uuid;
  v_type text;
  v_progress jsonb := '{}'::jsonb;
  v_copy jsonb;
  v_src public.session_content_items%rowtype;
  v_src_session uuid;
  v_new_status text;
  v_allowed constant text[] := array[
    'journal_post','portfolio_pick','school_page_photo','guide_photo',
    'testimonial_feature','internal_link_suggestion'];  -- social_caption: Phase 2, not offered
begin
  select * into v_session from public.photography_sessions
   where id = p_session_id for update;
  if not found then raise exception 'photography session not found'; end if;
  if not v_session.ai_processing_allowed then
    raise exception 'ai processing is not allowed for this session';
  end if;

  if p_selected_types is null or array_length(p_selected_types, 1) is null then
    raise exception 'invalid selected types: empty';
  end if;
  foreach v_type in array p_selected_types loop
    if not (v_type = any (v_allowed)) then
      raise exception 'content type % is not offered (invalid)', v_type;
    end if;
    v_progress := v_progress || jsonb_build_object(v_type, jsonb_build_object(
      'status','pending','attempt',0,'lease_started_at',null,
      'lease_expires_at',null,'completed_at',null,'error',null,'usage',null));
  end loop;

  -- block regeneration while anything in this session is actively publishing (spec §8.4)
  if exists (
    select 1 from public.session_content_items i
    join public.session_content_packages p on p.id = i.package_id
    where p.photography_session_id = p_session_id and i.status = 'publishing'
  ) then
    raise exception 'an item is currently publishing — regeneration blocked';
  end if;

  select * into v_active from public.session_content_packages
   where photography_session_id = p_session_id and archived_at is null
   for update;
  if found then
    if not p_archive_current then
      raise exception 'an active package already exists — pass archive_current';
    end if;
    update public.session_content_packages
       set status = 'archived', archived_at = now()
     where id = v_active.id;
  end if;

  select coalesce(max(generation_number), 0) + 1 into v_next
    from public.session_content_packages
   where photography_session_id = p_session_id;

  insert into public.session_content_packages (
    photography_session_id, generation_number, status, session_facts_snapshot,
    model_name, prompt_version, generation_settings
  ) values (
    p_session_id, v_next, 'generating', coalesce(p_session_facts, '{}'::jsonb),
    p_model_name, p_prompt_version,
    coalesce(p_generation_settings, '{}'::jsonb)
      || jsonb_build_object('selected_types', to_jsonb(p_selected_types), 'progress', v_progress)
  ) returning id into v_pkg_id;

  -- copy-forward (spec §8.4): new key, provenance, never a published target
  for v_copy in select * from jsonb_array_elements(coalesce(p_copy_items, '[]'::jsonb)) loop
    select * into v_src from public.session_content_items
     where id = (v_copy->>'item_id')::uuid for update;
    if not found then raise exception 'copy source item not found'; end if;
    select p.photography_session_id into v_src_session
      from public.session_content_packages p where p.id = v_src.package_id;
    if v_src_session is distinct from p_session_id then
      raise exception 'copy source belongs to another session';
    end if;
    if v_src.status in ('published','publishing') then
      raise exception 'cannot copy a published or publishing item';
    end if;
    if v_src.status = 'approved'
       and coalesce((v_copy->>'preserve_approval')::boolean, false)
       and v_src.published_target_id is null then
      v_new_status := 'approved';
    else
      v_new_status := 'draft';
    end if;

    insert into public.session_content_items (
      package_id, content_type, status, payload, copied_from_item_id,
      generation_model, prompt_version, generated_at,
      approved_at, approved_by, idempotency_key
    ) values (
      v_pkg_id, v_src.content_type, v_new_status, v_src.payload, v_src.id,
      v_src.generation_model, v_src.prompt_version, v_src.generated_at,
      case when v_new_status = 'approved' then v_src.approved_at end,
      case when v_new_status = 'approved' then v_src.approved_by end,
      format('%s:%s:copy:%s', v_pkg_id, v_src.content_type, v_src.id)
    );
  end loop;

  return v_pkg_id;
end;
$$;

revoke all on function public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb)
  to service_role;
