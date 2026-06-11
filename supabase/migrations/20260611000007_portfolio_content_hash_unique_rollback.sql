-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
drop index if exists public.portfolio_images_content_hash_unique;
-- The content_hash column is NOT dropped: it exists in production independent
-- of this migration and is used by the existing admin upload dedupe.
commit;
