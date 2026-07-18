-- Local-test-only grants. The schema-only production baseline dump does not
-- carry production's privilege grants, so the service-role test client cannot
-- write to these pre-existing live tables until we grant here. On PRODUCTION
-- service_role already holds these (Supabase default), so this file is NEVER a
-- migration — it lives only in the local reset path.
grant all on public.blog_posts to service_role;
grant all on public.portfolio_categories to service_role;
grant all on public.portfolio_images to service_role;
grant all on public.testimonials to service_role;
grant all on public.image_library to service_role;
grant all on public.family_location_photos to service_role;
grant all on public.couples_location_photos to service_role;
grant all on public.client_sessions to service_role;
grant all on public.location_spots to service_role;
grant all on public.inquiries to service_role;
-- inquiries uses a serial id, so the service role also needs its sequence.
grant all on sequence public.inquiries_id_seq to service_role;

-- Minimal data seed: the prod baseline is schema-only, but the publish RPC
-- (and the 20260618000001 verify) resolve engine portfolio categories against
-- portfolio_categories rows that exist in production. Seed the four resolved
-- slugs so data-dependent verifies mirror the prod invariant locally.
insert into public.portfolio_categories (name, slug)
values ('Graduation', 'graduation'), ('Family', 'family'),
       ('Couples', 'couples'), ('Portraits', 'portraits')
on conflict (slug) do nothing;
