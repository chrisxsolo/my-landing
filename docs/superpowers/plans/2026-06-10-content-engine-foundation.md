# Content Engine Foundation (Plan 1 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Session Content Engine's database foundation — all eight additive migrations, both transactional RPCs, and the mandatory integration-test suite proving them — per spec `docs/superpowers/specs/2026-06-10-session-content-engine-design.md` (commit 5386b20), phases 1–3.

**Architecture:** Six new locked-down tables + one `testimonials` column + one `portfolio_images` unique index, then two `security definer` RPCs (`create_content_package`, `publish_session_content_item`) that perform all generation-versioning and publication writes transactionally. Everything is verified by Vitest integration tests against a local Supabase stack seeded with a production schema baseline. **Nothing in this plan is applied to production** — that is an explicit later gate.

**Tech Stack:** Supabase (Postgres 17, plpgsql, CLI local stack), Vitest, @supabase/supabase-js, psql.

**Plan series:** 1 Foundation (this plan) → 2 Upload pipeline + domain modules/Zod → 3 Analysis & generation → 4 Publishers' Node side + admin workflow UI → 5 Public-page integrations → 6 Analytics + deployment verification. Social captions are Phase 2 of the product and appear in **no** plan.

**Spec is law:** if any step here contradicts the spec, the spec wins; stop and flag it.

---

## File Structure

```
supabase/migrations/
  20260611000001_create_photography_sessions.sql      (+ _rollback.sql, _verify.sql)
  20260611000002_create_session_photos.sql             (+ _rollback.sql, _verify.sql)
  20260611000003_create_packages_and_items.sql         (+ _rollback.sql, _verify.sql)
  20260611000004_create_school_page_photos.sql         (+ _rollback.sql, _verify.sql)
  20260611000005_create_content_events.sql             (+ _rollback.sql, _verify.sql)
  20260611000006_alter_testimonials_add_session.sql    (+ _rollback.sql, _verify.sql)
  20260611000007_portfolio_content_hash_unique.sql     (+ _rollback.sql, _verify.sql)
  20260611000008_create_content_engine_rpcs.sql        (+ _rollback.sql, _verify.sql)
supabase/test/
  audit-live-schema.sql        — phase-1 compatibility audit queries
  prod-baseline.sql            — schema-only dump of production (GITIGNORED, regenerated)
scripts/content-engine/
  reset-test-db.sh             — baseline + new migrations into the local stack
vitest.config.ts
tests/unit/smoke.test.ts
tests/integration/
  helpers.ts                   — clients, fixtures, db reset hook
  packages.test.ts             — create_content_package behavior
  publish-guards.test.ts       — permissions, claims, rollback, RPC privileges
  publish-journal.test.ts      — journal mapping (spec §9.3)
  publish-portfolio.test.ts    — insert + content_hash reconciliation
  publish-school-guide.test.ts — school conflict-reconcile, guide advisory lock, testimonial
package.json                   — modify: test scripts, vitest devDependency
.gitignore                     — modify: test artifacts
```

Conventions used throughout: every new table follows the `testimonials` lockdown (revoke anon/authenticated, grant service_role, enable + force RLS, zero policies); every `_rollback.sql` refuses to run when its tables contain rows (pre-launch vs post-launch modes, spec §14); migrations are idempotent (`if not exists` / `or replace`).

---

### Task 1: Vitest tooling

**Files:**
- Create: `vitest.config.ts`, `tests/unit/smoke.test.ts`
- Modify: `package.json` (scripts + devDependency)

- [ ] **Step 1: Install vitest (dev dependency only)**

