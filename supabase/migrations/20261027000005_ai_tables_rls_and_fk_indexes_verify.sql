-- Verify for 20261027000005_ai_tables_rls_and_fk_indexes (read-only).
do $$
declare t text;
begin
  foreach t in array array['ai_writing_rules','ai_approved_examples','ai_email_usage','ai_draft_outcomes'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT') then
      raise exception 'anon must not read %', t;
    end if;
    if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('public.' || t)) then
      raise exception 'row level security is not forced on %', t;
    end if;
  end loop;
  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
    'payments_inquiry_id_idx','photo_sync_runs_retry_of_idx','content_engine_jobs_package_id_idx',
    'school_page_photos_session_photo_id_idx','portfolio_images_category_id_idx','photography_sessions_inquiry_id_idx')) <> 6 then
    raise exception 'a covering index is missing';
  end if;
end $$;
