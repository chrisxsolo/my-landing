create table if not exists public.vault_notes (
  id text primary key,           -- relative path from vault root, e.g. "01 SOPs/Booking.md"
  title text not null,
  folder text not null,
  content text not null default '',
  synced_at timestamptz not null default timezone('utc', now())
);