Run: `npm install -D vitest`
Expected: `vitest` appears under `devDependencies` in `package.json`; lockfile updated.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // unit tests run anywhere; integration tests need the local Supabase stack
    include: ["tests/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add npm scripts**

In `package.json` `"scripts"`, add (keep existing entries):

```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 4: Create `vitest.integration.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    // tests share one database; no parallel files. Deliberate concurrency
    // happens INSIDE tests via Promise.allSettled.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
```

- [ ] **Step 5: Write the smoke test `tests/unit/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("vitest tooling", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.integration.config.ts tests/unit/smoke.test.ts
git commit -m "chore: add vitest tooling for content engine tests"
```

---

### Task 2: Local Supabase stack + production schema baseline

The repo has migrations but **no** `supabase/config.toml` and no CLI installed. Historical migrations are not locally replayable (they alter tables like `blog_posts` that predate the migrations folder), so the local database is built from a **schema-only production dump** plus the new content-engine migrations.

**Files:**
- Create: `scripts/content-engine/reset-test-db.sh`, `supabase/test/` (dir), `.env.test.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install the Supabase CLI and verify Docker**

Run: `brew install supabase/tap/supabase && supabase --version && docker info --format '{{.ServerVersion}}'`
Expected: a CLI version string and a Docker version string. **If Docker is unavailable, STOP** — the fallback is a disposable cloud branch (Supabase MCP `create_branch`, costs money, needs explicit user confirmation). Do not improvise against production.

- [ ] **Step 2: Initialize and link the project**

Run: `supabase init` (accept defaults; creates `supabase/config.toml`, keeps existing `supabase/migrations/`)
Then: `supabase login` (interactive; user provides access token)
Then: `supabase link --project-ref dmtslzwglpezympptqls`
Expected: "Finished supabase link."

- [ ] **Step 3: Dump the production schema baseline (schema only, no data)**

Run: `supabase db dump --linked -f supabase/test/prod-baseline.sql`
Expected: file created, contains `CREATE TABLE public.blog_posts`, `public.portfolio_images`, `public.client_sessions`, `public.inquiries`, `public.image_library`, `public.testimonials`, `public.family_location_photos`, `public.couples_location_photos`, and `CREATE FUNCTION public.set_updated_at`.
Verify: `grep -c "CREATE TABLE" supabase/test/prod-baseline.sql` returns a number ≥ 15.

- [ ] **Step 4: Gitignore the baseline and test env**

Append to `.gitignore`:

```
supabase/test/prod-baseline.sql
.env.test
```

(The baseline is regenerated, not versioned — committing it would drift from production.)

- [ ] **Step 5: Start the local stack and capture credentials**

Run: `supabase start` then `supabase status`
Expected: status prints `API URL: http://127.0.0.1:54321`, `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`, an `anon key`, and a `service_role key`.

Create `.env.test` (gitignored) and `.env.test.example` (committed, placeholder values):

```
SUPABASE_TEST_URL=http://127.0.0.1:54321
SUPABASE_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_TEST_ANON_KEY=<anon key from supabase status>
SUPABASE_TEST_SERVICE_KEY=<service_role key from supabase status>
```

- [ ] **Step 6: Write `scripts/content-engine/reset-test-db.sh`**

```bash
#!/usr/bin/env bash
# Rebuilds the LOCAL test database: production schema baseline + the new
# content-engine migrations (+ their verify scripts). Never touches production.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_URL="${SUPABASE_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ ! -f supabase/test/prod-baseline.sql ]]; then
  echo "Missing supabase/test/prod-baseline.sql — run: supabase db dump --linked -f supabase/test/prod-baseline.sql" >&2
  exit 1
fi

supabase db reset --no-seed --local >/dev/null   # empty local db (drops everything)
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/test/prod-baseline.sql

for f in supabase/migrations/20260611*.sql; do
  case "$f" in
    *_rollback.sql|*_verify.sql) continue ;;
  esac
  echo "applying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

for f in supabase/migrations/20260611*_verify.sql; do
  [[ -e "$f" ]] || continue
  echo "verifying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "test db ready"
```

Run: `chmod +x scripts/content-engine/reset-test-db.sh`

Note: `supabase db reset --no-seed --local` will also replay `supabase/migrations/` — including historical migrations that fail against an empty database. If it errors, move the **historical** migrations aside for local runs by configuring `supabase/config.toml` `[db.migrations] enabled = false` (CLI ≥ v2) or, simplest, change the loop to apply the baseline to a freshly created database via `psql -c 'drop schema public cascade; create schema public;'` instead of `supabase db reset`. Pick whichever works, keep the script's contract: **baseline, then only `20260611*` migrations, then verifies.**

- [ ] **Step 7: Run it (no new migrations exist yet — baseline only)**

Run: `./scripts/content-engine/reset-test-db.sh`
Expected: `test db ready` (the `20260611*` loop matches nothing yet).

- [ ] **Step 8: Commit**

```bash
git add supabase/config.toml scripts/content-engine/reset-test-db.sh .env.test.example .gitignore
git commit -m "chore: local supabase test stack with production schema baseline"
```

---

### Task 3: Live-schema compatibility audit (spec phase 1)

**Files:**
- Create: `supabase/test/audit-live-schema.sql`

- [ ] **Step 1: Write the audit script**

```sql
-- Content-engine live-schema compatibility audit (spec §3 intro, §9.3, §14).
-- Run against the baseline-loaded local DB or production (read-only).
-- Every check raises on failure, so a clean run = compatible schema.

do $$
begin
  -- blog_posts: required columns exist, excerpt/meta_title absent
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='blog_posts'
     and column_name in ('title','body','slug','category','sites','cover_image_url',
       'extra_image_urls','meta_description','meta_keywords','og_image_url',
       'cover_image_alt','extra_image_alts','published_at')
  having count(*) = 13;
  if not found then raise exception 'blog_posts is missing expected columns'; end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='blog_posts'
               and column_name in ('excerpt','meta_title')) then
    raise exception 'blog_posts unexpectedly has excerpt/meta_title — update spec §9.3';
  end if;

  -- portfolio_images.content_hash exists (text)
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='portfolio_images'
                   and column_name='content_hash' and data_type='text') then
    raise exception 'portfolio_images.content_hash missing — migration 7 must create it';
  end if;

  -- FK target id types
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='client_sessions'
                   and column_name='id' and data_type='uuid') then
    raise exception 'client_sessions.id is not uuid';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='inquiries'
                   and column_name='id' and data_type='bigint') then
    raise exception 'inquiries.id is not bigint';
  end if;

  -- shared trigger function
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() missing';
  end if;

  -- image_library identity columns used by the journal publisher
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='image_library'
     and column_name in ('title','alt','image_url','source_type','source_post_id',
                         'source_post_slug','source_role','in_portfolio')
  having count(*) = 8;
  if not found then raise exception 'image_library missing expected columns'; end if;

  -- guide tables used by the guide publisher
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='family_location_photos'
     and column_name in ('location_slug','image_url','alt_text','caption','published','sort_order')
  having count(*) = 6;
  if not found then raise exception 'family_location_photos missing expected columns'; end if;
  perform 1 from information_schema.columns
   where table_schema='public' and table_name='couples_location_photos'
     and column_name in ('location_slug','image_url','alt_text','caption','published','sort_order')
  having count(*) = 6;
  if not found then raise exception 'couples_location_photos missing expected columns'; end if;

  raise notice 'AUDIT OK: live schema is compatible with the content-engine spec';
end $$;

-- Informational (run against PRODUCTION read-only; expected 2026-06-10: 173 / 43 / 0)
-- select count(*) total, count(content_hash) with_hash from public.portfolio_images;
-- select count(*) dupes from (select content_hash from public.portfolio_images
--   where content_hash is not null group by 1 having count(*)>1) d;
```

- [ ] **Step 2: Run it against the baseline-loaded local DB**

Run: `psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/test/audit-live-schema.sql`
Expected: `NOTICE:  AUDIT OK: live schema is compatible with the content-engine spec`

- [ ] **Step 3: Run the two informational queries against production** (read-only, via the Supabase MCP `execute_sql` or dashboard SQL editor) and record the counts in the PR/commit message. Expected: `total=173, with_hash=43, dupes=0` (or current values; **dupes must be 0** or migration 7 cannot apply — stop and flag).

- [ ] **Step 4: Commit**

```bash
git add supabase/test/audit-live-schema.sql
git commit -m "chore: content engine live-schema compatibility audit"
```

---

### Task 4: Migration 1 — `photography_sessions`

**Files:**
- Create: `supabase/migrations/20260611000001_create_photography_sessions.sql`, `..._rollback.sql`, `..._verify.sql`

- [ ] **Step 1: Write the migration** (`20260611000001_create_photography_sessions.sql`)

```sql
-- Canonical marketing-session parent (spec §3.1).
create extension if not exists "pgcrypto";

create table if not exists public.photography_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid null references public.client_sessions(id) on delete set null,
  inquiry_id bigint null references public.inquiries(id) on delete set null,

  internal_client_name text null,
  public_display_name text null,
  service_type text not null check (service_type in
    ('grads','couples','families','portraits','maternity','events','other')),
  school_slug text null,
  primary_location text null,
  secondary_locations text[] not null default '{}',
  session_date date null,
  start_time time null,
  lighting_condition text null check (lighting_condition is null or lighting_condition in
    ('morning','midday','afternoon','golden_hour','blue_hour','night','mixed')),
  graduation_year int null check (graduation_year is null or graduation_year between 2000 and 2100),
  degree text null,
  outfit_count int null check (outfit_count is null or outfit_count >= 1),
  group_size int null check (group_size is null or group_size >= 1),

  internal_notes text null,
  public_session_summary text null,

  marketing_permission boolean not null default false,
  marketing_permission_source text null check (marketing_permission_source is null or
    marketing_permission_source in
    ('contract','email','testimonial_form','manual_confirmation','portfolio_collaboration')),
  marketing_permission_confirmed_at timestamptz null,
  marketing_permission_revoked_at timestamptz null,

  ai_processing_allowed boolean not null default false,
  ai_processing_basis text null check (ai_processing_basis is null or ai_processing_basis in
    ('contract','privacy_policy','portfolio_collaboration','manual_confirmation','internal_business_policy')),
  ai_processing_policy_version text null,
  ai_processing_confirmed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_photography_session_per_client_session
  on public.photography_sessions (client_session_id)
  where client_session_id is not null;
create index if not exists photography_sessions_school_idx on public.photography_sessions (school_slug);
create index if not exists photography_sessions_service_idx on public.photography_sessions (service_type);
create index if not exists photography_sessions_date_idx on public.photography_sessions (session_date desc);

drop trigger if exists photography_sessions_set_updated_at on public.photography_sessions;
create trigger photography_sessions_set_updated_at
before update on public.photography_sessions
for each row execute function public.set_updated_at();

revoke all on public.photography_sessions from anon, authenticated;
grant all on public.photography_sessions to service_role;
alter table public.photography_sessions enable row level security;
alter table public.photography_sessions force row level security;
-- Intentionally no anon/authenticated policies (spec §5).
```

- [ ] **Step 2: Write the rollback** (`..._rollback.sql`)

```sql
-- PRE-LAUNCH ONLY (spec §14): refuses when data exists.
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.photography_sessions limit 1) then
    raise exception 'photography_sessions contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.photography_sessions;
commit;
```

- [ ] **Step 3: Write the verify** (`..._verify.sql`)

```sql
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and c.relname='photography_sessions'
                   and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'photography_sessions: RLS not enabled+forced';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='photography_sessions') then
    raise exception 'photography_sessions: unexpected RLS policies exist';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='one_photography_session_per_client_session') then
    raise exception 'photography_sessions: partial unique index missing';
  end if;
  if has_table_privilege('anon','public.photography_sessions','select') then
    raise exception 'photography_sessions: anon can select';
  end if;
  raise notice 'VERIFY OK: photography_sessions';
end $$;
```

- [ ] **Step 4: Apply locally + verify**

Run: `./scripts/content-engine/reset-test-db.sh`
Expected: `applying ...000001...`, `VERIFY OK: photography_sessions`, `test db ready`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000001_create_photography_sessions*.sql
git commit -m "feat: photography_sessions migration with rollback and verify"
```

---

### Task 5: Migration 2 — `session_photos` + private bucket

**Files:**
- Create: `supabase/migrations/20260611000002_create_session_photos.sql`, `..._rollback.sql`, `..._verify.sql`

- [ ] **Step 1: Write the migration**

```sql
-- One-time private photo uploads + server-verified metadata + AI analysis (spec §3.2).
create table if not exists public.session_photos (
  id uuid primary key default gen_random_uuid(),
  photography_session_id uuid not null
    references public.photography_sessions(id) on delete cascade,

  storage_path text not null,
  content_hash text not null,
  original_filename text null,
  width int null check (width is null or width > 0),
  height int null check (height is null or height > 0),
  mime_type text null,
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes > 0),

  public_derivative_url text null,
  public_derivative_storage_path text null,
  public_derivative_content_hash text null,
  public_derivative_created_at timestamptz null,

  sort_order int not null default 0 check (sort_order >= 0),
  excluded boolean not null default false,

  analysis_status text not null default 'pending' check (analysis_status in
    ('pending','processing','completed','failed','skipped')),
  analysis_error text null,
  analysis_model text null,
  analysis_version text null,
  analyzed_at timestamptz null,
  analysis_started_at timestamptz null,
  analysis_lease_expires_at timestamptz null,
  analysis_attempt int not null default 0,

  alt_text text null,
  title text null,
  description text null,
  tags text[] not null default '{}',
  quality_score int null check (quality_score is null or quality_score between 1 and 10),
  suggested_category text null check (suggested_category is null or suggested_category in
    ('grads','couples','families','portraits','maternity')),
  destination_recommendations jsonb null,
  analysis_payload jsonb null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (photography_session_id, content_hash)
);

create index if not exists session_photos_session_idx on public.session_photos (photography_session_id);
create index if not exists session_photos_analysis_idx on public.session_photos (analysis_status);

drop trigger if exists session_photos_set_updated_at on public.session_photos;
create trigger session_photos_set_updated_at
before update on public.session_photos
for each row execute function public.set_updated_at();

revoke all on public.session_photos from anon, authenticated;
grant all on public.session_photos to service_role;
alter table public.session_photos enable row level security;
alter table public.session_photos force row level security;

-- Private bucket for originals (spec §4.1). No public access; no anon/authenticated
-- storage policies — service role bypasses storage RLS, admin UI uses signed URLs.
insert into storage.buckets (id, name, public)
values ('session-content-originals', 'session-content-originals', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Write the rollback**

```sql
-- PRE-LAUNCH ONLY (spec §14).
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.session_photos limit 1) then
    raise exception 'session_photos contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
  if exists (select 1 from storage.objects where bucket_id='session-content-originals' limit 1) then
    raise exception 'session-content-originals bucket is not empty — do not drop';
  end if;
end $$;
drop table if exists public.session_photos;
commit;
-- NOTE: the 'session-content-originals' bucket cannot be deleted via SQL
-- (storage protect_buckets_delete trigger). If a true teardown is needed,
-- delete it via the Storage API / dashboard after this rollback.
```

- [ ] **Step 3: Write the verify**

```sql
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and c.relname='session_photos'
                   and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'session_photos: RLS not enabled+forced';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid='public.session_photos'::regclass and contype='u') then
    raise exception 'session_photos: unique (session, content_hash) missing';
  end if;
  if not exists (select 1 from storage.buckets
                 where id='session-content-originals' and public=false) then
    raise exception 'session-content-originals bucket missing or public';
  end if;
  if has_table_privilege('anon','public.session_photos','select') then
    raise exception 'session_photos: anon can select';
  end if;
  raise notice 'VERIFY OK: session_photos';
end $$;
```

- [ ] **Step 4: Apply locally + verify**

Run: `./scripts/content-engine/reset-test-db.sh`
Expected: both `VERIFY OK` notices so far.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000002_create_session_photos*.sql
git commit -m "feat: session_photos migration with private originals bucket"
```

---

### Task 6: Migration 3 — packages + items

**Files:**
- Create: `supabase/migrations/20260611000003_create_packages_and_items.sql`, `..._rollback.sql`, `..._verify.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Versioned generation runs + independently reviewable drafts (spec §3.3, §3.4).
create table if not exists public.session_content_packages (
  id uuid primary key default gen_random_uuid(),
  photography_session_id uuid not null
    references public.photography_sessions(id) on delete cascade,
  generation_number int not null check (generation_number >= 1),
  status text not null default 'generating' check (status in
    ('generating','ready','needs_attention','failed','archived')),
  session_facts_snapshot jsonb not null default '{}',
  model_name text not null,
  model_version text null,
  prompt_version text not null,
  generation_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  unique (photography_session_id, generation_number),
  check ((status = 'archived' and archived_at is not null)
      or (status <> 'archived' and archived_at is null))
);

create unique index if not exists one_active_package_per_session
  on public.session_content_packages (photography_session_id)
  where archived_at is null;

drop trigger if exists session_content_packages_set_updated_at on public.session_content_packages;
create trigger session_content_packages_set_updated_at
before update on public.session_content_packages
for each row execute function public.set_updated_at();

revoke all on public.session_content_packages from anon, authenticated;
grant all on public.session_content_packages to service_role;
alter table public.session_content_packages enable row level security;
alter table public.session_content_packages force row level security;

create table if not exists public.session_content_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null
    references public.session_content_packages(id) on delete cascade,
  content_type text not null check (content_type in
    ('journal_post','portfolio_pick','school_page_photo','guide_photo',
     'social_caption','testimonial_feature','internal_link_suggestion')),
  status text not null default 'draft' check (status in
    ('draft','approved','rejected','publishing','published','failed')),
  payload jsonb not null default '{}',
  payload_revision int not null default 1,

  copied_from_item_id uuid null
    references public.session_content_items(id) on delete set null,

  generation_model text null,
  prompt_version text null,
  generated_at timestamptz null,

  approved_at timestamptz null,
  approved_by text null,
  rejected_at timestamptz null,
  rejection_reason text null,

  publishing_started_at timestamptz null,
  published_target_type text null check (published_target_type is null or
    published_target_type in ('blog_post','portfolio_image','school_page_photo',
      'family_location_photo','couples_location_photo','testimonial','none')),
  published_target_id text null,
  published_ref jsonb null,
  published_at timestamptz null,

  idempotency_key text not null unique,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists session_content_items_unique_published_target
  on public.session_content_items (published_target_type, published_target_id)
  where published_target_id is not null and published_target_type <> 'none';
create index if not exists session_content_items_published_target_lookup
  on public.session_content_items (published_target_type, published_target_id);
create index if not exists session_content_items_package_idx on public.session_content_items (package_id);
create index if not exists session_content_items_status_idx on public.session_content_items (status);
create index if not exists session_content_items_type_idx on public.session_content_items (content_type);

drop trigger if exists session_content_items_set_updated_at on public.session_content_items;
create trigger session_content_items_set_updated_at
before update on public.session_content_items
for each row execute function public.set_updated_at();

revoke all on public.session_content_items from anon, authenticated;
grant all on public.session_content_items to service_role;
alter table public.session_content_items enable row level security;
alter table public.session_content_items force row level security;
```

- [ ] **Step 2: Write the rollback**

```sql
-- PRE-LAUNCH ONLY (spec §14).
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.session_content_items limit 1)
     or exists (select 1 from public.session_content_packages limit 1) then
    raise exception 'package/item tables contain rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.session_content_items;
drop table if exists public.session_content_packages;
commit;
```

- [ ] **Step 3: Write the verify**

```sql
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='one_active_package_per_session') then
    raise exception 'one_active_package_per_session missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='session_content_items_unique_published_target') then
    raise exception 'unique published target index missing';
  end if;
  if has_table_privilege('anon','public.session_content_items','select')
     or has_table_privilege('authenticated','public.session_content_items','select')
     or has_table_privilege('anon','public.session_content_packages','select')
     or has_table_privilege('authenticated','public.session_content_packages','select') then
    raise exception 'engine tables readable by anon/authenticated';
  end if;
  raise notice 'VERIFY OK: packages and items';
