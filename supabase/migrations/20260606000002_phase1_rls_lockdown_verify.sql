-- VERIFICATION for Phase 1 RLS lockdown. Run in the Supabase SQL editor.
-- NEGATIVE checks must error/return 0; POSITIVE checks must succeed.

-- ── POSITIVE: anon can still READ public grad-guide content ──
begin;
set local role anon;
select count(*) as poses   from public.grad_poses;      -- expect 8
select count(*) as spots   from public.location_spots;  -- expect 16
select count(*) as photos  from public.grad_photos;     -- expect 4
rollback;

-- ── NEGATIVE: anon cannot WRITE the guide tables ──
begin;
set local role anon;
insert into public.grad_poses (title, image_url, instructions) values ('x','u','y'); -- expect ERROR
update public.location_spots set name = 'hacked';                                     -- expect 0/ERROR
rollback;

-- ── NEGATIVE: anon cannot touch server-only internal tables ──
begin;
set local role anon;
select count(*) as vault from public.vault_notes;          -- expect 0/ERROR
select count(*) as chats from public.chat_messages;        -- expect 0/ERROR
select count(*) as ai    from public.ai_training_sessions; -- expect 0/ERROR
select count(*) as clicks from public.link_clicks;         -- expect 0/ERROR
select count(*) as views  from public.link_views;          -- expect 0/ERROR
select count(*) as pa     from public.professional_availability; -- expect 0/ERROR
rollback;

-- ── NEGATIVE: authenticated (non-admin) likewise denied on internal tables ──
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","email":"nobody@example.com"}';
select count(*) from public.vault_notes;     -- expect 0/ERROR
select count(*) from public.link_clicks;     -- expect 0/ERROR
rollback;

-- ── POSITIVE: service role still reads everything (run via service connection) ──
-- select count(*) from public.vault_notes;          -- expect 80
-- select count(*) from public.link_views;           -- expect 606
-- select count(*) from public.grad_poses;           -- expect 8
