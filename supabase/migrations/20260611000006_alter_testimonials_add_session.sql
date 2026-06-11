-- Canonical marketing relationship for testimonials (spec §3.7).
alter table public.testimonials
  add column if not exists photography_session_id uuid null
    references public.photography_sessions(id) on delete set null;
create index if not exists testimonials_photography_session_idx
  on public.testimonials (photography_session_id);