end $$;
```

- [ ] **Step 4: Apply locally + verify**

Run: `./scripts/content-engine/reset-test-db.sh` — expect `VERIFY OK: packages and items`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000003_create_packages_and_items*.sql
git commit -m "feat: content packages and items migrations"
```

---

### Task 7: Migrations 4–6 — `school_page_photos`, `content_events`, `testimonials` column

**Files:**
- Create: `supabase/migrations/20260611000004_create_school_page_photos.sql` (+rollback/verify), `20260611000005_create_content_events.sql` (+rollback/verify), `20260611000006_alter_testimonials_add_session.sql` (+rollback/verify)

- [ ] **Step 1: Write migration 4** (`...000004_create_school_page_photos.sql`)

```sql
-- DB-backed school-page galleries; canonical photo is the session_photos row (spec §3.5).
create table if not exists public.school_page_photos (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null check (length(trim(school_slug)) > 0),
  session_photo_id uuid not null
    references public.session_photos(id) on delete cascade,
  alt_override text null,
  caption text null,
  sort_order int not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_slug, session_photo_id)
);

create index if not exists school_page_photos_slug_active_idx
  on public.school_page_photos (school_slug, active);

drop trigger if exists school_page_photos_set_updated_at on public.school_page_photos;
create trigger school_page_photos_set_updated_at
before update on public.school_page_photos
for each row execute function public.set_updated_at();

revoke all on public.school_page_photos from anon, authenticated;
grant all on public.school_page_photos to service_role;
alter table public.school_page_photos enable row level security;
alter table public.school_page_photos force row level security;
```

Rollback (`...000004_..._rollback.sql`):

```sql
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.school_page_photos limit 1) then
    raise exception 'school_page_photos contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.school_page_photos;
commit;
```

Verify (`...000004_..._verify.sql`):

```sql
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid='public.school_page_photos'::regclass and contype='u') then
    raise exception 'school_page_photos unique (school_slug, session_photo_id) missing';
  end if;
  if has_table_privilege('anon','public.school_page_photos','select')
     or has_table_privilege('anon','public.school_page_photos','insert') then
    raise exception 'school_page_photos readable by anon';
  end if;
  raise notice 'VERIFY OK: school_page_photos';
end $$;
```

- [ ] **Step 2: Write migration 5** (`...000005_create_content_events.sql`)

