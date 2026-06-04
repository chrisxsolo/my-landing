-- ─────────────────────────────────────────────────────────────────────────────
-- Availability privacy — PART 1 of 2: sanitized public view  (ADDITIVE / SAFE)
--
-- Apply this FIRST, before or at the time you deploy the matching app code.
-- It is non-breaking: the base `availability` table stays fully accessible.
--
-- Why: admin tooling historically wrote private details into the `note` column
-- on booked dates (e.g. "Booked — <client name>"). The public availability
-- calendar / API must never surface those. This view nulls notes for any date
-- that isn't `available`, exposing only the intentional public scheduling notes
-- (e.g. "Morning only") that live on available dates.
--
-- NOTE: This is intentionally a *security definer* view (owned by postgres, the
-- table owner) — NOT security_invoker. That is required so the anon/authenticated
-- roles can still read through it AFTER the base table is locked down in PART 2.
-- Supabase's linter will flag it as a "security definer view"; that is expected
-- and intended here. The view exposes no private data.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.availability_public as
  select
    id,
    date,
    status,
    case when status = 'available' then note else null end as note
  from public.availability;

grant select on public.availability_public to anon, authenticated;
