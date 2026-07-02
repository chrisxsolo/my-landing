do $$
declare
  v_id uuid;
begin
  -- new columns exist
  if (select count(*) from information_schema.columns
      where table_schema='public' and table_name='photography_sessions'
        and column_name in ('vibe','relationship_type','outfit_styling','best_moment')) <> 4 then
    raise exception 'photography_sessions: couples fact columns missing';
  end if;

  -- 'prom' + new lighting + couples facets are accepted
  insert into public.photography_sessions (service_type) values ('prom') returning id into v_id;
  delete from public.photography_sessions where id = v_id;

  insert into public.photography_sessions
    (service_type, lighting_condition, vibe, relationship_type)
    values ('couples','sunset','romantic','engagement') returning id into v_id;
  delete from public.photography_sessions where id = v_id;

  -- invalid vibe is rejected
  begin
    insert into public.photography_sessions (service_type, vibe) values ('couples','sparkly');
    raise exception 'photography_sessions: invalid vibe was accepted';
  exception when check_violation then null;
  end;

  -- invalid relationship_type is rejected
  begin
    insert into public.photography_sessions (service_type, relationship_type) values ('couples','situationship');
    raise exception 'photography_sessions: invalid relationship_type was accepted';
  exception when check_violation then null;
  end;

  raise notice 'VERIFY OK: service_aware_couples_fields';
end $$;