```sql
-- Privacy-conscious first-party analytics (spec §3.6, §10). High volume: bigint identity.
create table if not exists public.content_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in
    ('page_view','cta_click','portfolio_open','inquiry_start','inquiry_submit')),
  path text not null check (length(path) <= 200),
  viewed_at timestamptz not null default now(),
  referrer_domain text null,
  content_type text null,
  content_id text null,
  photography_session_id uuid null
    references public.photography_sessions(id) on delete set null,
  content_item_id uuid null
    references public.session_content_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists content_events_viewed_idx on public.content_events (viewed_at);
create index if not exists content_events_path_idx on public.content_events (path);
create index if not exists content_events_type_idx on public.content_events (event_type);
create index if not exists content_events_content_idx on public.content_events (content_type, content_id);
create index if not exists content_events_session_idx on public.content_events (photography_session_id);
create index if not exists content_events_content_item_idx on public.content_events (content_item_id);

revoke all on public.content_events from anon, authenticated;
grant all on public.content_events to service_role;
alter table public.content_events enable row level security;
alter table public.content_events force row level security;
```

Rollback:

```sql
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.content_events limit 1) then
    raise exception 'content_events contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.content_events;
commit;
```

Verify:

```sql
do $$
begin
  if (select count(*) from pg_indexes where schemaname='public'
      and tablename='content_events') < 6 then  -- pkey + 5
    raise exception 'content_events indexes missing';
  end if;
  if has_table_privilege('anon','public.content_events','insert') then
    raise exception 'content_events writable by anon (writes must go through /api/track-event)';
  end if;
  raise notice 'VERIFY OK: content_events';
end $$;
```

- [ ] **Step 3: Write migration 6** (`...000006_alter_testimonials_add_session.sql`)

```sql
-- Canonical marketing relationship for testimonials (spec §3.7).
alter table public.testimonials
  add column if not exists photography_session_id uuid null
    references public.photography_sessions(id) on delete set null;
create index if not exists testimonials_photography_session_idx
  on public.testimonials (photography_session_id);
```

Rollback:

```sql
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.testimonials where photography_session_id is not null limit 1) then
    raise exception 'testimonials rows reference photography_sessions — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
alter table public.testimonials drop column if exists photography_session_id;
commit;
```

Verify:

```sql
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='testimonials'
                   and column_name='photography_session_id') then
    raise exception 'testimonials.photography_session_id missing';
  end if;
  raise notice 'VERIFY OK: testimonials column';
end $$;
```

- [ ] **Step 4: Apply locally + verify**

Run: `./scripts/content-engine/reset-test-db.sh` — expect all `VERIFY OK` notices.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000004* supabase/migrations/20260611000005* supabase/migrations/20260611000006*
git commit -m "feat: school_page_photos, content_events, testimonials link migrations"
```

---

### Task 8: Migration 7 — `portfolio_images.content_hash` partial unique index

**Files:**
- Create: `supabase/migrations/20260611000007_portfolio_content_hash_unique.sql` (+rollback/verify)

- [ ] **Step 1: Write the migration**

```sql
-- Race-safe portfolio dedupe (spec §9.2, §14 migration 7).
-- Production verified 2026-06-10: column exists (43/173 rows), zero duplicate
-- hashes. The column guard keeps this portable; null hashes (130 legacy rows)
-- are unaffected by the partial index and excluded from hash reconciliation.
alter table public.portfolio_images
  add column if not exists content_hash text null;

create unique index if not exists portfolio_images_content_hash_unique
  on public.portfolio_images (content_hash)
  where content_hash is not null;
```

Rollback (index only — the column predates this migration in production):

```sql
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
drop index if exists public.portfolio_images_content_hash_unique;
-- The content_hash column is NOT dropped: it exists in production independent
-- of this migration and is used by the existing admin upload dedupe.
commit;
```

Verify:

```sql
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='portfolio_images_content_hash_unique') then
    raise exception 'portfolio_images_content_hash_unique missing';
  end if;
  raise notice 'VERIFY OK: portfolio content_hash unique index';
end $$;
```

- [ ] **Step 2: Apply locally + verify** — `./scripts/content-engine/reset-test-db.sh`, expect `VERIFY OK`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611000007*
git commit -m "feat: partial unique index on portfolio_images.content_hash"
```

---

### Task 9: Integration test harness

**Files:**
- Create: `tests/integration/helpers.ts`

- [ ] **Step 1: Write the helper module**

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";

if (!serviceKey || !anonKey) {
  throw new Error("Set SUPABASE_TEST_SERVICE_KEY / SUPABASE_TEST_ANON_KEY (see .env.test.example)");
}

export const service: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
export const anon: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export function resetDb() {
  execSync("./scripts/content-engine/reset-test-db.sh", { stdio: "inherit" });
}

type SessionOverrides = Partial<{
  marketing_permission: boolean;
  ai_processing_allowed: boolean;
  service_type: string;
  school_slug: string | null;
  public_display_name: string | null;
}>;

