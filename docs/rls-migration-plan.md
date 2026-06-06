# Supabase RLS Lockdown — Audit & Migration Plan

> Status: **planning + active incident remediation for `site_settings`**. No SQL has been
> applied to the database automatically. Migrations live in `supabase/migrations/` and are
> applied manually (Supabase CLI / dashboard). The application never runs these migrations.

Audited 2026-06-05. Project `dmtslzwglpezympptqls` (chris-hub).

---

## 0. Active incident — Gmail OAuth credentials publicly readable

`site_settings` has RLS **disabled** and stores `gmail_tokens` (a JSON blob containing the
Google OAuth **access token + refresh token + connected email**). Because RLS is off, anyone
holding the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` (shipped in the browser bundle) can read
that row. Treat the refresh token as compromised. See §10 for the incident-response checklist
and §11 for the exact manual revoke/reconnect order.

Additional leak path: the admin panel's `fetchSiteSettings()` did `select('key,value')` over
**all** settings into the browser — pulling `gmail_tokens` into client memory. The new
`/api/admin/site-settings` endpoint returns only an allowlist of non-secret keys.

---

## 1. Critical exposure summary

The project uses the **service-role key server-side** (`lib/supabaseServer.ts`, `BYPASSRLS`)
and the **anon key in the browser** (`lib/supabase.ts`). Two structural problems make the anon
key a master key:

1. **18 tables have RLS disabled** → the anon key can read/write every row. Most severe:
   - **`site_settings.gmail_tokens`** — OAuth access + refresh tokens (see §0). Worst exposure.
   - **`payments`, `inquiries`, `vault_notes`** — financial records, client PII, internal notes.
2. **4 RLS-enabled tables use `USING(true)`/`WITH CHECK(true)` for `public`** —
   `portfolio_images`, `portfolio_categories`, `bay_area_locations`, `professional_availability`.
   RLS is "on" but wide open for anon **writes**.

**Structural cause:** the admin panel is gated by a password cookie (`lib/adminAuth` →
`requireAdmin`), **not** Supabase Auth. So every direct `supabase.from(...)` call in
`app/admin/*` runs as the **anon role**. That is why the anon key has full admin powers, and
why naïvely enabling RLS breaks the admin panel.

**Mitigating facts:**
- Service role **bypasses RLS** → every `app/api/*` route and every public page (blog,
  portfolio, pricing, availability, bay-area, links) already reads via service role and keeps
  working unchanged.
- **No public/visitor client component reads any sensitive table** (verified). The only genuine
  anon reads are 5 public "grad guide" content tables.
- The client portal (`/dashboard`) routes through server APIs; `client_sessions`/`admin_users`
  already have correct `auth.uid()`-based policies.

**Target end-state:** deny-by-default everywhere; anon gets **only** narrow SELECT on public
content; keep existing authenticated policies; migrate admin-panel browser queries to server
routes. Each server route still calls `requireAdmin` because service role is the DB master key.

---

## 2. Complete table inventory

| Table | Data class | Rows | RLS now | Notable cols | FK / Storage |
|---|---|---|---|---|---|
| `grad_photos` | Public content | 4 | off | image_url, caption | bucket `grad-photos` (public) |
| `grad_poses` | Public content | 8 | off | title, image_url, instructions | — |
| `grad_outfits` | Public content | 0 | off | title, image_url, tip | — |
| `grad_prep_tips` | Public content | 0 | off | title, description, icon | — |
| `location_spots` | Public content | 16 | off | school_*, name, image_url | — |
| `availability` | Public-ish (mixed) | 90 | off | date, status, **note (private)** | — |
| `professional_availability` | Public-ish (mixed) | 0 | on `USING(true)` | date, status, **note** | — |
| `blog_posts` | Public content + drafts | 8 | off | body, published_at, sites | ← image_library.source_post_id |
| `portfolio_images` | Public content | 112 | on `USING(true)` | image_url, category_slug | → portfolio_categories |
| `portfolio_categories` | Public content | 4 | on `USING(true)` | slug, active | ← portfolio_images |
| `bay_area_locations` | Public content | 3 | on `USING(true)` | slug, active | — |
| `links` | Public content | 5 | off | label, url, active | ← link_clicks.link_id |
| `link_clicks` | Internal analytics | 426 | off | link_id, user_id, referrer | → links |
| `link_views` | Internal analytics | 606 | off | user_id, referrer | — |
| `inquiries` | Client-private (submission) | 28 | off | email, phone, message, status, payment_* | ← payments.inquiry_id |
| `payments` | **Financial** | 115 | off | amount, client_email, status | → inquiries |
| `site_settings` | **Admin/secrets** | 41 | off | **gmail_tokens**, covers, drafts | — |
| `image_library` | Admin/internal | 291 | off | image_url, storage_path | → blog_posts |
| `vault_notes` | Admin/internal | 80 | off | content | — |
| `ai_training_sessions` | Admin/internal | 3 | off | messages (jsonb) | — |
| `chat_conversations` | Admin/internal | 0 | off | title | ← chat_messages |
| `chat_messages` | Admin/internal | 0 | off | role, content | → chat_conversations |
| `client_sessions` | Client-private | 25 | on (correct) | client_user_id, client_email | → auth.users |
| `admin_users` | Auth/admin | 0 | on (correct) | user_id, email | → auth.users |

Storage: one bucket **`grad-photos` (public)**, serving portfolio/grad imagery (intended public).
Uploads currently go through the anon client (`lib/uploadImage.ts`); storage RLS is separate
from table RLS and tracked as a follow-up (§6, Phase 4).

`site_settings` is a "junk drawer" mixing: image/cover keys, reminder templates, **gmail_tokens
(secret)**, `gmail_blocked_senders`, and per-inquiry draft sync (`draft_*`, `ai_draft_*`,
`original_ai_draft_*`). Every value must be audited for secrets (see §10).

---

## 3. Application access map (role legend: 🟢 service-role server · 🔴 anon browser · 🔵 authenticated browser)

**Public visitor reads — server-side (🟢, safe):** blog (`lib/professionalData.ts`),
portfolio/pricing/home (`portfolio_images`, `portfolio_categories`, `grad_photos`,
`site_settings`), availability page, bay-area page, `/links` page, link click/view tracking
(`/api/links/*`).

**Public visitor reads — browser anon (🔴, the only legit anon reads):**
- `location_spots` ← `app/(professional)/grad-guide/campus-spots/CampusSpotsClient.tsx`
- `grad_poses` ← `.../grad-guide/posing/PosingClient.tsx`
- `grad_outfits` ← `.../grad-guide/what-to-wear/WhatToWearClient.tsx`
- `grad_prep_tips` ← `.../grad-guide/how-to-prepare/HowToPrepareClient.tsx`
- `grad_photos` ← `.../grad-guide/GradGallery.tsx`

**Public submission — server-side (🟢):** contact form → `/api/contact` inserts `inquiries` via
service role. **Anon never writes `inquiries` directly.**

**Admin panel — browser anon (🔴, breaks under RLS; must move server-side):**

| Table | Admin file(s) (anon) | Ops |
|---|---|---|
| `inquiries` | `admin/page.tsx`, `InquiryAnalyticsTab.tsx`, `ClientTimeline.tsx`, `conversation/[id]/page.tsx` | SELECT/UPDATE |
| `payments` | `admin/page.tsx`, `PaymentAnalyticsTab.tsx` | SELECT |
| `blog_posts` | `BlogTab.tsx` | CRUD |
| `image_library` | `BlogTab.tsx`, `admin/page.tsx` | SELECT/INSERT/UPDATE |
| `site_settings` | `admin/page.tsx`, `conversation/[id]/page.tsx` | SELECT/UPSERT/DELETE |
| `links` / `link_clicks` / `link_views` | `admin/links/page.tsx`, `AnalyticsTab.tsx` | CRUD/SELECT |
| `portfolio_images` / `portfolio_categories` | `admin/page.tsx` | CRUD |
| `bay_area_locations` | `BayAreaLocationsManager.tsx` | CRUD |
| `location_spots` | `LocationsTab.tsx` | CRUD |
| `grad_poses` | `PosesTab.tsx` | CRUD |
| `grad_photos` | `admin/page.tsx` (import) | SELECT/INSERT |

**Admin/internal — already server-only (🟢, safe to lock now):** `vault_notes`,
`chat_conversations`, `chat_messages`, `ai_training_sessions` (only in `app/api/*`);
`availability`/`professional_availability` (admin uses `/api/admin/availability`).

**Client portal — server-mediated (🟢 + 🔵):** `client_sessions` via `/api/client-sessions` &
`/api/admin/sessions`. Existing `auth.uid()` policies cover any direct authenticated access.

---

## 4. Proposed access matrix (per-operation, per-row — deny by default)

> Service role bypasses RLS → "admin" = server routes; no admin policy rows needed on most tables.
> `—` = no policy (denied for that role).

| Table | anon SELECT | anon write | authenticated | service role | FORCE RLS? |
|---|---|---|---|---|---|
| `grad_photos`, `grad_poses`, `grad_outfits`, `grad_prep_tips`, `location_spots` | ✅ public rows | — | — | full | no |
| `blog_posts` | — (server-side) | — | — | full | no |
| `portfolio_images`, `portfolio_categories`, `bay_area_locations` | — (server-side) | — | — | full | no |
| `links` | — (server-side) | — | — | full | no |
| `availability`, `professional_availability` | — (public view exposes safe fields) | — | — | full | no |
| `link_clicks`, `link_views` | — | — | — | full | recommended |
| `inquiries` | — | — | — | full | **recommended** |
| `payments` | — | — | — | full | **recommended** |
| `site_settings` | — | — | — | full | **recommended** (secrets) |
| `image_library`, `vault_notes`, `ai_training_sessions`, `chat_conversations`, `chat_messages` | — | — | — | full | recommended |
| `client_sessions` | — | — | owner SELECT (`auth.uid()`/JWT email); admin ALL (`is_client_session_admin()`) — existing | full | optional |
| `admin_users` | — | — | self SELECT; admin ALL — existing | full | optional |

Rationale highlights:
- **`blog_posts` gets no anon access** — the public blog renders server-side. (If client-side
  reads are ever added: `anon SELECT USING (published_at <= now())`, after adding a real draft flag.)
- **`inquiries` gets no anon INSERT** (stronger than the usual "public submission" pattern)
  because submissions go through `/api/contact`.
- **`payments` gets no client access** — the portal shows session status, not payment rows.

---

## 5. Draft SQL migration (grouped by table) — see `supabase/migrations/`

Conventions (matching the existing `20260604000001_availability_lockdown.sql`):
- `revoke all on <table> from anon, authenticated;` removes the default table GRANTs
  (belt-and-suspenders alongside RLS).
- `enable row level security;` → deny-by-default for anon/authenticated.
- `force row level security;` on secret/financial/private tables (defense-in-depth; does **not**
  affect `service_role`, which has `BYPASSRLS`).
- Add permissive policies **only** where anon SELECT is genuinely required.

Migration files prepared (NOT applied):
- `20260606000000_create_gmail_credentials.sql` (+ `_rollback`) — dedicated secrets table.
- `20260606000001_emergency_lock_site_settings.sql` (+ `_rollback`, `_verify`) — incident fix.
- `20260606000002_phase1_rls_lockdown.sql` (+ `_rollback`, `_verify`) — guide + server-only tables.

`availability` lockdown is already authored in `20260604000000/01` (apply those, not duplicated here).

Phase 2 tables (`payments`, `inquiries`, `blog_posts`, `image_library`, `links`,
`link_clicks/views`, `portfolio_images`, `portfolio_categories`, `bay_area_locations`,
`location_spots` write side, `grad_poses` write side, `grad_photos` write side) get their
lockdown migrations authored **as each admin-→-server route migration ships** (see §6).

Supporting index for the only `auth.uid()` policies in play (`client_sessions`):

```sql
CREATE INDEX IF NOT EXISTS idx_client_sessions_user_id    ON public.client_sessions (client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_email_lower ON public.client_sessions (lower(client_email));
```

Schema changes recommended:
1. **Move `gmail_tokens` out of `site_settings`** → dedicated `gmail_credentials` table
   (implemented in `20260606000000`). Do not store raw OAuth creds in a general settings table.
2. Optional `active boolean` on guide tables if drafts are ever desired (→ anon SELECT `USING (active)`).

---

## 6. Required application-code changes

**Hard rule:** each 🔴 admin browser query (§3) must move to a server API (service role +
`requireAdmin`) **before** its table is locked, or the admin panel breaks.

**site_settings remediation (this change set):**
- New `lib/siteSettingsShared.ts` — editable-key allowlist, secret-key/token detection, draft-key
  validation, response filtering (pure, unit-tested).
- New `app/api/admin/site-settings/route.ts` — GET/PUT/DELETE over the allowlist; never returns secrets.
- New `app/api/admin/drafts/route.ts` — per-inquiry draft sync (replaces conversation page's direct
  `site_settings` draft access).
- `app/admin/page.tsx` — `fetchSiteSettings`/`updateSiteSetting` now call the API.
- `app/admin/conversation/[id]/page.tsx` — draft load/save/clear now call `/api/admin/drafts`.
- Gmail tokens moved behind `lib/gmailTokens.ts` (reads `gmail_credentials`),
  `app/api/gmail/callback/route.ts` (writes `gmail_credentials`), `app/api/gmail/status/route.ts`
  (status only — never returns raw tokens).
- `lib/requireAdmin.ts` refactored to use `lib/adminAuthShared.ts` `isValidAdminSession()` (testable).

**Later Phase 2 (one route per table, then its lockdown migration):**
`/api/admin/payments` (read), `/api/admin/inquiries`, `/api/admin/blog` (+ image_library),
`/api/admin/links` (+ analytics), `/api/admin/portfolio`, `/api/admin/bay-area-locations`,
`/api/admin/locations`, `/api/admin/poses`, grad-photo import route.

**Public client reads — recommended to convert to server components** (stronger than anon SELECT):
the 5 grad-guide client components. If converted, drop the Group-A anon policies → zero anon table
access anywhere. If kept client-side, the narrow anon SELECT policies are the fallback.

**Storage (Phase 4, separate track):** move uploads (`lib/uploadImage.ts`) server-side; tighten
`storage.objects` policies on `grad-photos` (anon read-only, no anon insert).

**No change needed:** `/journal` + `/journal/[slug]` are retired (no routes). Contact, client
portal, availability, and all public marketing pages already use server/service-role paths.

---

## 7. Rollback

Each migration ships a scoped `_rollback.sql`. Summary:
- Group A (guide tables, were RLS-off): drop the anon SELECT policies, re-grant, `disable row level security`.
- Groups C–F (were RLS-off): `disable row level security` (clears FORCE too) and re-grant.
- Group B (were RLS-on with `USING(true)`): recreate the original permissive `public` policies
  (this re-opens the original hole — emergency use only).
- `gmail_credentials`: `drop table` (after copying any needed token back — but prefer reconnecting).

See the individual `*_rollback.sql` files for exact statements.

---

## 8. Test plan

**Unit (Node test runner, `tests/*.test.mjs`):**
- `tests/siteSettings.test.mjs` — allowlist accepts only known keys; unknown/secret keys rejected;
  `gmail_tokens` never editable/returnable; token-shaped values filtered; draft-key pattern.
- `tests/adminAuthShared.test.mjs` — `isValidAdminSession()` false for missing secret / missing
  cookie / mismatch; true only on exact match (proves the 401 path in `requireAdmin`).

**DB-level (run in Supabase SQL editor — see `*_verify.sql`):**

```sql
-- NEGATIVE: anon cannot read secrets/private/financial
BEGIN; SET LOCAL role anon;
SELECT count(*) FROM public.site_settings;  -- expect ERROR or 0
SELECT count(*) FROM public.payments;        -- expect 0
SELECT count(*) FROM public.inquiries;       -- expect 0
SELECT count(*) FROM public.vault_notes;     -- expect 0
ROLLBACK;

-- NEGATIVE: anon cannot write
BEGIN; SET LOCAL role anon;
INSERT INTO public.inquiries (name,email,message) VALUES ('x','x@x.com','x'); -- expect ERROR
ROLLBACK;

-- POSITIVE: anon can read public guide content
BEGIN; SET LOCAL role anon;
SELECT count(*) FROM public.location_spots;  -- expect 16
SELECT count(*) FROM public.grad_poses;      -- expect 8
ROLLBACK;

-- POSITIVE: client sees only their own sessions
BEGIN; SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<CLIENT_AUTH_UID>","email":"client@example.com"}';
SELECT count(*) FROM public.client_sessions;  -- expect only that client's rows
SELECT count(*) FROM public.payments;          -- expect 0
ROLLBACK;

-- POSITIVE: service role bypasses (server keeps working) — run via service connection
SELECT count(*) FROM public.payments;     -- expect 115
SELECT count(*) FROM public.site_settings; -- expect 41
```

**Integration / manual smoke (after each phase):** load `/`, `/blog`, a post, `/portfolio`,
`/pricing/*`, `/bay-area-locations`, `/availability`, `/links`, the 5 grad-guide pages; submit the
contact form; exercise each migrated admin tab; log into `/dashboard` as a client; reconnect Gmail.

---

## 9. Safe deployment order

**Phase 0 — Prep (no prod change):** keep each group as a separate migration + rollback. Back up.
Add `client_sessions` indexes (safe anytime).

**Phase 1 — Lock server-only + public-guide tables (low risk):**
`vault_notes`, `chat_conversations`, `chat_messages`, `ai_training_sessions`, `link_clicks`,
`link_views`, `professional_availability`, plus guide tables (`grad_*`, `location_spots`) with
anon SELECT. (`availability` via the existing `20260604` pair.) → `20260606000002_phase1_*`.

**Phase 1.5 — site_settings incident remediation (do ASAP):** see §10/§11.

**Phase 2 — Per-table admin→server migration, then lock:** order
`payments → inquiries → blog_posts (+image_library) → links (+analytics) → portfolio_images →
portfolio_categories → bay_area_locations → location_spots → grad_poses → grad_photos`.
For each: ship the route + switch the component, deploy, verify the admin tab, apply the table's
lockdown migration, re-verify.

**Phase 3 — (optional, strongest):** convert grad-guide client components to server components;
drop Group-A anon policies → zero anon table access remains.

**Phase 4 — Storage hardening (separate track).**

---

## 10. Incident-response checklist — Gmail OAuth exposure (MANUAL)

> Do **not** print existing Gmail tokens into logs, test output, terminal, commits, or API
> responses at any point.

- [ ] **Revoke** the currently stored Google OAuth access **and refresh** tokens
      (https://myaccount.google.com/permissions → remove this app's access; and/or call Google's
      token revocation endpoint for the refresh token).
- [ ] **Disconnect** the existing Google authorization grant (same screen).
- [ ] **Remove/null** the exposed `gmail_tokens` value from `site_settings`
      (e.g. `DELETE FROM site_settings WHERE key='gmail_tokens';` via service role — do not echo it).
- [ ] **Deploy** the new server routes + migrated admin UI (this change set).
- [ ] **Apply** `20260606000000_create_gmail_credentials.sql` then
      `20260606000001_emergency_lock_site_settings.sql`.
- [ ] **Reconnect** Gmail (admin → connect) to generate a fresh authorization grant; confirm the
      new tokens land in `gmail_credentials` (service-role only), not `site_settings`.
- [ ] **Confirm** new credentials are written only by server-side code.
- [ ] **Review** Supabase DB/API logs for unexpected `site_settings` access during the exposure window.
- [ ] **Review** Google account security & OAuth activity for unfamiliar usage.
- [ ] **Search** all `site_settings` rows for additional secrets (API keys, tokens, passwords).
- [ ] **Rotate** any other credential found in `site_settings`.
- [ ] **Verify** no secrets are present in Git history, server logs, browser bundles, or API responses.

---

## 11. Exact manual revoke/reconnect order (safe sequence)

1. Revoke the existing Google OAuth authorization (refresh token first — it can mint new access
   tokens until invalidated).
2. Delete/null the existing `gmail_tokens` row in `site_settings`.
3. Deploy the server-route migration (this change set).
4. Apply `create_gmail_credentials`, then enable+force RLS on `site_settings`
   (`emergency_lock_site_settings`).
5. Reconnect Gmail → generate fresh tokens (stored in `gmail_credentials`).
6. Confirm no token is visible via browser dev tools (network/JS) or any API response.
7. Continue with the remaining Phase 2 tables.

> Merely rotating the access token is insufficient — the **refresh token** is the durable
> credential and must be revoked/invalidated.

---

## 12. Remaining paths capable of returning or mutating Gmail credentials (post-change)

After this change set, raw Gmail tokens are touched only by **server-side, service-role code**:
- `lib/gmailTokens.ts` `getValidTokens()` — reads/refreshes/writes `gmail_credentials`; returns the
  token object **only to other server code** (Gmail API callers), never to a browser response.
- `app/api/gmail/callback/route.ts` — writes `gmail_credentials`; returns a redirect only.
- `app/api/gmail/status/route.ts` — returns safe status only (`connected`, `email`, `expiry`,
  `reconnectRequired`); never raw tokens. `DELETE` removes the row.
- Gmail-sending/reading routes consume `getValidTokens()` server-side only.

No client component imports the browser Supabase client for `site_settings` or `gmail_credentials`.
The generic `/api/admin/site-settings` endpoint cannot return secret keys (allowlist + token-shape
filter). The only way to read the raw refresh token is a service-role connection (DB master key),
which is the intended trust boundary.

---

## 13. Incident execution log

### 2026-06-05 — containment in progress

**Step 4 — `site_settings` secret audit (read-only; key names + value lengths only, never contents).**
41 keys. Pattern scan flagged exactly **one** credential row: `gmail_tokens` (suspect key name +
suspect value shape). Other non-image keys present:
- `inquiry_notes_<id>` ×8 — client-private notes. **No current code path** (zero code references).
  Orphaned legacy data. Not a credential; no rotation needed. Recommend deleting/migrating as cleanup.
- `reply_style` (~12.7 KB) — AI tone profile. **No current code path** (zero references). Legacy;
  not a credential. After lockdown, readable only by service role.
- `draft_*` / `ai_draft_*` / `original_ai_draft_*` — handled by `/api/admin/drafts`.
- `reminder_*` (via `/api/reminder-templates`), `home_*` / `pricing_*` (via `/api/admin/site-settings`),
  `gmail_blocked_senders` (server lib) — all server-mediated.

Conclusion: `gmail_tokens` is the only credential. No additional browser code paths exist for the
other sensitive keys, so the code remediation has no gaps.

**Step 8 — repo search for `gmail_tokens`:** appears only in docs, migration SQL, and one
explanatory comment — never in code that reads/writes the key. ✓

**Step 9 — clean baseline:**
- `tsc --noEmit` → exit 0.
- Focused security tests (`siteSettings`, `adminAuthShared`) → 11/11 pass.
- Full suite → 37 pass / 2 fail. The 2 failures (`normalizePortfolioSeoTags`,
  `buildPortfolioSeoDescription` in `portfolioSeoDescription.test.mjs`) are **pre-existing and
  unrelated** to this work — recorded here rather than treating the suite as fully green.

**Step status:**
| # | Step | Owner | Status |
|---|---|---|---|
| 1 | Revoke Google OAuth grant | **Human (Google account)** | ⏳ pending — gates 2–3 |
| 2 | Apply emergency_lock_site_settings + verify | Claude (MCP) | ⏳ ready; awaits step 1 confirmation |
| 3 | DELETE gmail_tokens row | Claude (MCP) | ⏳ ready; awaits step 1 confirmation |
| 4 | Audit remaining keys | Claude | ✅ done (above) |
| 5 | Apply create_gmail_credentials + verify | Claude (MCP) | ⏳ ready; awaits step 1 confirmation |
| 6 | Deploy app code | **Human (commit + Vercel)** | ⏳ pending (not yet committed) |
| 7 | Reconnect Gmail | **Human (browser OAuth)** | ⏳ pending |
| 8 | Incident verification | Human + Claude | partial — repo search ✅; runtime/Google/Supabase-log review pending |
| 9 | Clean baseline | Claude | ✅ done (above) |
