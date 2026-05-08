create extension if not exists "pgcrypto";

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamp with time zone not null default now(),
  constraint admin_users_email_not_blank check (length(trim(email)) > 0)
);

create table if not exists public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid null references auth.users(id) on delete set null,
  client_email text not null,
  client_name text null,
  session_type text null,
  session_date timestamp with time zone null,
  location text null,
  meeting_point text null,
  current_status text not null default 'booked',
  estimated_delivery_date date null,
  gallery_url text null,
  invoice_status text null,
  contract_status text null,
  backup_status text null,
  internal_notes text null,
  client_notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint client_sessions_client_email_not_blank check (length(trim(client_email)) > 0),
  constraint client_sessions_current_status_check check (
    current_status in (
      'booked',
      'session_completed',
      'photos_backed_up',
      'culling',
      'editing',
      'final_review',
      'delivered'
    )
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_sessions_set_updated_at on public.client_sessions;

create trigger client_sessions_set_updated_at
before update on public.client_sessions
for each row
execute function public.set_updated_at();

create index if not exists admin_users_user_id_idx on public.admin_users (user_id);
create index if not exists admin_users_email_idx on public.admin_users (lower(email));
create index if not exists client_sessions_client_user_id_idx on public.client_sessions (client_user_id);
create index if not exists client_sessions_client_email_idx on public.client_sessions (lower(client_email));
create index if not exists client_sessions_current_status_idx on public.client_sessions (current_status);
create index if not exists client_sessions_session_date_idx on public.client_sessions (session_date);

create or replace function public.is_client_session_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

alter table public.admin_users enable row level security;
alter table public.client_sessions enable row level security;

drop policy if exists "Admin users can view themselves" on public.admin_users;
create policy "Admin users can view themselves"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admin users can manage admin users" on public.admin_users;
create policy "Admin users can manage admin users"
on public.admin_users
for all
to authenticated
using (public.is_client_session_admin())
with check (public.is_client_session_admin());

drop policy if exists "Clients can view their own sessions" on public.client_sessions;
create policy "Clients can view their own sessions"
on public.client_sessions
for select
to authenticated
using (
  client_user_id = auth.uid()
  or lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Admins can view all client sessions" on public.client_sessions;
create policy "Admins can view all client sessions"
on public.client_sessions
for select
to authenticated
using (public.is_client_session_admin());

drop policy if exists "Admins can create client sessions" on public.client_sessions;
create policy "Admins can create client sessions"
on public.client_sessions
for insert
to authenticated
with check (public.is_client_session_admin());

drop policy if exists "Admins can update client sessions" on public.client_sessions;
create policy "Admins can update client sessions"
on public.client_sessions
for update
to authenticated
using (public.is_client_session_admin())
with check (public.is_client_session_admin());

drop policy if exists "Admins can delete client sessions" on public.client_sessions;
create policy "Admins can delete client sessions"
on public.client_sessions
for delete
to authenticated
using (public.is_client_session_admin());

revoke all on public.client_sessions from anon, authenticated;
grant select (
  id,
  client_user_id,
  client_email,
  client_name,
  session_type,
  session_date,
  location,
  meeting_point,
  current_status,
  estimated_delivery_date,
  gallery_url,
  invoice_status,
  contract_status,
  backup_status,
  client_notes,
  created_at,
  updated_at
) on public.client_sessions to authenticated;
grant insert, update, delete on public.client_sessions to authenticated;

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