export async function createTestSession(overrides: SessionOverrides = {}) {
  const { data, error } = await service
    .from("photography_sessions")
    .insert({
      service_type: "grads",
      public_display_name: "Mia",
      marketing_permission: true,
      marketing_permission_source: "contract",
      marketing_permission_confirmed_at: new Date().toISOString(),
      ai_processing_allowed: true,
      ai_processing_basis: "contract",
      ai_processing_confirmed_at: new Date().toISOString(),
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createTestPhoto(sessionId: string, opts: { derivative?: boolean; alt?: string } = {}) {
  const hash = createHash("sha256").update(randomUUID()).digest("hex");
  const { data, error } = await service
    .from("session_photos")
    .insert({
      photography_session_id: sessionId,
      storage_path: `originals/${sessionId}/${randomUUID()}.jpg`,
      content_hash: hash,
      alt_text: opts.alt ?? "Bay Area grad portrait by soloxsnaps",
      analysis_status: "completed",
      ...(opts.derivative === false
        ? {}
        : {
            public_derivative_url: `http://127.0.0.1:54321/storage/v1/object/public/grad-photos/engine/${sessionId}/${hash}.jpg`,
            public_derivative_storage_path: `engine/${sessionId}/${hash}.jpg`,
            public_derivative_content_hash: hash,
            public_derivative_created_at: new Date().toISOString(),
          }),
    })
    .select("id, content_hash, public_derivative_url")
    .single();
  if (error) throw error;
  return data as { id: string; content_hash: string; public_derivative_url: string | null };
}

export async function createPackage(sessionId: string, selectedTypes: string[] = ["journal_post"]) {
  const { data, error } = await service.rpc("create_content_package", {
    p_session_id: sessionId,
    p_model_name: "claude-sonnet-4-6",
    p_prompt_version: "v1",
    p_selected_types: selectedTypes,
    p_session_facts: { service_type: "grads" },
    p_generation_settings: {},
    p_archive_current: false,
    p_copy_items: [],
  });
  if (error) throw error;
  return data as string; // package uuid
}

export async function createItem(
  packageId: string,
  contentType: string,
  payload: Record<string, unknown>,
  status: "draft" | "approved" = "approved",
) {
  const { data, error } = await service
    .from("session_content_items")
    .insert({
      package_id: packageId,
      content_type: contentType,
      status,
      payload,
      idempotency_key: `${packageId}:${contentType}:${randomUUID()}`,
      ...(status === "approved" ? { approved_at: new Date().toISOString(), approved_by: "test" } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function publish(itemId: string) {
  return service.rpc("publish_session_content_item", { p_item_id: itemId });
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/integration/helpers.ts
git commit -m "test: content engine integration harness"
```

---

### Task 10: Migration 8a — `create_content_package` RPC (test-first)

**Files:**
- Create: `tests/integration/packages.test.ts`
- Create: `supabase/migrations/20260611000008_create_content_engine_rpcs.sql` (started here, completed in Task 11), `..._rollback.sql`, `..._verify.sql`

- [ ] **Step 1: Write the failing tests** (`tests/integration/packages.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem } from "./helpers";

beforeAll(() => resetDb());

describe("create_content_package", () => {
  it("creates package #1 with a pending progress map", async () => {
    const sessionId = await createTestSession();
    const pkgId = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    const { data: pkg } = await service
      .from("session_content_packages")
      .select("*")
      .eq("id", pkgId)
      .single();
    expect(pkg.generation_number).toBe(1);
    expect(pkg.status).toBe("generating");
    expect(pkg.generation_settings.selected_types).toEqual(["journal_post", "portfolio_pick"]);
    expect(pkg.generation_settings.progress.journal_post.status).toBe("pending");
    expect(pkg.generation_settings.progress.journal_post.attempt).toBe(0);
  });

  it("rejects social_caption and unknown types", async () => {
    const sessionId = await createTestSession();
    await expect(createPackage(sessionId, ["social_caption"])).rejects.toThrow(/not offered|invalid/i);
    await expect(createPackage(sessionId, ["nonsense"])).rejects.toThrow(/not offered|invalid/i);
  });

  it("rejects generation when ai_processing_allowed is false", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(createPackage(sessionId)).rejects.toThrow(/ai processing/i);
  });

  it("requires archive_current when an active package exists, then archives consistently", async () => {
    const sessionId = await createTestSession();
    await createPackage(sessionId);
    await expect(createPackage(sessionId)).rejects.toThrow(/active package/i);

    const { data: pkg2, error } = await service.rpc("create_content_package", {
      p_session_id: sessionId,
      p_model_name: "claude-sonnet-4-6",
      p_prompt_version: "v1",
      p_selected_types: ["journal_post"],
      p_session_facts: {},
      p_generation_settings: {},
      p_archive_current: true,
      p_copy_items: [],
    });
    expect(error).toBeNull();

    const { data: pkgs } = await service
      .from("session_content_packages")
      .select("id,generation_number,status,archived_at")
      .eq("photography_session_id", sessionId)
      .order("generation_number");
    expect(pkgs).toHaveLength(2);
    expect(pkgs![0].status).toBe("archived");
    expect(pkgs![0].archived_at).not.toBeNull();
    expect(pkgs![1].id).toBe(pkg2);
    expect(pkgs![1].generation_number).toBe(2);
  });

  it("serializes concurrent creation — exactly one active package survives", async () => {
    const sessionId = await createTestSession();
    await createPackage(sessionId);

    const attempt = () =>
      service.rpc("create_content_package", {
        p_session_id: sessionId,
        p_model_name: "claude-sonnet-4-6",
        p_prompt_version: "v1",
        p_selected_types: ["journal_post"],
        p_session_facts: {},
        p_generation_settings: {},
        p_archive_current: true,
        p_copy_items: [],
      });
    await Promise.allSettled([attempt(), attempt()]);

    const { count } = await service
      .from("session_content_packages")
      .select("id", { count: "exact", head: true })
      .eq("photography_session_id", sessionId)
      .is("archived_at", null);
    expect(count).toBe(1);
  });

  it("copy-forward: draft copies as draft; approved preserved only with flag; published refused", async () => {
    const sessionId = await createTestSession();
    const pkg1 = await createPackage(sessionId);
    const draftId = await createItem(pkg1, "internal_link_suggestion", { links: [] }, "draft");
    const approvedId = await createItem(pkg1, "portfolio_pick", { session_photo_id: null, category: "grads" }, "approved");

    const { data: pkg2, error } = await service.rpc("create_content_package", {
      p_session_id: sessionId,
      p_model_name: "claude-sonnet-4-6",
      p_prompt_version: "v1",
      p_selected_types: ["journal_post"],
      p_session_facts: {},
      p_generation_settings: {},
      p_archive_current: true,
      p_copy_items: [
        { item_id: draftId, preserve_approval: false },
        { item_id: approvedId, preserve_approval: true },
      ],
    });
    expect(error).toBeNull();

    const { data: copies } = await service
      .from("session_content_items")
      .select("content_type,status,copied_from_item_id,published_target_id")
      .eq("package_id", pkg2);
    const byType = Object.fromEntries(copies!.map((c) => [c.content_type, c]));
    expect(byType.internal_link_suggestion.status).toBe("draft");
    expect(byType.internal_link_suggestion.copied_from_item_id).toBe(draftId);
    expect(byType.portfolio_pick.status).toBe("approved");
    expect(byType.portfolio_pick.published_target_id).toBeNull();

    // published source must be refused
    await service.from("session_content_items")
      .update({ status: "published", published_target_type: "none", published_at: new Date().toISOString() })
      .eq("id", approvedId); // mark the pkg1 source item published
    await expect(
      service.rpc("create_content_package", {
        p_session_id: sessionId,
        p_model_name: "claude-sonnet-4-6",
        p_prompt_version: "v1",
        p_selected_types: ["journal_post"],
        p_session_facts: {},
        p_generation_settings: {},
        p_archive_current: true,
        p_copy_items: [{ item_id: approvedId, preserve_approval: true }],
      }).then(({ error }) => { if (error) throw new Error(error.message); }),
    ).rejects.toThrow(/published/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:integration -- packages`
Expected: FAIL — `function public.create_content_package(...) does not exist` (surfaced through the rpc error).

- [ ] **Step 3: Write the RPC migration** (`20260611000008_create_content_engine_rpcs.sql` — first function; Task 11 appends the second to this same file before it is ever applied to production)

```sql
-- Transactional RPCs (spec §8.2, §8.4, §9). security definer with pinned
-- search_path; EXECUTE revoked from PUBLIC/anon/authenticated (spec §5).

create or replace function public.create_content_package(
  p_session_id uuid,
  p_model_name text,
  p_prompt_version text,
  p_selected_types text[],
  p_session_facts jsonb default '{}'::jsonb,
  p_generation_settings jsonb default '{}'::jsonb,
  p_archive_current boolean default false,
  p_copy_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.photography_sessions%rowtype;
  v_active public.session_content_packages%rowtype;
  v_next int;
  v_pkg_id uuid;
  v_type text;
  v_progress jsonb := '{}'::jsonb;
  v_copy jsonb;
  v_src public.session_content_items%rowtype;
  v_src_session uuid;
  v_new_status text;
  v_allowed constant text[] := array[
    'journal_post','portfolio_pick','school_page_photo','guide_photo',
    'testimonial_feature','internal_link_suggestion'];  -- social_caption: Phase 2, not offered
begin
  select * into v_session from public.photography_sessions
   where id = p_session_id for update;
  if not found then raise exception 'photography session not found'; end if;
  if not v_session.ai_processing_allowed then
    raise exception 'ai processing is not allowed for this session';
  end if;

  if p_selected_types is null or array_length(p_selected_types, 1) is null then
    raise exception 'invalid selected types: empty';
  end if;
  foreach v_type in array p_selected_types loop
    if not (v_type = any (v_allowed)) then
      raise exception 'content type % is not offered (invalid)', v_type;
    end if;
    v_progress := v_progress || jsonb_build_object(v_type, jsonb_build_object(
      'status','pending','attempt',0,'lease_started_at',null,
      'lease_expires_at',null,'completed_at',null,'error',null,'usage',null));
  end loop;

  -- block regeneration while anything in this session is actively publishing (spec §8.4)
  if exists (
    select 1 from public.session_content_items i
    join public.session_content_packages p on p.id = i.package_id
    where p.photography_session_id = p_session_id and i.status = 'publishing'
  ) then
    raise exception 'an item is currently publishing — regeneration blocked';
  end if;

  select * into v_active from public.session_content_packages
   where photography_session_id = p_session_id and archived_at is null
   for update;
  if found then
    if not p_archive_current then
      raise exception 'an active package already exists — pass archive_current';
    end if;
    update public.session_content_packages
       set status = 'archived', archived_at = now()
     where id = v_active.id;
  end if;

  select coalesce(max(generation_number), 0) + 1 into v_next
    from public.session_content_packages
   where photography_session_id = p_session_id;

  insert into public.session_content_packages (
    photography_session_id, generation_number, status, session_facts_snapshot,
    model_name, prompt_version, generation_settings
  ) values (
    p_session_id, v_next, 'generating', coalesce(p_session_facts, '{}'::jsonb),
    p_model_name, p_prompt_version,
    coalesce(p_generation_settings, '{}'::jsonb)
      || jsonb_build_object('selected_types', to_jsonb(p_selected_types), 'progress', v_progress)
  ) returning id into v_pkg_id;

  -- copy-forward (spec §8.4): new key, provenance, never a published target
  for v_copy in select * from jsonb_array_elements(coalesce(p_copy_items, '[]'::jsonb)) loop
    select * into v_src from public.session_content_items
     where id = (v_copy->>'item_id')::uuid for update;
    if not found then raise exception 'copy source item not found'; end if;
    select p.photography_session_id into v_src_session
      from public.session_content_packages p where p.id = v_src.package_id;
    if v_src_session is distinct from p_session_id then
      raise exception 'copy source belongs to another session';
    end if;
    if v_src.status in ('published','publishing') then
      raise exception 'cannot copy a published or publishing item';
    end if;
    if v_src.status = 'approved'
       and coalesce((v_copy->>'preserve_approval')::boolean, false)
       and v_src.published_target_id is null then
      v_new_status := 'approved';
    else
      v_new_status := 'draft';
    end if;

    insert into public.session_content_items (
      package_id, content_type, status, payload, copied_from_item_id,
      generation_model, prompt_version, generated_at,
      approved_at, approved_by, idempotency_key
    ) values (
      v_pkg_id, v_src.content_type, v_new_status, v_src.payload, v_src.id,
      v_src.generation_model, v_src.prompt_version, v_src.generated_at,
      case when v_new_status = 'approved' then v_src.approved_at end,
      case when v_new_status = 'approved' then v_src.approved_by end,
      format('%s:%s:copy:%s', v_pkg_id, v_src.content_type, v_src.id)
    );
  end loop;

  return v_pkg_id;
end;
$$;

revoke all on function public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb)
  to service_role;
```

- [ ] **Step 4: Apply and run the tests**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration -- packages`
Expected: all `packages.test.ts` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000008_create_content_engine_rpcs.sql tests/integration/packages.test.ts
git commit -m "feat: create_content_package RPC with copy-forward rules and tests"
```

---

### Task 11: Migration 8b — `publish_session_content_item` RPC (test-first)

**Files:**
- Create: `tests/integration/publish-guards.test.ts`, `tests/integration/publish-journal.test.ts`, `tests/integration/publish-portfolio.test.ts`, `tests/integration/publish-school-guide.test.ts`
- Modify: `supabase/migrations/20260611000008_create_content_engine_rpcs.sql` (append second function)
- Create: `supabase/migrations/20260611000008_create_content_engine_rpcs_rollback.sql`, `..._verify.sql`

- [ ] **Step 1: Write the guard tests** (`tests/integration/publish-guards.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, anon, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

function journalPayload(photo: { id: string }) {
  return {
    title: "Golden Hour at SJSU",
    slug: `golden-hour-sjsu-${Date.now()}`,
    body: "Para one.\n\nPara two.",
    meta_description: "Grad session at SJSU.",
    meta_keywords: "sjsu, graduation photos",
    photo_ids: [photo.id],
    cover_photo_id: photo.id,
    internal_links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
    testimonial_id: null,
  };
}

describe("publish_session_content_item guards", () => {
  it("rejects when marketing_permission is false and leaves the item approved", async () => {
    const sessionId = await createTestSession({ marketing_permission: false });
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo));

    const { error } = await publish(item);
    expect(error?.message).toMatch(/marketing permission/i);
    const { data } = await service.from("session_content_items").select("status").eq("id", item).single();
    expect(data!.status).toBe("approved"); // transaction rolled back, claim undone
  });

  it("rejects items that are not approved", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo), "draft");
    const { error } = await publish(item);
    expect(error?.message).toMatch(/not approved/i);
  });

  it("rejects a second publication of the same item", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo));
    const first = await publish(item);
    expect(first.error).toBeNull();
    const second = await publish(item);
    expect(second.error?.message).toMatch(/already published|not approved/i);
  });

  it("concurrent publishes: exactly one wins", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = journalPayload(photo); // build ONCE — slug must be stable
    const item = await createItem(pkg, "journal_post", payload);
    const results = await Promise.allSettled([publish(item), publish(item)]);
    const successes = results.filter(
      (r) => r.status === "fulfilled" && !(r.value as { error: unknown }).error,
    );
    expect(successes).toHaveLength(1);
    const { count } = await service
      .from("blog_posts").select("id", { count: "exact", head: true })
      .eq("slug", payload.slug);
    expect(count).toBe(1);
  });

  it("slug conflict rolls back everything — no blog row, item still approved", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = journalPayload(photo);
    await service.from("blog_posts").insert({
      title: "Existing", body: "x", slug: payload.slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    });
    const item = await createItem(pkg, "journal_post", payload);
    const { error } = await publish(item);
    expect(error?.message).toMatch(/slug/i);
    const { data } = await service.from("session_content_items")
      .select("status,published_target_id").eq("id", item).single();
    expect(data!.status).toBe("approved");
    expect(data!.published_target_id).toBeNull();
  });

  it("missing public derivative is rejected (Step A must run first)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId, { derivative: false });
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo));
    const { error } = await publish(item);
    expect(error?.message).toMatch(/derivative/i);
  });

  it("RPCs are not executable by anon (PUBLIC/authenticated covered by _verify.sql)", async () => {
    // The authoritative privilege checks (PUBLIC via aclexplode, anon and
    // authenticated via has_function_privilege, pinned search_path) run in
    // 20260611000008_..._verify.sql on every db reset. This is the
    // behavioral double-check through the API surface:
    const { error: anonErr } = await anon.rpc("publish_session_content_item", {
      p_item_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(anonErr).not.toBeNull(); // permission denied for function
    expect(String(anonErr!.message)).toMatch(/permission denied|not.*exist/i);
  });
});
```

- [ ] **Step 2: Write the journal mapping tests** (`tests/integration/publish-journal.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

