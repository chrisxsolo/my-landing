# SoloXSnaps Website

Next.js App Router site for SoloXSnaps, with Supabase-backed admin tools and a client photo session portal.

## Local Setup

Install dependencies and run the development server:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create `.env.local` using `.env.example` as the template.

Required for the client session portal:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://soloxsnaps.com
```

The service role key is server-only. Never expose it in browser code.
`NEXT_PUBLIC_SITE_URL` is used for production OAuth redirects, so Google returns clients to `/dashboard` instead of falling back to the homepage.

Existing admin and AI features may also use:

```env
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
ANTHROPIC_API_KEY=
OBSIDIAN_VAULT_PATH=
```

## Client Session Portal Setup

Run the migration in `supabase/migrations/20260508000000_create_client_sessions.sql`.

It creates:

- `client_sessions`
- `admin_users`
- `current_status` check constraints
- `updated_at` trigger
- Row Level Security policies for clients and admins
- Column grants that keep `internal_notes` out of normal client reads

The client journey statuses are:

```txt
inquiry_received
booking_in_progress
booked
session_completed
photos_backed_up
culling
editing
final_review
delivered
```

In Supabase Auth, enable Google as an OAuth provider. Add these redirect URLs in the Supabase dashboard:

```txt
http://localhost:3000/dashboard
http://localhost:3000/admin/sessions
https://soloxsnaps.com/dashboard
https://soloxsnaps.com/admin/sessions
https://www.soloxsnaps.com/dashboard
https://www.soloxsnaps.com/admin/sessions
```

After signing in once with Google, add the photographer account to `admin_users`:

```sql
insert into public.admin_users (user_id, email)
select id, email
from auth.users
where email = 'your-admin-email@example.com';
```

## Test The Portal

Client login flow:

1. Visit `/login`.
2. Click `Continue with Google`.
3. After redirect, visit `/dashboard`.
4. Create a `client_sessions` row with `client_email` matching the Google email.
5. Confirm the dashboard shows only that client's sessions and never shows `internal_notes`.

Admin session updates:

1. Sign in with the Google account listed in `admin_users`.
2. Visit `/admin/sessions`.
3. Create a session with the client's email.
4. Update `current_status`, delivery date, notes, and gallery URL.
5. Refresh `/dashboard` as the client and confirm the progress tracker reflects the update.

## Verification

Useful checks:

```bash
node --experimental-default-type=module --test tests/clientSessions.test.mjs
npm run lint
npm run build
```
