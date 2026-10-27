-- Lock the AI assistant tables and index the foreign keys the admin queries.
--
-- The Supabase security advisor flagged ai_writing_rules, ai_approved_examples,
-- ai_email_usage and ai_draft_outcomes as exposed with no row level security.
-- ai_draft_outcomes stores drafted client emails, so the anon key must never
-- read them. Only server code with the service role touches these tables
-- (lib/ai/*), so locking them to service_role changes nothing for the app.
-- Same pattern as photo_sync_runs.

do $$
declare t text;
begin
  foreach t in array array['ai_writing_rules','ai_approved_examples','ai_email_usage','ai_draft_outcomes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
      execute format('grant all on public.%I to service_role', t);
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);
    end if;
  end loop;
end $$;

-- Covering indexes for foreign keys the dashboards join on (performance advisor).
create index if not exists payments_inquiry_id_idx on public.payments (inquiry_id);
create index if not exists photo_sync_runs_retry_of_idx on public.photo_sync_runs (retry_of);
create index if not exists content_engine_jobs_package_id_idx on public.content_engine_jobs (package_id);
create index if not exists school_page_photos_session_photo_id_idx on public.school_page_photos (session_photo_id);
create index if not exists portfolio_images_category_id_idx on public.portfolio_images (category_id);
create index if not exists photography_sessions_inquiry_id_idx on public.photography_sessions (inquiry_id);