describe("journal publisher mapping (spec §9.3)", () => {
  it("maps every staged field, appends Keep exploring, and writes image_library rows atomically", async () => {
    const sessionId = await createTestSession();
    const cover = await createTestPhoto(sessionId, { alt: "Mia under Tower Lawn light" });
    const extra = await createTestPhoto(sessionId, { alt: "Cap toss at SJSU" });
    const pkg = await createPackage(sessionId);
    const slug = `sjsu-mapping-${Date.now()}`;
    const item = await createItem(pkg, "journal_post", {
      title: "Golden Hour at SJSU",
      slug,
      body: "Para one.\n\nPara two.",
      meta_description: "desc",
      meta_keywords: "sjsu, grad",
      photo_ids: [cover.id, extra.id],
      cover_photo_id: cover.id,
      internal_links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
      testimonial_id: null,
    });

    const { data: result, error } = await publish(item);
    expect(error).toBeNull();

    const { data: post } = await service.from("blog_posts").select("*").eq("slug", slug).single();
    expect(post.title).toBe("Golden Hour at SJSU");
    expect(post.category).toBe("professional");
    expect(post.sites).toEqual(["professional"]);
    expect(post.cover_image_url).toBe(cover.public_derivative_url);
    expect(post.cover_image_alt).toBe("Mia under Tower Lawn light");
    expect(post.extra_image_urls).toEqual([extra.public_derivative_url]);
    expect(post.extra_image_alts).toEqual(["Cap toss at SJSU"]);
    expect(post.og_image_url).toBe(cover.public_derivative_url);
    expect(post.meta_description).toBe("desc");
    expect(post.meta_keywords).toBe("sjsu, grad");
    expect(post.body).toContain("Para two.");
    expect(post.body).toContain("Keep exploring");
    expect(post.body).toContain("[SJSU grad sessions](/grads/sjsu)");
    expect(post.published_at).not.toBeNull();

    const { data: lib } = await service
      .from("image_library")
      .select("source_role,image_url,source_type,source_post_slug,in_portfolio")
      .eq("source_post_id", post.id)
      .order("source_role");
    expect(lib).toHaveLength(2);
    expect(lib![0].source_role).toBe("cover");
    expect(lib![0].image_url).toBe(cover.public_derivative_url);
    expect(lib![1].source_role).toBe("gallery");
    expect(lib![0].source_type).toBe("journal");
    expect(lib![0].source_post_slug).toBe(slug);
    expect(lib![0].in_portfolio).toBe(false);

    const { data: published } = await service
      .from("session_content_items")
      .select("status,published_target_type,published_target_id,published_at")
      .eq("id", item).single();
    expect(published!.status).toBe("published");
    expect(published!.published_target_type).toBe("blog_post");
    expect(published!.published_target_id).toBe(String(post.id));
    void result;
  });
});
```

- [ ] **Step 3: Write the portfolio tests** (`tests/integration/publish-portfolio.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

async function ensureCategory(slug: string) {
  const { data } = await service.from("portfolio_categories").select("id").eq("slug", slug).maybeSingle();
  if (data) return data.id as number;
  // If the insert errors on a missing "name" column, check the baseline with
  // `\d public.portfolio_categories` and use its actual label column.
  const { data: ins, error } = await service.from("portfolio_categories")
    .insert({ slug, name: slug }).select("id").single();
  if (error) throw error;
  return ins.id as number;
}

describe("portfolio publisher", () => {
  it("inserts a new portfolio image with derivative URL, hash, and next sort_order", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId, { alt: "Grad portrait alt" });
    await ensureCategory("grads");
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads",
      title: "Grad portrait", alt_text: "Grad portrait alt", description: "", featured: false,
    });
    const { error } = await publish(item);
    expect(error).toBeNull();

    const { data: img } = await service.from("portfolio_images")
      .select("image_url,content_hash,category_slug,alt,title,featured")
      .eq("content_hash", photo.content_hash).single();
    expect(img.image_url).toBe(photo.public_derivative_url);
    expect(img.category_slug).toBe("grads");
    expect(img.featured).toBe(false);
  });

  it("reconciles to an existing row with the same content_hash instead of duplicating", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await ensureCategory("grads");
    const { data: existing } = await service.from("portfolio_images").insert({
      title: "Pre-existing", alt: "Pre-existing", image_url: "https://example.com/x.jpg",
      category_slug: "grads", featured: false, sort_order: 999, content_hash: photo.content_hash,
    }).select("id").single();

    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads",
      title: "New", alt_text: "New", description: "", featured: false,
    });
    const { error } = await publish(item);
    expect(error).toBeNull();

    const { count } = await service.from("portfolio_images")
      .select("id", { count: "exact", head: true }).eq("content_hash", photo.content_hash);
    expect(count).toBe(1); // no duplicate
    const { data: it2 } = await service.from("session_content_items")
      .select("published_target_type,published_target_id").eq("id", item).single();
    expect(it2!.published_target_type).toBe("portfolio_image");
    expect(it2!.published_target_id).toBe(String(existing!.id));
  });
});
```

- [ ] **Step 4: Write school/guide/testimonial tests** (`tests/integration/publish-school-guide.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

