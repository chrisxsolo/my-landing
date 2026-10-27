-- photo_change_log — a durable record of every categorization change (2026-10-27).
--
-- Undo in the tagging admin lived only in the browser tab: once it closed, a
-- bulk approval or an automated sync could not be traced or reversed. Every
-- change to a photo's category / university / location / campus spot, and
-- every change the location sync makes to a session's library links, now
-- writes one row here, with the value before and after and who made it:
--   manual  the photographer, through the admin (accepting a suggestion counts)
--   system  an automated step on records: apply-high, the location sync
--   ai      an AI-authored write (none today; reserved so the actor list is complete)
-- Restoring from this history writes a new 'manual' row — history is never
-- rewritten. Logging failures never block the change itself (lib/photoChangeLog).
-- Server code only (service role), like photo_sync_runs.

create table if not exists public.photo_change_log (
  id          bigint generated always as identity primary key,
  -- "portfolio:<id>", "engine:<uuid>" (lib/photoTagging/types isPhotoKey) or "session:<uuid>" for session-level facts
  photo_key   text not null
    check (photo_key ~ '^(portfolio:[0-9]{1,12}|(engine|session):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  field       text not null check (field ~ '^[a-z_]{1,40}$'),
  old_value   jsonb,
  new_value   jsonb,
  actor       text not null check (actor in ('ai', 'system', 'manual')),
  reason      text check (reason is null or length(reason) <= 500),
  created_at  timestamptz not null default now()
);

create index if not exists photo_change_log_key_idx on public.photo_change_log (photo_key, created_at desc);
create index if not exists photo_change_log_created_idx on public.photo_change_log (created_at desc);

revoke all on public.photo_change_log from anon, authenticated;
grant all on public.photo_change_log to service_role;
alter table public.photo_change_log enable row level security;
alter table public.photo_change_log force row level security;
