-- Choose an existing Content Engine photo for a location guide (2026-10-26).
--
-- Adds two functions, no tables or columns:
--
--   set_guide_photo_hero(guide, slug, row_id)
--     Makes one gallery row the hero in a single UPDATE, so two rows can never
--     both be the active hero for a guide. A per-guide advisory lock serializes
--     concurrent hero changes.
--
--   attach_existing_guide_photo(guide, slug, session_photo_id, make_hero, publish)
--     Links a Content Engine photo to a guide the same way the engine's own
--     guide_photo publish does: a gallery row whose image_url is the photo's
--     existing public derivative. No file is copied; storage_path stays null,
--     so deleting the gallery row never deletes the engine's file. If the
--     guide already has a row for that image it is reused (no duplicates).
--     Requires an existing public derivative and an active marketing
--     permission on the photo's session.
--
-- The advisory-lock key for the insert is the exact string the engine's
-- guide_photo branch builds ('<guide>:<location_key>:<derivative_content_hash>'),
-- so a manual attach and an engine publish of the same photo can't race into
-- two rows.
--
-- Only the service role may execute these (admin API routes).

create or replace function public.set_guide_photo_hero(p_guide text, p_slug text, p_row_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_table text;
  v_found boolean;
begin
  if p_guide not in ('couples', 'family', 'portrait') then
    raise exception 'invalid guide %', p_guide;
  end if;
  v_table := p_guide || '_location_photos';

  perform pg_advisory_xact_lock(hashtextextended(format('hero:%s:%s', p_guide, p_slug), 0));

  execute format('select exists(select 1 from public.%I where id = $1 and location_slug = $2)', v_table)
    into v_found using p_row_id, p_slug;
  if not v_found then
    raise exception 'photo % is not in the % guide for %', p_row_id, p_guide, p_slug;
  end if;

  execute format(
    'update public.%I set featured = (id = $1) where location_slug = $2 and featured is distinct from (id = $1)',
    v_table) using p_row_id, p_slug;
end;
$$;

create or replace function public.attach_existing_guide_photo(
  p_guide text, p_slug text, p_session_photo_id uuid, p_make_hero boolean, p_publish boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_table text;
  v_photo record;
  v_row uuid;
  v_created boolean := false;
begin
  if p_guide not in ('couples', 'family', 'portrait') then
    raise exception 'invalid guide %', p_guide;
  end if;
  if p_slug is null or length(trim(p_slug)) = 0 then
    raise exception 'missing location slug';
  end if;
  v_table := p_guide || '_location_photos';

  select sp.id, sp.public_derivative_url, sp.public_derivative_content_hash,
         nullif(trim(coalesce(sp.alt_text, '')), '') as alt_text,
         ps.marketing_permission, ps.marketing_permission_revoked_at
    into v_photo
    from public.session_photos sp
    join public.photography_sessions ps on ps.id = sp.photography_session_id
   where sp.id = p_session_photo_id;
  if not found then raise exception 'photo not found'; end if;
  if not v_photo.marketing_permission or v_photo.marketing_permission_revoked_at is not null then
    raise exception 'this session does not have marketing permission';
  end if;
  if v_photo.public_derivative_url is null then
    raise exception 'photo is not approved for the website yet';
  end if;

  -- same key construction as the engine's guide_photo publish branch
  perform pg_advisory_xact_lock(hashtextextended(
    format('%s:%s:%s', p_guide, p_slug, v_photo.public_derivative_content_hash), 0));

  execute format('select id from public.%I where location_slug = $1 and image_url = $2 order by created_at limit 1', v_table)
    into v_row using p_slug, v_photo.public_derivative_url;

  if v_row is null then
    execute format(
      'insert into public.%I (location_slug, image_url, alt_text, published, featured, sort_order)
       values ($1, $2, $3, $4, false,
               coalesce((select max(sort_order) + 1 from public.%I where location_slug = $1), 0))
       returning id', v_table, v_table)
      into v_row using p_slug, v_photo.public_derivative_url, v_photo.alt_text, p_publish;
    v_created := true;
  elsif p_publish then
    -- reuse the existing row; only flip it live, never touch its alt/caption
    execute format('update public.%I set published = true where id = $1 and published = false', v_table)
      using v_row;
  end if;

  if p_make_hero then
    perform public.set_guide_photo_hero(p_guide, p_slug, v_row);
  end if;

  return jsonb_build_object('row_id', v_row, 'created', v_created);
end;
$$;

revoke all on function public.set_guide_photo_hero(text, text, uuid) from public, anon, authenticated;
revoke all on function public.attach_existing_guide_photo(text, text, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.set_guide_photo_hero(text, text, uuid) to service_role;
grant execute on function public.attach_existing_guide_photo(text, text, uuid, boolean, boolean) to service_role;
