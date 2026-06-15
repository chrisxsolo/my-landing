-- ─────────────────────────────────────────────────────────────────────────────
-- Tier 2 RLS lockdown for the 11 tables the admin dashboard used to write via the
-- public anon key. Admin writes have been moved to service-role API routes
-- (app/api/admin/*), which bypass RLS. Public content keeps anon SELECT; sensitive
-- tables get NO anon policy at all.
--
-- ⚠️  APPLY ONLY AFTER the admin-writes-to-API code change is deployed to
--     production. The currently-deployed admin writes via the anon key and will
--     break the instant these policies take effect otherwise.
--
-- (Tier 1 — vault_notes, payments_backup_20260611, ai_training_sessions,
--  chat_messages, chat_conversations, about_photos, availability, grad_photos,
--  grad_outfits, grad_prep_tips — was applied separately and is already live.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Public content: anon may read, anon may NOT write (no write policy → blocked).
alter table public.links          enable row level security;
drop policy if exists "public_read_links" on public.links;
create policy "public_read_links"          on public.links          for select to public using (true);

alter table public.grad_poses     enable row level security;
drop policy if exists "public_read_grad_poses" on public.grad_poses;
create policy "public_read_grad_poses"     on public.grad_poses     for select to public using (true);

alter table public.location_spots enable row level security;
drop policy if exists "public_read_location_spots" on public.location_spots;
create policy "public_read_location_spots" on public.location_spots for select to public using (true);

-- Blog: anon may read only already-published posts; drafts/scheduled stay hidden.
-- Admin reads every post through the service-role API (/api/admin/blog-posts).
alter table public.blog_posts     enable row level security;
drop policy if exists "public_read_published_blog_posts" on public.blog_posts;
create policy "public_read_published_blog_posts"
  on public.blog_posts for select to public using (published_at <= now());

-- Sensitive / internal: NO anon access at all (service-role only).
alter table public.image_library  enable row level security;
alter table public.link_clicks    enable row level security;
alter table public.link_views     enable row level security;

-- Tighten the pre-existing permissive write policies. The public_read SELECT
-- policies on these tables are intentional and are kept; only the always-true
-- write (ALL) policies are dropped — writes now flow through service-role APIs.
drop policy if exists "portfolio_images_public_write"       on public.portfolio_images;
drop policy if exists "portfolio_categories_public_write"   on public.portfolio_categories;
drop policy if exists "portfolio_case_studies_public_write" on public.portfolio_case_studies;
drop policy if exists "bay_area_locations_public_write"     on public.bay_area_locations;

-- professional_availability is unused by the app; drop its always-true write
-- policy (its "public read" policy is harmless and left in place).
drop policy if exists "service write" on public.professional_availability;
