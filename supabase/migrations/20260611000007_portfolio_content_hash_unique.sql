-- Race-safe portfolio dedupe (spec §9.2, §14 migration 7).
-- Production verified 2026-06-10: column exists (43/173 rows), zero duplicate
-- hashes. The column guard keeps this portable; null hashes (130 legacy rows)
-- are unaffected by the partial index and excluded from hash reconciliation.
alter table public.portfolio_images
  add column if not exists content_hash text null;

create unique index if not exists portfolio_images_content_hash_unique
  on public.portfolio_images (content_hash)
  where content_hash is not null;
