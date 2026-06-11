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
    -- NOTE: selected_types/progress keys in p_generation_settings are overwritten — the RPC is authoritative for both.
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

create or replace function public.publish_session_content_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.session_content_items%rowtype;
  v_session public.photography_sessions%rowtype;
  v_session_id uuid;
  v_claimed int;
  v_target_type text;
  v_target_id text;
  v_ref jsonb := '{}'::jsonb;
  -- journal locals
  v_body text; v_slug text; v_link jsonb;
  v_cover public.session_photos%rowtype;
  v_extra_urls text[] := '{}'; v_extra_alts text[] := '{}';
  v_pid uuid; v_photo public.session_photos%rowtype;
  v_post_id bigint;
  -- portfolio locals
  v_existing_pf bigint; v_sort int; v_cat_id bigint;
  -- school/guide locals
  v_school_id uuid; v_guide text; v_guide_existing uuid;
begin
  select i.* into v_item from public.session_content_items i
   where i.id = p_item_id for update;
  if not found then raise exception 'content item not found'; end if;

  select p.photography_session_id into v_session_id
    from public.session_content_packages p where p.id = v_item.package_id;
  select s.* into v_session from public.photography_sessions s
   where s.id = v_session_id for update;

  if exists (select 1 from public.session_content_packages p
             where p.id = v_item.package_id and p.archived_at is not null) then
    raise exception 'item belongs to an archived package — restore it into the active package first';
  end if;

  if not v_session.marketing_permission then
    raise exception 'marketing permission is not enabled for this session';
  end if;
  if v_item.published_target_id is not null then
    raise exception 'item already published';
  end if;
  if v_item.status <> 'approved' then
    raise exception 'item is not approved (status=%)', v_item.status;
  end if;
  if v_item.content_type = 'social_caption' then
    raise exception 'social_caption publishing is Phase 2 and not available';
  end if;

  update public.session_content_items
     set status = 'publishing', publishing_started_at = now()
   where id = p_item_id and status = 'approved';
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then raise exception 'item claimed by another publication'; end if;

  if v_item.content_type = 'journal_post' then
    v_slug := v_item.payload->>'slug';
    if v_slug is null or v_item.payload->>'title' is null or v_item.payload->>'body' is null then
      raise exception 'journal payload incomplete';
    end if;
    if exists (select 1 from public.blog_posts b where b.slug = v_slug) then
      raise exception 'slug conflict: % already exists (an existing post is never assumed ours)', v_slug;
    end if;

    select sp.* into v_cover from public.session_photos sp
     where sp.id = (v_item.payload->>'cover_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'cover photo not found in this session'; end if;
    if v_cover.public_derivative_url is null then
      raise exception 'cover photo has no public derivative — run prepareApprovedDerivatives first';
    end if;

    for v_pid in
      select (e.value #>> '{}')::uuid from jsonb_array_elements(v_item.payload->'photo_ids') e
      where (e.value #>> '{}')::uuid <> v_cover.id
    loop
      select sp.* into v_photo from public.session_photos sp
       where sp.id = v_pid and sp.photography_session_id = v_session_id;
      if not found then raise exception 'photo % not found in this session', v_pid; end if;
      if v_photo.public_derivative_url is null then
        raise exception 'photo % has no public derivative', v_pid;
      end if;
      v_extra_urls := v_extra_urls || v_photo.public_derivative_url;
      v_extra_alts := v_extra_alts || coalesce(v_photo.alt_text, '');
    end loop;

    v_body := v_item.payload->>'body';
    if jsonb_typeof(v_item.payload->'internal_links') = 'array'
       and jsonb_array_length(v_item.payload->'internal_links') > 0 then
      v_body := v_body || E'\n\n## Keep exploring\n';
      for v_link in select * from jsonb_array_elements(v_item.payload->'internal_links') loop
        v_body := v_body || format(E'\n- [%s](%s)', v_link->>'label', v_link->>'url');
      end loop;
    end if;

    insert into public.blog_posts (
      title, body, slug, category, sites, cover_image_url, extra_image_urls,
      cover_image_alt, extra_image_alts, og_image_url,
      meta_description, meta_keywords, published_at
    ) values (
      v_item.payload->>'title', v_body, v_slug, 'professional', array['professional'],
      v_cover.public_derivative_url, v_extra_urls,
      coalesce(v_cover.alt_text, ''), v_extra_alts, v_cover.public_derivative_url,
      v_item.payload->>'meta_description', v_item.payload->>'meta_keywords', now()
    ) returning id into v_post_id;

    -- image_library rows inside the SAME transaction (spec §9.2)
    insert into public.image_library (title, alt, image_url, source_type, source_post_id, source_post_slug, source_role, in_portfolio)
    values (v_item.payload->>'title', coalesce(v_cover.alt_text, v_item.payload->>'title'),
            v_cover.public_derivative_url, 'journal', v_post_id, v_slug, 'cover', false)
    on conflict (source_post_id, source_role, image_url) do nothing;
    for v_pid in
      select (e.value #>> '{}')::uuid from jsonb_array_elements(v_item.payload->'photo_ids') e
      where (e.value #>> '{}')::uuid <> v_cover.id
    loop
      select sp.* into v_photo from public.session_photos sp where sp.id = v_pid;
      insert into public.image_library (title, alt, image_url, source_type, source_post_id, source_post_slug, source_role, in_portfolio)
      values (v_item.payload->>'title', coalesce(v_photo.alt_text, v_item.payload->>'title'),
              v_photo.public_derivative_url, 'journal', v_post_id, v_slug, 'gallery', false)
      on conflict (source_post_id, source_role, image_url) do nothing;
    end loop;

    v_target_type := 'blog_post'; v_target_id := v_post_id::text;
    v_ref := jsonb_build_object('slug', v_slug, 'cover_image_url', v_cover.public_derivative_url);

  elsif v_item.content_type = 'portfolio_pick' then
    select sp.* into v_photo from public.session_photos sp
     where sp.id = (v_item.payload->>'session_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'portfolio photo not found in this session'; end if;
    if v_photo.public_derivative_url is null then
      raise exception 'photo has no public derivative — run prepareApprovedDerivatives first';
    end if;

    select pi.id into v_existing_pf from public.portfolio_images pi
     where pi.content_hash = v_photo.content_hash limit 1;
    if v_existing_pf is not null then
      v_target_type := 'portfolio_image'; v_target_id := v_existing_pf::text;
      v_ref := jsonb_build_object('reconciled', true);
    else
      select pc.id into v_cat_id from public.portfolio_categories pc
       where pc.slug = v_item.payload->>'category';
      if v_cat_id is null then raise exception 'portfolio category % not found', v_item.payload->>'category'; end if;
      select coalesce(max(pi.sort_order), 0) + 1 into v_sort from public.portfolio_images pi;
      insert into public.portfolio_images (title, alt, image_url, category_id, category_slug, featured, sort_order, content_hash)
      values (coalesce(nullif(v_item.payload->>'title',''), 'Portfolio image'),
              coalesce(nullif(v_item.payload->>'alt_text',''), 'Portfolio image'),
              v_photo.public_derivative_url, v_cat_id, v_item.payload->>'category',
              coalesce((v_item.payload->>'featured')::boolean, false), v_sort, v_photo.content_hash)
      returning id into v_existing_pf;
      v_target_type := 'portfolio_image'; v_target_id := v_existing_pf::text;
      v_ref := jsonb_build_object('reconciled', false, 'sort_order', v_sort);
    end if;

  elsif v_item.content_type = 'school_page_photo' then
    select sp.* into v_photo from public.session_photos sp
     where sp.id = (v_item.payload->>'session_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'school photo not found in this session'; end if;
    if v_photo.public_derivative_url is null then
      raise exception 'photo has no public derivative — run prepareApprovedDerivatives first';
    end if;
    insert into public.school_page_photos (school_slug, session_photo_id, alt_override, caption, sort_order, active)
    values (v_item.payload->>'school_slug', v_photo.id,
            nullif(v_item.payload->>'alt_override',''), nullif(v_item.payload->>'caption',''),
            coalesce((v_item.payload->>'sort_order')::int, 0), true)
    on conflict (school_slug, session_photo_id) do nothing;
    select spp.id into v_school_id from public.school_page_photos spp
     where spp.school_slug = v_item.payload->>'school_slug' and spp.session_photo_id = v_photo.id;
    v_target_type := 'school_page_photo'; v_target_id := v_school_id::text;

  elsif v_item.content_type = 'guide_photo' then
    v_guide := v_item.payload->>'guide';
    if v_guide not in ('family','couples') then raise exception 'invalid guide %', v_guide; end if;
    select sp.* into v_photo from public.session_photos sp
     where sp.id = (v_item.payload->>'session_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'guide photo not found in this session'; end if;
    if v_photo.public_derivative_url is null then
      raise exception 'photo has no public derivative — run prepareApprovedDerivatives first';
    end if;

    -- race-safe without a unique index on the live table (spec §9.2)
    perform pg_advisory_xact_lock(hashtextextended(
      format('%s:%s:%s', v_guide, v_item.payload->>'location_key', v_photo.public_derivative_content_hash), 0));

    if v_guide = 'family' then
      select f.id into v_guide_existing from public.family_location_photos f
       where f.location_slug = v_item.payload->>'location_key'
         and f.image_url = v_photo.public_derivative_url limit 1;
      if v_guide_existing is null then
        insert into public.family_location_photos (location_slug, image_url, alt_text, published, sort_order)
        values (v_item.payload->>'location_key', v_photo.public_derivative_url,
                nullif(v_item.payload->>'alt_text',''), true,
                coalesce((select max(sort_order)+1 from public.family_location_photos
                          where location_slug = v_item.payload->>'location_key'), 0))
        returning id into v_guide_existing;
      end if;
      v_target_type := 'family_location_photo';
    else
      select c.id into v_guide_existing from public.couples_location_photos c
       where c.location_slug = v_item.payload->>'location_key'
         and c.image_url = v_photo.public_derivative_url limit 1;
      if v_guide_existing is null then
        insert into public.couples_location_photos (location_slug, image_url, alt_text, published, sort_order)
        values (v_item.payload->>'location_key', v_photo.public_derivative_url,
                nullif(v_item.payload->>'alt_text',''), true,
                coalesce((select max(sort_order)+1 from public.couples_location_photos
                          where location_slug = v_item.payload->>'location_key'), 0))
        returning id into v_guide_existing;
      end if;
      v_target_type := 'couples_location_photo';
    end if;
    v_target_id := v_guide_existing::text;

  elsif v_item.content_type = 'testimonial_feature' then
    update public.testimonials t
       set photography_session_id = v_session_id
     where t.id = (v_item.payload->>'testimonial_id')::uuid;
    if not found then raise exception 'testimonial not found'; end if;
    v_target_type := 'testimonial'; v_target_id := v_item.payload->>'testimonial_id';

  elsif v_item.content_type = 'internal_link_suggestion' then
    v_target_type := 'none'; v_target_id := null;

  else
    raise exception 'unsupported content type %', v_item.content_type;
  end if;

  update public.session_content_items
     set status = 'published',
         published_target_type = v_target_type,
         published_target_id = v_target_id,
         published_ref = v_ref,
         published_at = now(),
         error = null
   where id = p_item_id;

  return jsonb_build_object('item_id', p_item_id, 'target_type', v_target_type, 'target_id', v_target_id);
end;
$$;

revoke all on function public.publish_session_content_item(uuid) from public, anon, authenticated;
grant execute on function public.publish_session_content_item(uuid) to service_role;
