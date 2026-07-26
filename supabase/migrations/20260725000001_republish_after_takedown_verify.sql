-- Verify: the publish RPC re-activates on republish.
-- 1. The school branch upserts (no bare DO NOTHING on school_page_photos).
-- 2. Each guide reuse path re-sets published = true.
select
  (prosrc like '%on conflict (school_slug, session_photo_id) do update%') as school_upserts,
  (length(prosrc) - length(replace(prosrc, 'set published = true', ''))) / length('set published = true')
    as guide_republish_count  -- expect 3 (family, couples, portrait)
from pg_proc
where proname = 'publish_session_content_item';
