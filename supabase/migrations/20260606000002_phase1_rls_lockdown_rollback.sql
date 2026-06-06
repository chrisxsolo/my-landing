-- ROLLBACK for 20260606000002_phase1_rls_lockdown.sql

-- Group A: drop read policies, restore grants, disable RLS.
drop policy if exists grad_photos_public_read    on public.grad_photos;
drop policy if exists grad_poses_public_read     on public.grad_poses;
drop policy if exists grad_outfits_public_read   on public.grad_outfits;
drop policy if exists grad_prep_tips_public_read on public.grad_prep_tips;
drop policy if exists location_spots_public_read on public.location_spots;

alter table public.grad_photos    disable row level security;
alter table public.grad_poses     disable row level security;
alter table public.grad_outfits   disable row level security;
alter table public.grad_prep_tips disable row level security;
alter table public.location_spots disable row level security;

grant select, insert, update, delete on public.grad_photos    to anon, authenticated;
grant select, insert, update, delete on public.grad_poses     to anon, authenticated;
grant select, insert, update, delete on public.grad_outfits   to anon, authenticated;
grant select, insert, update, delete on public.grad_prep_tips to anon, authenticated;
grant select, insert, update, delete on public.location_spots to anon, authenticated;

-- Group B: disable RLS (clears FORCE) and restore grants.
alter table public.vault_notes          disable row level security;
alter table public.chat_conversations   disable row level security;
alter table public.chat_messages        disable row level security;
alter table public.ai_training_sessions disable row level security;
alter table public.link_clicks          disable row level security;
alter table public.link_views           disable row level security;

grant select, insert, update, delete on public.vault_notes          to anon, authenticated;
grant select, insert, update, delete on public.chat_conversations   to anon, authenticated;
grant select, insert, update, delete on public.chat_messages        to anon, authenticated;
grant select, insert, update, delete on public.ai_training_sessions to anon, authenticated;
grant select, insert, update, delete on public.link_clicks          to anon, authenticated;
grant select, insert, update, delete on public.link_views           to anon, authenticated;

-- professional_availability: restore the original permissive policies + grants.
-- (This re-opens the original hole — emergency rollback only.)
grant select, insert, update, delete on public.professional_availability to anon, authenticated;
create policy "public read"  on public.professional_availability for select to public using (true);
create policy "service write" on public.professional_availability for all   to public using (true);