describe("school, guide, and testimonial publishers", () => {
  it("school_page_photo inserts and reconciles on the unique constraint", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = { session_photo_id: photo.id, school_slug: "sjsu", alt_override: "", caption: "", sort_order: 1 };
    const a = await createItem(pkg, "school_page_photo", payload);
    expect((await publish(a)).error).toBeNull();

    const { data: row } = await service.from("school_page_photos")
      .select("id,school_slug,session_photo_id,active").eq("session_photo_id", photo.id).single();
    expect(row.school_slug).toBe("sjsu");
    expect(row.active).toBe(true);
  });

  it("guide_photo concurrency: advisory lock yields exactly one row", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = { session_photo_id: photo.id, guide: "family", location_key: "baker-beach", alt_text: "Family at Baker Beach" };
    const a = await createItem(pkg, "guide_photo", payload);
    const b = await createItem(pkg, "guide_photo", payload);
    await Promise.allSettled([publish(a), publish(b)]);

    const { count } = await service.from("family_location_photos")
      .select("id", { count: "exact", head: true })
      .eq("location_slug", "baker-beach").eq("image_url", photo.public_derivative_url!);
    expect(count).toBe(1);
  });

  it("testimonial_feature links the testimonial to the session", async () => {
    const sessionId = await createTestSession();
    const { data: t } = await service.from("testimonials").insert({
      first_name: "Mia", last_name: "R", message: "Chris made the whole session feel easy and fun!",
      consent_to_marketing: true, status: "approved",
    }).select("id").single();
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "testimonial_feature", { testimonial_id: t!.id, quote_excerpt: "easy and fun" });
    expect((await publish(item)).error).toBeNull();

    const { data: after } = await service.from("testimonials")
      .select("photography_session_id").eq("id", t!.id).single();
    expect(after!.photography_session_id).toBe(sessionId);
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `npm run test:integration`
Expected: `packages` passes; the three new publish files FAIL with `function public.publish_session_content_item(uuid) does not exist`.

- [ ] **Step 6: Append the publish RPC** to `20260611000008_create_content_engine_rpcs.sql`

```sql
create or replace function public.publish_session_content_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.session_content_items%rowtype;
  v_session public.photography_sessions%rowtype;
  v_session_id uuid;
  v_claimed int;
  v_target_type text;
  v_target_id text;
  v_ref jsonb := '{}'::jsonb;
  -- journal locals
  v_body text; v_slug text; v_link jsonb;
  v_cover public.session_photos%rowtype;
  v_extra_urls text[] := '{}'; v_extra_alts text[] := '{}';
  v_pid uuid; v_photo public.session_photos%rowtype;
  v_post_id bigint;
  -- portfolio locals
  v_existing_pf bigint; v_sort int; v_cat_id bigint;
  -- school/guide locals
  v_school_id uuid; v_guide text; v_guide_existing uuid;
begin
  select i.* into v_item from public.session_content_items i
   where i.id = p_item_id for update;
  if not found then raise exception 'content item not found'; end if;

  select p.photography_session_id into v_session_id
    from public.session_content_packages p where p.id = v_item.package_id;
  select s.* into v_session from public.photography_sessions s
   where s.id = v_session_id for update;

  if not v_session.marketing_permission then
    raise exception 'marketing permission is not enabled for this session';
  end if;
  if v_item.published_target_id is not null then
    raise exception 'item already published';
  end if;
  if v_item.status <> 'approved' then
    raise exception 'item is not approved (status=%)', v_item.status;
  end if;
  if v_item.content_type = 'social_caption' then
    raise exception 'social_caption publishing is Phase 2 and not available';
  end if;

  update public.session_content_items
     set status = 'publishing', publishing_started_at = now()
   where id = p_item_id and status = 'approved';
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then raise exception 'item claimed by another publication'; end if;

  if v_item.content_type = 'journal_post' then
    v_slug := v_item.payload->>'slug';
    if v_slug is null or v_item.payload->>'title' is null or v_item.payload->>'body' is null then
      raise exception 'journal payload incomplete';
    end if;
    if exists (select 1 from public.blog_posts b where b.slug = v_slug) then
      raise exception 'slug conflict: % already exists (an existing post is never assumed ours)', v_slug;
    end if;

    select sp.* into v_cover from public.session_photos sp
     where sp.id = (v_item.payload->>'cover_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'cover photo not found in this session'; end if;
    if v_cover.public_derivative_url is null then
      raise exception 'cover photo has no public derivative — run prepareApprovedDerivatives first';
    end if;

    for v_pid in
      select (e.value #>> '{}')::uuid from jsonb_array_elements(v_item.payload->'photo_ids') e
      where (e.value #>> '{}')::uuid <> v_cover.id
    loop
      select sp.* into v_photo from public.session_photos sp
       where sp.id = v_pid and sp.photography_session_id = v_session_id;
      if not found then raise exception 'photo % not found in this session', v_pid; end if;
      if v_photo.public_derivative_url is null then
        raise exception 'photo % has no public derivative', v_pid;
      end if;
      v_extra_urls := v_extra_urls || v_photo.public_derivative_url;
      v_extra_alts := v_extra_alts || coalesce(v_photo.alt_text, '');
    end loop;

    v_body := v_item.payload->>'body';
    if jsonb_typeof(v_item.payload->'internal_links') = 'array'
       and jsonb_array_length(v_item.payload->'internal_links') > 0 then
      v_body := v_body || E'\n\n## Keep exploring\n';
      for v_link in select * from jsonb_array_elements(v_item.payload->'internal_links') loop
        v_body := v_body || format(E'\n- [%s](%s)', v_link->>'label', v_link->>'url');
      end loop;
    end if;

    insert into public.blog_posts (
      title, body, slug, category, sites, cover_image_url, extra_image_urls,
      cover_image_alt, extra_image_alts, og_image_url,
      meta_description, meta_keywords, published_at
    ) values (
      v_item.payload->>'title', v_body, v_slug, 'professional', array['professional'],
      v_cover.public_derivative_url, v_extra_urls,
      coalesce(v_cover.alt_text, ''), v_extra_alts, v_cover.public_derivative_url,
      v_item.payload->>'meta_description', v_item.payload->>'meta_keywords', now()
    ) returning id into v_post_id;

    -- image_library rows inside the SAME transaction (spec §9.2)
    insert into public.image_library (title, alt, image_url, source_type, source_post_id, source_post_slug, source_role, in_portfolio)
    values (v_item.payload->>'title', coalesce(v_cover.alt_text, v_item.payload->>'title'),
            v_cover.public_derivative_url, 'journal', v_post_id, v_slug, 'cover', false)
    on conflict (source_post_id, source_role, image_url) do nothing;
    for v_pid in
      select (e.value #>> '{}')::uuid from jsonb_array_elements(v_item.payload->'photo_ids') e
      where (e.value #>> '{}')::uuid <> v_cover.id
    loop
      select sp.* into v_photo from public.session_photos sp where sp.id = v_pid;
      insert into public.image_library (title, alt, image_url, source_type, source_post_id, source_post_slug, source_role, in_portfolio)
      values (v_item.payload->>'title', coalesce(v_photo.alt_text, v_item.payload->>'title'),
              v_photo.public_derivative_url, 'journal', v_post_id, v_slug, 'gallery', false)
      on conflict (source_post_id, source_role, image_url) do nothing;
    end loop;

    v_target_type := 'blog_post'; v_target_id := v_post_id::text;
    v_ref := jsonb_build_object('slug', v_slug, 'cover_image_url', v_cover.public_derivative_url);

  elsif v_item.content_type = 'portfolio_pick' then
    select sp.* into v_photo from public.session_photos sp
     where sp.id = (v_item.payload->>'session_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'portfolio photo not found in this session'; end if;
    if v_photo.public_derivative_url is null then
      raise exception 'photo has no public derivative — run prepareApprovedDerivatives first';
    end if;

    select pi.id into v_existing_pf from public.portfolio_images pi
     where pi.content_hash = v_photo.content_hash limit 1;
    if v_existing_pf is not null then
      v_target_type := 'portfolio_image'; v_target_id := v_existing_pf::text;
      v_ref := jsonb_build_object('reconciled', true);
    else
      select pc.id into v_cat_id from public.portfolio_categories pc
       where pc.slug = v_item.payload->>'category';
      if v_cat_id is null then raise exception 'portfolio category % not found', v_item.payload->>'category'; end if;
      select coalesce(max(pi.sort_order), 0) + 1 into v_sort from public.portfolio_images pi;
      insert into public.portfolio_images (title, alt, image_url, category_id, category_slug, featured, sort_order, content_hash)
      values (coalesce(nullif(v_item.payload->>'title',''), 'Portfolio image'),
              coalesce(nullif(v_item.payload->>'alt_text',''), 'Portfolio image'),
              v_photo.public_derivative_url, v_cat_id, v_item.payload->>'category',
              coalesce((v_item.payload->>'featured')::boolean, false), v_sort, v_photo.content_hash)
      returning id into v_existing_pf;
      v_target_type := 'portfolio_image'; v_target_id := v_existing_pf::text;
      v_ref := jsonb_build_object('reconciled', false, 'sort_order', v_sort);
    end if;

  elsif v_item.content_type = 'school_page_photo' then
    select sp.* into v_photo from public.session_photos sp
     where sp.id = (v_item.payload->>'session_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'school photo not found in this session'; end if;
    if v_photo.public_derivative_url is null then
      raise exception 'photo has no public derivative — run prepareApprovedDerivatives first';
    end if;
    insert into public.school_page_photos (school_slug, session_photo_id, alt_override, caption, sort_order, active)
    values (v_item.payload->>'school_slug', v_photo.id,
            nullif(v_item.payload->>'alt_override',''), nullif(v_item.payload->>'caption',''),
            coalesce((v_item.payload->>'sort_order')::int, 0), true)
    on conflict (school_slug, session_photo_id) do nothing;
    select spp.id into v_school_id from public.school_page_photos spp
     where spp.school_slug = v_item.payload->>'school_slug' and spp.session_photo_id = v_photo.id;
    v_target_type := 'school_page_photo'; v_target_id := v_school_id::text;

  elsif v_item.content_type = 'guide_photo' then
    v_guide := v_item.payload->>'guide';
    if v_guide not in ('family','couples') then raise exception 'invalid guide %', v_guide; end if;
    select sp.* into v_photo from public.session_photos sp
     where sp.id = (v_item.payload->>'session_photo_id')::uuid
       and sp.photography_session_id = v_session_id;
    if not found then raise exception 'guide photo not found in this session'; end if;
    if v_photo.public_derivative_url is null then
      raise exception 'photo has no public derivative — run prepareApprovedDerivatives first';
    end if;

    -- race-safe without a unique index on the live table (spec §9.2)
    perform pg_advisory_xact_lock(hashtextextended(
      format('%s:%s:%s', v_guide, v_item.payload->>'location_key', v_photo.public_derivative_content_hash), 0));

    if v_guide = 'family' then
      select f.id into v_guide_existing from public.family_location_photos f
       where f.location_slug = v_item.payload->>'location_key'
         and f.image_url = v_photo.public_derivative_url limit 1;
      if v_guide_existing is null then
        insert into public.family_location_photos (location_slug, image_url, alt_text, published, sort_order)
        values (v_item.payload->>'location_key', v_photo.public_derivative_url,
                nullif(v_item.payload->>'alt_text',''), true,
                coalesce((select max(sort_order)+1 from public.family_location_photos
                          where location_slug = v_item.payload->>'location_key'), 0))
        returning id into v_guide_existing;
      end if;
      v_target_type := 'family_location_photo';
    else
      select c.id into v_guide_existing from public.couples_location_photos c
       where c.location_slug = v_item.payload->>'location_key'
         and c.image_url = v_photo.public_derivative_url limit 1;
      if v_guide_existing is null then
        insert into public.couples_location_photos (location_slug, image_url, alt_text, published, sort_order)
        values (v_item.payload->>'location_key', v_photo.public_derivative_url,
                nullif(v_item.payload->>'alt_text',''), true,
                coalesce((select max(sort_order)+1 from public.couples_location_photos
                          where location_slug = v_item.payload->>'location_key'), 0))
        returning id into v_guide_existing;
      end if;
      v_target_type := 'couples_location_photo';
    end if;
    v_target_id := v_guide_existing::text;

  elsif v_item.content_type = 'testimonial_feature' then
    update public.testimonials t
       set photography_session_id = v_session_id
     where t.id = (v_item.payload->>'testimonial_id')::uuid;
    if not found then raise exception 'testimonial not found'; end if;
    v_target_type := 'testimonial'; v_target_id := v_item.payload->>'testimonial_id';

  elsif v_item.content_type = 'internal_link_suggestion' then
    v_target_type := 'none'; v_target_id := null;

  else
    raise exception 'unsupported content type %', v_item.content_type;
  end if;

  update public.session_content_items
     set status = 'published',
         published_target_type = v_target_type,
         published_target_id = v_target_id,
         published_ref = v_ref,
         published_at = now(),
         error = null
   where id = p_item_id;

  return jsonb_build_object('item_id', p_item_id, 'target_type', v_target_type, 'target_id', v_target_id);
end;
$$;

revoke all on function public.publish_session_content_item(uuid) from public, anon, authenticated;
grant execute on function public.publish_session_content_item(uuid) to service_role;
```

- [ ] **Step 7: Write rollback + verify for migration 8**

`20260611000008_create_content_engine_rpcs_rollback.sql`:

```sql
drop function if exists public.publish_session_content_item(uuid);
drop function if exists public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb);
```

`20260611000008_create_content_engine_rpcs_verify.sql`:

```sql
do $$
declare v_cfg text[];
begin
  if has_function_privilege('anon', 'public.publish_session_content_item(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.publish_session_content_item(uuid)', 'execute') then
    raise exception 'publish RPC executable by anon/authenticated';
  end if;
  -- PUBLIC check: aclexplode on proacl must not contain grantee 0 (PUBLIC)
  if exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.publish_session_content_item(uuid)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'publish RPC executable by PUBLIC';
  end if;
  select proconfig into v_cfg from pg_proc
   where oid = 'public.publish_session_content_item(uuid)'::regprocedure;
  if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
    raise exception 'publish RPC search_path not pinned';
  end if;
  select proconfig into v_cfg from pg_proc
   where oid = 'public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb)'::regprocedure;
  if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
    raise exception 'create_content_package search_path not pinned';
  end if;
  raise notice 'VERIFY OK: content engine RPCs';
end $$;
```

- [ ] **Step 8: Apply and run the full integration suite**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration`
Expected: ALL integration tests PASS (packages, publish-guards, publish-journal, publish-portfolio, publish-school-guide) and the verify prints `VERIFY OK: content engine RPCs`.

If `image_library` lacks the `(source_post_id, source_role, image_url)` unique constraint in the baseline (the `on conflict` would error), check with `\d public.image_library` — if absent, add `create unique index if not exists image_library_source_identity_idx on public.image_library (source_post_id, source_role, image_url);` to migration 8 **before** the functions and note it in the commit (the existing code upserts on exactly this conflict target, so production almost certainly has it; the audit in Task 3 is informational here, the baseline is authoritative).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260611000008* tests/integration/
git commit -m "feat: publish_session_content_item RPC with per-type publishers and integration tests"
```

---

### Task 12: Full-suite run + plan wrap-up

- [ ] **Step 1: Clean rebuild and full run**

Run: `./scripts/content-engine/reset-test-db.sh && npm test && npm run test:integration`
Expected: every unit and integration test passes from a fresh database.

- [ ] **Step 2: Rollback drill (pre-launch mode)**

Run the eight rollback scripts in reverse order against the local DB:

```bash
for f in $(ls -r supabase/migrations/20260611*_rollback.sql); do
  psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

Expected: with test data present, the FIRST data-bearing rollback **fails with the row-guard exception** — that failure is the test passing (post-launch protection works). Then `./scripts/content-engine/reset-test-db.sh`, and re-run the drill **before** inserting any data: all rollbacks succeed, then a final reset restores the stack.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit any stragglers and stop**

```bash
git add -A && git commit -m "chore: content engine foundation complete (plan 1 of 6)"
```

**STOP — do not apply anything to production.** Production application of migrations 1–8 is an explicit, user-authorized step that happens no earlier than Plan 6 (deployment verification), after the upload pipeline and publishers exist. Plan 2 (private upload/finalization pipeline + core domain modules and Zod schemas) is written next, against the now-proven schema.

---

## Self-Review Notes

- **Spec coverage (phases 1–3):** Task 3 = phase 1 audit; Tasks 4–8 = all eight §14 migrations with rollback/verify; Tasks 9–11 = both RPCs + the §13.2 cases in foundation scope (package concurrency, archival, copy-forward, permission rejections, journal atomicity + mapping, rollback on slug conflict, repeat publication, portfolio reconciliation, guide concurrency, school reconciliation, testimonial link, RPC privilege denial incl. PUBLIC via verify script, pinned search_path). Upload-verification, derivative-authorization, AI-processing-route, lease-expiry-route, revocation/takedown, and reconciliation-endpoint tests belong to Plans 2–4 where that code exists; `ai_processing_allowed` enforcement is covered here at the RPC layer.
- **Types:** RPC names/signatures used in `helpers.ts` match the SQL definitions; `published_target_id` is text everywhere; item statuses match the check constraint.
- **No placeholders:** every step has complete code or an exact command with expected output.
