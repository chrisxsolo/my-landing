# Session-to-Marketing Content Engine — Design Specification

Date: 2026-06-10
Status: Approved design, pending implementation plan
Scope: SoloXSnaps (`my-landing`) — Next.js App Router · Supabase · Vercel

---

## 1. Overview

A completed photography session becomes the central source of truth for marketing
content. The engine connects existing systems (sessions, blog, portfolio, image
library, school pages, guides, testimonials, analytics) into one gated workflow:

```
Completed session
→ Create/confirm a photography_sessions record (facts, permissions)
→ Upload final photographs once (private storage)
→ AI analyzes and organizes photographs
→ Generate a versioned content package (drafts only)
→ Chris reviews, edits, approves/rejects each piece
→ Explicit publication copies approved drafts into live tables
→ Targeted route revalidation; analytics attribute results back to the session
```

**Core invariant:** live tables (`blog_posts`, `portfolio_images`, guide photo
tables) are never touched, and public storage is never touched, until an
**administrator explicitly initiates publication for an approved item**.
Drafts cannot leak: unapproved images live in a private bucket and unapproved
copy lives only in staging tables. Within an initiated publication, Step A may
create an unreferenced public derivative before Step B's transaction commits;
if Step B fails the derivative remains an orphaned but unlinked asset, retries
reuse the same content-addressed file, and orphan reconciliation can remove
unused derivatives later (§9.1).

### v1 outputs per session

- Journal/blog post draft (with internal links and optional testimonial quote)
- Portfolio picks + per-photo SEO metadata (alt/title)
- School-page photo placements (new DB-backed gallery on `/grads/*`)
- Guide-photo placements (`family_location_photos` / `couples_location_photos`)
- Testimonial linking
- Internal-link suggestions
- First-party content analytics (`page_view`, `cta_click`)

### Phase 2 (schema-supported, deliberately not built in v1)

Social caption drafts. `social_caption` stays in the `content_type`
constraint, payload schemas, and publisher design so adding it later needs no
redesign — but v1 ships **no** social-caption generator, editor, approval
flow, or publisher, and the generation UI does not offer the type in
`selected_types`. v1 focuses on durable website and SEO outputs.

### Explicit non-goals (v1)

- No redesign of existing pages or admin tabs
- No auto-posting to social platforms
- No backfill requirement for historical content (gradual, optional)
- No refactor of `family_location_photos` / `couples_location_photos` schemas
- No client-facing UI; everything is admin-only

---

## 2. Architecture decision

**Session Content Hub** (chosen over draft-flags-on-live-tables and a
stateless one-shot wizard): a staging layer holds every AI-generated draft tied
to a canonical photography session; publication copies approved drafts into the
existing live tables. Rationale: hybrid approval, zero draft-leak risk by
construction, multi-day review, full audit trail, per-session analytics.

```
photography_sessions  (canonical marketing parent; optional links to
│                      client_sessions and inquiries)
├── session_photos             (one-time private uploads + AI analysis)
├── session_content_packages   (one row per generation run; versioned)
│   └── session_content_items  (independently reviewable drafts)
│         └── publish → blog_posts · portfolio_images · school_page_photos
│                       · family/couples_location_photos · testimonials link
└── testimonials.photography_session_id

content_events (standalone analytics)
```

`client_sessions` remains the operational booking/portal record and is not
modified. A `photography_session` may exist without one (old shoots, test
shoots, portfolio collaborations, marketing-only sessions).

---

## 3. Data model

Six new tables, one new column on `testimonials`, one new unique index on
`portfolio_images.content_hash`, two RPCs. Check constraints over Postgres
enums (matches the `testimonials` house style). All tables with `updated_at`
get the existing `set_updated_at` trigger.

All live-schema assumptions in this spec were verified against the production
database on 2026-06-10 (`information_schema.columns` / `pg_indexes`):
`blog_posts` has no `excerpt` or `meta_title` columns but has
`meta_keywords`, `og_image_url`, `cover_image_alt`, `extra_image_alts`;
`portfolio_images.content_hash` exists (text, nullable; 43 of 173 rows
populated; zero duplicate hashes) with a non-unique index only.

### 3.1 `photography_sessions`

```sql
create table public.photography_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid null references public.client_sessions(id) on delete set null,
  inquiry_id bigint null references public.inquiries(id) on delete set null,

  internal_client_name text null,          -- never published
  public_display_name text null,           -- the ONLY name AI/publication may use
  service_type text not null check (service_type in
    ('grads','couples','families','portraits','maternity','events','other')),
  school_slug text null,                   -- validated in app against canonical taxonomy
  primary_location text null,
  secondary_locations text[] not null default '{}',
  session_date date null,
  start_time time null,
  lighting_condition text null check (lighting_condition in
    ('morning','midday','afternoon','golden_hour','blue_hour','night','mixed')),
  graduation_year int null check (graduation_year is null or graduation_year between 2000 and 2100),
  degree text null,
  outfit_count int null check (outfit_count is null or outfit_count >= 1),
  group_size int null check (group_size is null or group_size >= 1),

  internal_notes text null,                -- never sent to AI, never published
  public_session_summary text null,

  marketing_permission boolean not null default false,
  marketing_permission_source text null check (marketing_permission_source in
    ('contract','email','testimonial_form','manual_confirmation','portfolio_collaboration')),
  marketing_permission_confirmed_at timestamptz null,
  marketing_permission_revoked_at timestamptz null,

  ai_processing_allowed boolean not null default false,
  ai_processing_basis text null check (ai_processing_basis in
    ('contract','privacy_policy','portfolio_collaboration','manual_confirmation','internal_business_policy')),
  ai_processing_policy_version text null,
  ai_processing_confirmed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_photography_session_per_client_session
  on public.photography_sessions (client_session_id)
  where client_session_id is not null;
-- indexes: school_slug, service_type, session_date desc
```

Permission semantics (two separate controls, never conflated):

- `marketing_permission` gates **publication** (server-enforced in the publish
  path; the UI disabling buttons is convenience, not enforcement).
- `ai_processing_allowed` gates **analysis and generation** (sending image
  copies to the AI provider, generating descriptions/drafts). Default `false`.
  When creating from a current client session covered by contract/privacy
  policy, the creation workflow sets it `true` automatically and records
  `ai_processing_basis`, `ai_processing_policy_version`,
  `ai_processing_confirmed_at`. Older/manual sessions require explicit
  confirmation in the UI. The UI explains why generation is disabled.

### 3.2 `session_photos`

```sql
create table public.session_photos (
  id uuid primary key default gen_random_uuid(),
  photography_session_id uuid not null
    references public.photography_sessions(id) on delete cascade,

  -- private source (authoritative, server-verified)
  storage_path text not null,              -- in private bucket session-content-originals
  content_hash text not null,              -- SHA-256 computed SERVER-side at finalize
  original_filename text null,
  width int null check (width is null or width > 0),
  height int null check (height is null or height > 0),
  mime_type text null,
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes > 0),

  -- public derivative (exists only after first publication that uses this photo)
  public_derivative_url text null,
  public_derivative_storage_path text null,
  public_derivative_content_hash text null, -- source hash the derivative was built from
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
  suggested_category text null check (suggested_category in
    ('grads','couples','families','portraits','maternity')),
  destination_recommendations jsonb null,
  analysis_payload jsonb null,             -- raw AI response + usage, size-capped

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (photography_session_id, content_hash)
);
-- indexes: photography_session_id, analysis_status
```

There is no public `image_url` on upload. The private source is read via signed
URLs (admin UI) or service-role downloads (server). Source assets are
immutable: replacing a photo means a new row + new upload; the
unique `(photography_session_id, content_hash)` prevents accidental re-upload.

### 3.3 `session_content_packages`

```sql
create table public.session_content_packages (
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
  generation_settings jsonb not null default '{}',  -- selected_types, progress map, usage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  unique (photography_session_id, generation_number),
  check ((status = 'archived' and archived_at is not null)
      or (status <> 'archived' and archived_at is null))
);

create unique index one_active_package_per_session
  on public.session_content_packages (photography_session_id)
  where archived_at is null;
```

Package status semantics:

- `generating` — selected types pending or processing
- `ready` — every selected type completed or explicitly skipped
- `needs_attention` — ≥1 type failed but completed content exists and retries
  remain possible; completed items stay fully reviewable
- `failed` — package-level failure prevented usable generation
- `archived` — superseded; read-only history

`generation_settings` validated shape:

```jsonc
{
  "selected_types": ["journal_post", "portfolio_pick", "..."],   // immutable per package
  "progress": {
    "journal_post": { "status": "pending|processing|completed|failed|skipped",
                      "attempt": 0, "lease_started_at": null,
                      "lease_expires_at": null, "completed_at": null,
                      "error": null, "usage": null }
  },
  "overrides": { "model_name": null }
}
```

`selected_types` is recorded separately from results so Resume can always
determine what remains.

### 3.4 `session_content_items`

```sql
create table public.session_content_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null
    references public.session_content_packages(id) on delete cascade,
  -- photography_session_id intentionally OMITTED: join through package
  content_type text not null check (content_type in
    ('journal_post','portfolio_pick','school_page_photo','guide_photo',
     'social_caption','testimonial_feature','internal_link_suggestion')),
  status text not null default 'draft' check (status in
    ('draft','approved','rejected','publishing','published','failed')),
  payload jsonb not null default '{}',     -- Zod-validated, per-type schema
  payload_revision int not null default 1, -- optimistic concurrency for autosave

  copied_from_item_id uuid null
    references public.session_content_items(id) on delete set null,

  generation_model text null,
  prompt_version text null,
  generated_at timestamptz null,

  approved_at timestamptz null,
  approved_by text null,
  rejected_at timestamptz null,
  rejection_reason text null,

  publishing_started_at timestamptz null,  -- interrupted-publish detection
  published_target_type text null check (published_target_type is null or
    published_target_type in ('blog_post','portfolio_image','school_page_photo',
                              'family_location_photo','couples_location_photo',
                              'testimonial','none')),
  published_target_id text null,           -- text: spans bigint and uuid targets
  published_ref jsonb null,                -- audit detail (urls, derivative paths)
  published_at timestamptz null,

  idempotency_key text not null unique,    -- session:package:type:destination:photo
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index session_content_items_unique_published_target
  on public.session_content_items (published_target_type, published_target_id)
  where published_target_id is not null and published_target_type <> 'none';

create index session_content_items_published_target_lookup
  on public.session_content_items (published_target_type, published_target_id);
-- indexes: package_id, status, content_type
```

Payload shapes (Zod, abbreviated):

```jsonc
// journal_post  (no excerpt/meta_title: blog_posts has no such columns —
//                nothing is staged that publication would discard, §9.3)
{ "title": "", "slug": "", "body": "", "meta_description": "",
  "meta_keywords": "",
  "photo_ids": ["uuid"], "cover_photo_id": "uuid",
  "internal_links": [{ "url": "/grads/sjsu", "label": "" }],
  "testimonial_id": null }

// portfolio_pick
{ "session_photo_id": "uuid", "category": "grads", "title": "",
  "alt_text": "", "description": "", "featured": false }

// school_page_photo
{ "session_photo_id": "uuid", "school_slug": "uc-berkeley",
  "alt_override": "", "caption": "", "sort_order": 1 }

// guide_photo
{ "session_photo_id": "uuid", "guide": "family|couples",
  "location_key": "", "alt_text": "" }

// social_caption (Phase 2 — schema-supported, not generated/published in v1)
{ "platform": "instagram|tiktok", "caption": "", "photo_ids": ["uuid"] }

// testimonial_feature
{ "testimonial_id": "uuid", "quote_excerpt": "" }

// internal_link_suggestion
{ "links": [{ "url": "", "label": "", "reason": "" }] }
```

### 3.5 `school_page_photos`

```sql
create table public.school_page_photos (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null,               -- validated against canonical taxonomy
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
-- index: (school_slug, active)
```

No duplicated URL/session FKs: the public query joins
`school_page_photos → session_photos` (for `public_derivative_url` and
canonical alt) `→ photography_sessions` when session facts are needed.

### 3.6 `content_events`

```sql
create table public.content_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in
    ('page_view','cta_click','portfolio_open','inquiry_start','inquiry_submit')),
  path text not null,                      -- normalized, query-stripped, <=200 chars
  viewed_at timestamptz not null default now(),  -- SERVER timestamp only
  referrer_domain text null,               -- normalized hostname ('www.google.com','direct')
  content_type text null,
  content_id text null,
  photography_session_id uuid null
    references public.photography_sessions(id) on delete set null,
  content_item_id uuid null
    references public.session_content_items(id) on delete set null,
  created_at timestamptz not null default now()
);
-- indexes: viewed_at, path, event_type, (content_type, content_id), photography_session_id
```

v1 records `page_view` and `cta_click`. Retention: raw events kept 15 months;
documented monthly cleanup
(`delete from content_events where viewed_at < now() - interval '15 months'`).
This is **directional**, cookieless, bot-filtered measurement — not a
commercial analytics platform.

### 3.7 Modified: `testimonials`

```sql
alter table public.testimonials
  add column photography_session_id uuid null
    references public.photography_sessions(id) on delete set null;
```

(`client_session_id` is intentionally not added; the hop exists via
`photography_sessions.client_session_id`.)

### 3.8 Relationship diagram

```
client_sessions (uuid)        inquiries (bigint)
        ▲ 0..1 set-null               ▲ 0..1 set-null
        └────────────┬────────────────┘
            photography_sessions (uuid)
            · facts · marketing_permission · ai_processing_*
            · unique partial idx on client_session_id
                 │ 1                         │ 1
        ┌────────┴───────┐          ┌────────┴────────────┐
        ▼ * cascade      │          ▼ * cascade
   session_photos        │     session_content_packages
   · private source      │     · generation_number (uniq/session)
   · server-verified     │     · one active per session (partial idx)
     hash/dims/mime      │     · status incl. needs_attention
   · analysis + lease    │          │ 1
   · public_derivative_* │          ▼ * cascade
        ▲                │     session_content_items
        │                │     · payload jsonb (Zod) · idempotency_key (uniq)
        │ session_photo_id     · copied_from_item_id (self-FK)
        │                      · published_target_type/id (partial uniq)
   school_page_photos          │
   (new live table)            │ publish (RPC, transactional)
                               ▼
        blog_posts · portfolio_images · school_page_photos
        · family_location_photos · couples_location_photos
        · testimonials.photography_session_id

   content_events ──set-null──▶ photography_sessions, session_content_items
```

---

## 4. Storage architecture and trust boundaries

### 4.1 Buckets

- **`session-content-originals` (new, private).** No public access, no
  anon/authenticated storage policies. Holds all uploaded originals —
  included, excluded, rejected, archived — under the retention policy in
  §4.4. Admin UI thumbnails use short-lived (1h) signed read URLs. Not
  reusing the public `grad-photos` bucket.
- **Existing public bucket(s).** Receive only published derivatives at
  `engine/<session_id>/<photo_id>/<content_hash>.jpg` — content-addressed so a
  replaced source can never serve stale bytes through caches. Published bytes
  at an existing URL are never overwritten.

### 4.2 Upload finalization (server-side trust boundary)

Browser-supplied hash/MIME/size/dimensions are **convenience only** (early
duplicate warning, instant UI). Authoritative flow:

1. Admin requests a signed upload URL from
   `POST /api/admin/session-content/photos/sign` — server validates declared
   filename, MIME (jpeg/png/webp), and max size (25 MB), and issues a path
   it owns: `originals/<session_id>/<uuid>.<ext>`.
2. Browser uploads to the private bucket via the signed URL.
3. Browser calls `POST /api/admin/session-content/photos/finalize`.
4. Server downloads the object (service role), computes **its own SHA-256**,
   runs `sharp.metadata()` to verify width/height/format/orientation and that
   the file is genuinely a supported image; `sharp` is configured with
   `limitInputPixels` (decompression-bomb protection) and max-dimension checks.
5. Server verifies path ownership: the storage path must match the pattern it
   issued for **this** photography session — a caller can never register a
   path belonging to another session.
6. Valid → `session_photos` row with authoritative metadata (server hash feeds
   the unique constraint). Invalid → object deleted, request rejected.

### 4.3 Public derivative lifecycle

- Created only by `prepareApprovedDerivatives(contentItemId)` (publish Step A):
  `requireAdmin` → item is `approved` → `marketing_permission = true` now →
  photo IDs are derived **from the item's validated payload** (never an
  arbitrary browser-supplied list) → photos belong to the item's session →
  source object exists in the private bucket.
- sharp: EXIF-orient → resize ≤2400px → **strip all metadata incl. GPS** →
  JPEG q82 → upload (upsert; content-addressed path makes retries exact) →
  record `public_derivative_*` on `session_photos`.
- Shared-derivative protection on takedown: before deleting a derivative,
  query **all** supported live tables for references; delete only when no
  active placement remains, otherwise remove only the selected live record.
  Private sources are never auto-deleted. A reconciliation check lists
  orphaned derivatives (public files with zero live references) for later
  cleanup.
- A-succeeded/B-failed gap is harmless: an unreferenced public file, reused
  verbatim on retry.

### 4.4 Private-source retention policy

"Forever" is not the operational rule:

- Private sources are retained until manually deleted or until the retention
  review window expires. Default retention window: **24 months after
  `session_date`**, after which the session surfaces in a retention-review
  list — nothing is auto-deleted in v1.
- Deleting a source for a session with active public placements requires a
  blocking warning listing those placements. Published derivatives are
  independent files, so deleting a private source never breaks published
  content.
- Excluded or rejected images may be deleted earlier, after confirming no
  approved or published item references them.
- Abandoned uploads (signed URL issued/used but never finalized) are cleaned
  automatically after 7 days; invalid uploads are deleted immediately at
  finalization (§4.2).
- Permission revocation offers an **optional** source-deletion action; it
  never deletes sources automatically.
- Package archival has no effect on source retention.
- Deferred cleanup tooling (§15): abandoned-upload sweep, orphaned private
  objects after session deletion, retention-window review.

---

## 5. RLS and authorization

Every new table copies the `testimonials` lockdown: `revoke all from anon,
authenticated; grant all to service_role; enable + force row level security;`
**no anon/authenticated policies.**

Both RPCs are `security definer set search_path = public, pg_temp`, use fully
qualified table names, and avoid dynamically constructed SQL. For each
function, `EXECUTE` is revoked from **`PUBLIC`**, `anon`, and `authenticated`
(all three, explicitly — `PUBLIC` gets default EXECUTE on new functions), and
granted only to the service-role server path:

```sql
revoke all on function public.create_content_package(...) from public, anon, authenticated;
revoke all on function public.publish_session_content_item(uuid) from public, anon, authenticated;
```

Verification tests confirm: `PUBLIC` cannot execute, `anon` cannot,
`authenticated` cannot, the service-role path can, and the function cannot be
redirected through a malicious search-path object.

| Operation | Path | Auth |
|---|---|---|
| Engine reads/writes (sessions, photos, packages, items) | `/api/admin/session-content/*` | `requireAdmin(req)` → service role |
| Derivative creation | `prepareApprovedDerivatives` route | `requireAdmin` + approved-item + permission checks (§4.3) |
| Publication | publish route → RPC | `requireAdmin` + server-side `marketing_permission` |
| Public school galleries | server components, service-role client, ISR | no browser DB access |
| Analytics writes | `POST /api/track-event` (public) | rate-limited, validated, fail-closed (§9) |
| Analytics reads | admin panel routes | `requireAdmin` |

The browser Supabase client is **never** used to touch engine tables. Public
pages keep working because they already read through the service-role server
client (existing ISR setup).

---

## 6. Derived workflow state

One pure helper, `lib/contentEngine/state.ts`
(`deriveSessionEngineState({ photos, activePackage, activeItems })`), consumed
by every UI surface; never re-derived in components. Only active-package items
are passed in — archived-package failures must not affect current state.
Lease expiry is evaluated first: an expired `processing`/`publishing` claim is
treated as **interrupted** (resumable), not active.

Evaluated top-down, first match wins:

1. `failed` — any non-excluded photo `analysis_status='failed'`, OR active
   package `status='failed'`, OR any active item `status='failed'`
2. `publishing` — any active item `status='publishing'` (unexpired lease)
3. `partially_published` — ≥1 non-rejected item published AND ≥1 other
   non-rejected item approved/draft/publishing/failed
4. `published` — ≥1 item published AND every non-rejected item published
   (an all-rejected package is **not** published)
5. `reviewed` — items exist, every item approved or rejected, none
   published/publishing (includes the valid all-rejected case)
6. `generated` — active package `ready` (or `needs_attention`) with ≥1 draft
7. `analyzing` — any non-excluded photo `processing` (unexpired lease)
8. `analyzed` — ≥1 photo exists, all non-excluded `completed` or `skipped`
9. `uploaded` — ≥1 photo exists, analysis incomplete
10. `empty` — no photos

Mandatory unit tests: all-rejected; all-published; one published + one
approved; one published + one failed; archived package containing failed
items; zero items; excluded failed photo; all photos skipped; one photo
processing; failed package with completed photos.

---

## 7. Workflow and UI design

New admin route **`/admin/content-engine`** (thin page shell + dashboard
component, mirroring `/admin/sessions`). No expansion of the admin monolith.

### 7.1 Session list (entry point)

- Rows: every `photography_session` with derived-state badge, service type,
  school, date, permission indicators.
- Filters: derived state, service type, school, date, marketing permission,
  has-failures, has-unpublished-approved.
- Default sort by actionability: failed/interrupted → approved-waiting →
  drafts-for-review → in-progress → uploaded-not-analyzed → done.
- **"New from client session"**: picker over `client_sessions`
  (`session_completed`+). If a `photography_session` already exists for it
  (DB-enforced by the partial unique index), the picker defaults to
  **Open existing session** (with "Create another anyway" unavailable in v1 —
  the index forbids it; relaxing later means dropping the index and keeping
  the warning flow).
- **"Blank session"**: for old shoots, test shoots, collaborations.

### 7.2 Prefill

From the linked client session: `internal_client_name`, `service_type`
(mapped via taxonomy), `session_date`, `primary_location`, `inquiry_id`.
Taxonomy-inferred fields (e.g. `school_slug` from location text) display
provenance — *"Suggested from location text: 'Sather Gate'"* — and commit only
when confirmed/saved. `public_display_name` defaults to **first name only**
and is clearly marked: *"This may appear in the journal title or session
description."* Internal name and public name are separate fields; only the
public one ever reaches AI or publication.

### 7.3 Permissions UI

Header controls for both permissions with source/basis dropdowns and
auto-stamped confirmation timestamps. Generation disabled (with explanation)
until `ai_processing_allowed`; publish disabled (with explanation) until
`marketing_permission` — both also enforced server-side.

**Revocation:** switching marketing permission off while published content
exists opens a blocking modal listing every published target ("1 journal
post, 8 portfolio images, 4 UC Berkeley placements") with three choices:
**Cancel** / **Disable future publishing only** / **Disable and begin
takedown**. Takedown lists every published target, lets Chris select
placements to deactivate/remove, preserves publication history, removes or
deactivates live records, deletes derivatives only per the shared-derivative
rule (§4.3), revalidates affected routes, retains private sources, and stamps
`marketing_permission_revoked_at`.

### 7.4 Workspace (`/admin/content-engine/[id]`)

Single-scroll sections, gating top-to-bottom; sticky header (name, type, date,
school, derived state, permissions, active package number); sticky bottom
action bar. Mobile: same single-column flow, photo grid 3-across, full-screen
editors, sticky bars (dictation input works as-is).

**Section 1 — Session facts.** Editable prefilled fields; saving facts is what
commits suggested values.

**Section 2 — Photos.** Drag-drop / camera-roll upload (client SHA-256 gives
instant duplicate warnings; server verification is authoritative, §4.2).
Per-photo: signed-URL thumbnail, analysis-status chip
(pending/processing/interrupted/failed/✓), metadata drawer (alt, title, tags,
quality, destination recommendations), **Exclude** toggle (greyed; removed
from analysis/generation/publication; never deleted). Toolbar: select all,
exclude/include selected, set cover candidate, filter by analysis state or
recommendation, manual sort. Duplicate handling in v1: **exact** duplicates
are prevented by server-computed SHA-256 (§4.2); the AI analysis may flag
likely-similar frames as a non-authoritative variety suggestion. v1 does not
claim or advertise deterministic near-duplicate grouping — tags and quality
scores do not measure visual similarity; true near-duplicate detection
(perceptual hashing, embeddings, SSIM, visual clustering) is deferred (§15).
Section header shows
batch progress with **Retry failed** and lease-aware
*"Analysis interrupted 14 minutes ago — [Resume analysis]"*.

**Section 3 — Generation.** Pre-generation summary lists exactly what will be
created and its inputs ("24 analyzed photos, 8 portfolio candidates"); no
fabricated cost claims — estimates come only from real token usage and the
maintained rate map (§11). Active package header: number, status chip
(incl. `needs_attention`), model + prompt version, aggregate usage.
**Regenerate ▾**: everything, or selected types only; unselected types'
items copy forward per §8.4. **Skip failed type** marks a failed type
`skipped` so the package can reach `ready`. Archived packages: read-only
viewer + per-item **"Copy into active package"** (provenance shown:
*"Restored from package #2"*).

**Section 4 — Item review.** One card per item: status chip, type-specific
editor, **Approve**, **Reject** (optional reason), **Un-reject**. Editors:
journal post — full-screen title/slug/body/meta/photo-picker/internal-links;
portfolio picks — per-photo title/alt/category(live `portfolio_categories`)/
featured; school/guide — validated destination dropdowns (canonical taxonomy /
actual guide location lists), alt override, sort; testimonial —
matched-by-email candidate with quote excerpt. (Social-caption editor: Phase 2.)
Destination dropdowns make invalid slugs unrepresentable.

**Autosave (server-backed).** Debounced (~1.5s) `PATCH` of the item payload
with `payload_revision` optimistic concurrency: stale revision → 409 → UI
warns *"changed in another tab/device"* and shows a comparison before any
overwrite. States: *Editing… / Saving… / Saved 3:42pm / Save failed — local
backup preserved*. `localStorage` (`draft_${itemId}`) is a temporary fallback
only: written while a save is pending or failed, cleared on confirmed save,
restored only when newer than the server copy and only via an explicit
comparison prompt. Editors include explicit Save, unsaved-change indicator,
public-page preview, and an exit warning when the latest save failed.

**Sticky action bar.** "n of m handled · k failed · j approved awaiting
publish" + **Approve all remaining ▾** (per-piece toggles; confirmation
summary: "Approve 14 items? — 1 journal post, 8 portfolio images…") +
**Publish approved (n)** (separate act; pre-publish summary lists records to
create/update, routes to revalidate, and warnings: slug conflicts, duplicate
images, missing public alt text).

**Section 5 — Publication history.** Permanent, across all packages: date,
type, target, live link, view count (via `content_events.content_item_id`),
**Revalidate** button, takedown entry point. Inherited published outputs from
archived packages appear here and in the active package as display-only.

**Empty states.** Each section offers its next action: "No photos uploaded →
[Upload session photos]"; "Photos uploaded but not analyzed → [Analyze 24
photos]"; "No package generated → [Generate content package]"; "Nothing
approved → [Review drafts]".

**Refresh safety.** Every durable thing is a DB row; reload resumes
mid-analysis/review/publish. Only an open editor's unsaved keystrokes are
volatile, covered by autosave + local fallback.

---

## 8. Pipelines

### 8.1 Analysis

Client orchestrates; server does the work. `POST .../analyze`:

1. **Claim** (atomic SQL): set `analysis_status='processing'`,
   `analysis_started_at=now()`, `analysis_lease_expires_at=now()+3min`,
   `analysis_attempt+1` — only where status in (`pending`,`failed`) or lease
   expired. Unexpired claims cannot be stolen.
2. **Adaptive batching:** ≤4 photos AND ≤ a compressed-bytes cap per request
   AND a total-pixels cap; the server downscales (sharp, ~1600px JPEG) and
   reduces quality/dimensions dynamically to stay under request/provider
   limits. UI just calls it "batch processing".
3. One Claude vision call per batch. The response must key results by
   `session_photo_id` — never array position:
   `{ "photos": [{ "session_photo_id": "...", "alt_text": ..., ... }] }`
4. **Identity validation after Zod:** every requested ID exactly once, no
   unknown/missing/duplicate IDs, all IDs in the claimed session, all leases
   still valid before committing. Violations fail only the affected batch.
5. Write fields + size-capped raw response and token usage to
   `analysis_payload`; `completed` / `failed` (+ safe error).

### 8.2 Generation

Dependency-ordered by the server, not by button-call order. The package
generator implements a small dependency graph:

```
internal_link_suggestion ──▶ journal_post        (links generated first,
testimonial_feature ───────▶ journal_post         validated against the closed
all others: independent                           canonical URL list, then fed
                                                  into journal generation)
```

v1 `selected_types` offers: `journal_post`, `portfolio_pick`,
`school_page_photo`, `guide_photo`, `testimonial_feature`,
`internal_link_suggestion`. `social_caption` is Phase 2 and not offered.

`POST .../packages` → **RPC `create_content_package`** (one transaction):
row-lock the session (`select … for update`), archive the active package if
requested (status + `archived_at` consistent via the check constraint),
allocate `generation_number = max+1` safely, insert new package
(`generating`), execute copy-forward (§8.4). Two concurrent requests
serialize; no polite-turn-taking assumed.

`POST .../generate?type=…` per selected type:

- **Atomic per-type claim** via RPC/`jsonb_set`: claims one type's progress
  entry, verifies its lease, increments its attempt — never read-modify-write
  of the whole `generation_settings` object, never touching other types'
  entries or usage.
- Builds the prompt (§8.3), calls Claude, Zod-validates, creates the item
  row(s) as `draft`, records per-type usage atomically.
- Failure → that type `failed` with error; package transitions:
  all selected types `completed|skipped` → `ready`; some failed but completed
  content exists and retries possible → `needs_attention`; package-level
  failure → `failed`. **Skip failed content type** marks it `skipped`.
- Expired lease → UI shows *interrupted* with **Resume generation**, which
  re-claims only unfinished types (`selected_types` minus completed/skipped).

### 8.3 Prompt construction

- All prompts in `lib/contentEngine/prompts.ts`, exporting `PROMPT_VERSION`;
  stored on every package and item.
- Inputs: validated `session_facts_snapshot` (contains `public_display_name`
  and shoot facts — **never** email, `internal_client_name`, or
  `internal_notes`), per-photo analysis summaries, and (journal only) top
  photos as inline downscaled images.
- Internal links: prompts receive a **closed list** of canonical URLs from
  `lib/contentEngine/taxonomy.ts` (matching school page, guide pages, pricing
  page); output links are validated against the list — anything else is a
  validation failure.
- Model: `claude-sonnet-4-6` default for analysis + generation (consistent
  with existing routes), recorded per call, overridable via
  `generation_settings.overrides`.

### 8.4 Copy-forward and restore rules (regeneration)

- Copied items always get `copied_from_item_id`, a **new** idempotency key,
  and never carry a published target.
- Draft, unchanged → copied as `draft`.
- Approved, unpublished → copied as `approved` only when payload is
  deterministically unchanged AND destination still valid AND the user chose
  "preserve approvals"; otherwise copied as `draft` for re-review.
- Rejected → not copied unless explicitly selected.
- Actively `publishing` anywhere in the session → regeneration is blocked
  until it settles.
- Published → **never** copied as publishable; remains in package/publication
  history, displayed in the active package as inherited published output.
- "Copy into active package" (restore from archive) → new `draft`, provenance
  recorded and shown ("Restored from package #2"), no old key/target/status
  carried over.

### 8.5 Canonical taxonomy

`lib/contentEngine/taxonomy.ts` consolidates today's scattered school
detection (`detectSchool`, `detectSchoolLink`) into one module: school slugs
(must match `/grads/*` route slugs), service types, portfolio categories,
lighting conditions, content types, publication target types, guide location
keys, and the canonical internal-link URL list. **Every** create/update API
rejects values outside the taxonomy — `uc-berkley` and `UC-Berkeley` are
impossible to store.

---

## 9. Publication

### 9.1 Flow per item (Approve-All publishing just iterates)

```
Step A (Node route, idempotent)        prepareApprovedDerivatives(itemId)
  requireAdmin → item approved → marketing_permission now true
  → photo IDs derived from validated payload only → ownership verified
  → sharp derivative → content-addressed public path → record on session_photos

Step B (single DB transaction)         RPC publish_session_content_item(item_id)
  verify approved + permission + published_target_id is null
  → atomic claim (status='publishing' where status='approved'; 0 rows = abort)
  → type-specific live write (§9.2) — INCLUDING all db-only side effects
  → set published_target_type/id, published_at, published_ref
  → status='published'
  All-or-nothing; exception rolls back everything, route then records
  status='failed' + safe error separately (draft preserved).

Step C (after commit, retry-safe, recorded as recoverable tasks on failure)
  targeted revalidatePath per the content_type → path map
  (journal → /blog, /blog/[slug] · portfolio → /portfolio, / if featured ·
   school → /grads/[slug] · guide → its guide location pages)
  Post-commit failure NEVER flips the item back to unpublished; it surfaces
  as a recoverable task (e.g. the Revalidate button); hourly ISR is backstop.
```

### 9.2 Type-specific publishers (inside the RPC transaction)

- **journal_post** → insert `blog_posts` **and** its `image_library` rows in
  the same transaction (a published post can never permanently lack its
  library relationships). Slug conflict → abort with error; an existing post
  is never assumed ours — slug alone is not proof of provenance.
- **portfolio_pick** → insert `portfolio_images` (derivative URL +
  `content_hash`). Existing row with the same hash is provably the same bytes
  → reconcile (point `published_target_*` at it) instead of duplicating.
  Production verified 2026-06-10: the `content_hash` column exists (43/173
  rows populated, zero duplicate hashes) but has only a non-unique index;
  migration 7 adds the partial unique index that makes this race-safe. Legacy
  rows with null hashes cannot be hash-reconciled — publishing a photo that
  visually duplicates an un-hashed legacy image creates a second record until
  the optional legacy backfill (§15) computes their hashes.
- **school_page_photo** → insert `school_page_photos`; the
  `(school_slug, session_photo_id)` unique constraint makes concurrent
  conflicts reconcilable in-transaction.
- **guide_photo** → insert `family_location_photos` /
  `couples_location_photos`. These live tables lack a usable unique
  constraint, so the RPC takes a **transaction-scoped advisory lock** keyed on
  (table, location, derivative hash), then checks-and-inserts. (Adding unique
  indexes to those tables is a candidate follow-up after auditing existing
  rows; not assumed for v1.)
- **social_caption** (Phase 2 — design retained, not built in v1) → no live
  table; `published_target_type='none'`; published = marked done for
  copy-paste.
- **testimonial_feature** → sets `testimonials.photography_session_id`
  (target = testimonial uuid).
- **internal_link_suggestion** → consumed by journal generation;
  publishing marks it applied (`published_target_type='none'`).

The partial unique index on `(published_target_type, published_target_id)`
guarantees two staging items can never claim one live record, on top of the
per-item idempotency key.

### 9.3 Journal payload → `blog_posts` mapping (exact; verified against production schema 2026-06-10)

| Staged payload | Live `blog_posts` column / behavior |
|---|---|
| `title` | `title` (also serves as the meta title — see below) |
| `slug` | `slug` (conflict aborts the transaction, §9.2) |
| `body` (testimonial blockquote already inline) + deterministic "Keep exploring" section | `body` |
| `meta_description` | `meta_description` |
| `meta_keywords` | `meta_keywords` |
| `cover_photo_id` → `session_photos.public_derivative_url` | `cover_image_url` |
| `cover_photo_id` → `session_photos.alt_text` | `cover_image_alt` |
| `photo_ids` minus cover → derivative URLs, in payload order | `extra_image_urls` |
| same photos → `session_photos.alt_text`, index-aligned | `extra_image_alts` |
| cover derivative URL | `og_image_url` |
| transaction time | `published_at` |
| fixed configuration | `sites = ['professional']`, `category = 'professional'` |

Explicit decisions — no staged field is silently discarded:

- **`excerpt`: not staged.** `blog_posts` has no excerpt column (verified);
  listing previews derive from `body` at render time. Nothing is generated
  that publication would throw away.
- **`meta_title`: not staged.** The post title is the meta title (current
  site behavior); no migration.
- **`meta_keywords`: staged.** Derived **deterministically** from the
  approved taxonomy (school, location, service type) at generation time — not
  AI-invented — and editable in the journal editor; maps to the existing
  `meta_keywords` column.
- **Internal links:** stored structured in `payload.internal_links` while in
  draft (so the editor adds/removes links without hand-editing markup), then
  deterministically rendered into a final **"Keep exploring"** section
  appended to `body` inside the publication transaction.
- **Testimonial quote:** when `payload.testimonial_id` is set, generation
  embeds the quote as a blockquote inside the draft `body` (attributed to the
  public display name) so Chris reviews and edits it inline; publication
  publishes the body as-is. The separate `testimonial_feature` item records
  the session relationship on the `testimonials` row.

### 9.4 Reconciliation

`GET /api/admin/session-content/reconcile?session=…`, surfaced as a workspace
banner: items stuck `publishing` past the lease (resume or fail), `failed`
items whose intended target detectably exists (portfolio hash hit,
school-page constraint hit, blog slug match) with **Link to existing
record** — auto-confirmable for hash/constraint proofs, manual confirmation
required for slug matches — plus the orphaned-derivative report (§4.3).

---

## 10. Analytics

- `<ContentEventBeacon contentType contentId>` on blog posts, school pages,
  guide pages, portfolio: `page_view` on mount (`navigator.sendBeacon`),
  `cta_click` on contact CTAs.
- `POST /api/track-event` **fails closed**: production-only
  (`VERCEL_ENV === 'production'`), bot-UA filter, admin-cookie skip,
  `rateLimit()` + 2KB body cap, event-type/content-type allowlists, path
  normalized (query stripped, ≤200 chars, must match a known route pattern),
  referrer reduced to a **normalized hostname** (`www.google.com`,
  `l.instagram.com`, `direct` — registrable-domain extraction is not claimed
  because no Public Suffix List dependency is added; the admin view may group
  known hostnames into friendly labels), **server timestamps only** (a client
  timestamp, if ever wanted, would be stored separately and range-bounded).
- Attribution rules — no false attribution on shared pages:
  - **Single-session content** (a journal post page; an explicit
    click/open of one specific published photo or session highlight): the
    event carries the live target identity; the server resolves
    `(published_target_type, published_target_id)` — never `content_id`
    alone, since numeric and textual IDs overlap across live tables — via
    the indexed reverse lookup and stamps `content_item_id` +
    `photography_session_id`.
  - **Shared pages** (`/grads/*`, `/portfolio`, guide pages, homepage): the
    general `page_view` stores only path, page content type/identifier,
    event type, referrer hostname, and server timestamp;
    `content_item_id` and `photography_session_id` stay **null**. A school
    page shows many sessions' photos — its views belong to the page, not to
    any one session.
  - **Interactions on shared pages** attribute to a session only when the
    user interacts with a specific published item (e.g. opens a session
    photo), in which case the event carries that item's target identity and
    resolves as single-session content.
  - **CTA clicks** are attributed to the page they happen on, never to a
    session whose image happened to appear there.
- Admin surfaces: per-item view counts in publication history (true page
  views for journal posts; interaction events only for placements on shared
  pages); per-session rollup in the workspace.

---

## 11. Cost and usage logging

Every Claude call's `input_tokens`/`output_tokens`/model is stored where it
happened: analysis → `analysis_payload.usage`; generation →
`generation_settings.progress[type].usage` (written atomically with that
type's progress). Package header shows aggregate tokens and an estimated cost
from a maintained rate map (`lib/contentEngine/aiPricing.ts`), always labeled
an estimate and computed only from actual recorded usage. Upgrade path if
cross-session reporting is needed later: an additive `ai_usage_log` table.

---

## 12. Runtime and deployment

- Every route importing `sharp` declares `export const runtime = "nodejs"`.
  Verify on a Vercel preview: native binary present, memory within limits,
  duration acceptable; keep image buffers bounded (downscale early, avoid
  redundant copies; one decode → one encode per derivative).
- AI routes keep `maxDuration = 60`; batching keeps each request comfortably
  under it.
- **Dependencies — two production:** `sharp` (derivatives, verification,
  downscaling), `zod` (payload schemas). **One development:** `vitest`.

---

## 13. Testing

### 13.1 Unit (Vitest)

`deriveSessionEngineState` (the ten mandated cases, §6), every Zod schema
(valid + hostile inputs), taxonomy validators, idempotency-key builder,
copy-forward rules, lease-expiry logic, path/referrer normalization, adaptive
batch sizing, and the attribution rules (shared-page view → null session/item;
single-session view → resolved item; CTA → page, never a session).

### 13.2 Integration (mandatory, scripted, against a disposable Supabase
branch or local instance — tests call the actual RPCs)

package-creation concurrency; active-package archival; lease claiming and
expiry; server-side upload verification (bad MIME, oversized, bomb, foreign
path); duplicate source hashes; marketing-permission rejection;
AI-processing-permission rejection; successful journal publication (post +
image-library rows atomic); transaction rollback on live-table failure;
repeat publication attempt; target reconciliation; guide-photo concurrency
(advisory lock); permission revocation and takedown; public-derivative
authorization (unapproved/rejected/foreign-photo attempts); expired
publication recovery; RPC EXECUTE denied for `PUBLIC`, `anon`, and
`authenticated` while the service-role path succeeds; search-path
redirection attempt fails against the pinned `search_path`.

### 13.3 SQL verify scripts

Repo-convention `_verify.sql` per migration: RLS forced, constraints and
indexes present, RPC EXECUTE grants correct.

### 13.4 Manual browser checklist

Responsive layout, editor usability, mobile uploads, visual status
transitions, route revalidation, restoration after refresh. (Playwright
optional, not required for v1.)

---

## 14. Migration sequence

Additive-only; each migration ships with `_rollback.sql` and `_verify.sql`.

1. `create_photography_sessions` (table, constraints, indexes, RLS, trigger)
2. `create_session_photos` (+ private bucket provisioning documented)
3. `create_session_content_packages_and_items` (both, since items FK packages;
   includes published-target indexes)
4. `create_school_page_photos`
5. `create_content_events`
6. `alter_testimonials_add_photography_session`
7. `add_portfolio_images_content_hash_unique` —
   `add column if not exists content_hash text null` (a no-op in production,
   verified present 2026-06-10; the guard keeps the migration portable) +
   `create unique index ... on portfolio_images(content_hash) where
   content_hash is not null`. Safe to apply: zero duplicate hashes exist.
   Null-hash behavior: the 130 legacy rows without hashes are unaffected by
   the partial index and cannot participate in hash reconciliation; a
   gradual backfill (compute SHA-256 from stored bytes) is optional (§15).
8. `create_content_engine_rpcs` (`create_content_package`,
   `publish_session_content_item`; `security definer set search_path =
   public, pg_temp`; EXECUTE revoked from PUBLIC, anon, and authenticated)

The forward direction is additive-only: no existing data is rewritten or
deleted anywhere, and existing content remains unlinked to photography
sessions until optionally backfilled.

### Rollback modes

**Pre-launch** (migration testing; no production data in the new tables):
rollbacks run in reverse order and may drop the newly created tables,
indexes, functions, the nullable `testimonials` column, the
`portfolio_images` unique index (the column is dropped only if this
migration created it), and the private bucket if empty. Every `_rollback.sql`
guards itself: it **fails with an explicit notice if its target tables
contain rows**.

**Post-launch** (real sessions, drafts, photos, or analytics exist):
rollback means disabling, not destroying — disable the content-engine
routes, revert the application deployment, revoke RPC EXECUTE, and preserve
all new tables and stored data, private source images, and public
derivatives that remain referenced. Any destructive step requires a prior
data export and explicit human authorization; the row-count guards in the
rollback scripts enforce the stop.

Risks: `inquiries.id` bigint FK (verified); `content_events` growth (bounded
by retention + indexes); one-active-package index requires archival inside the
creation RPC (enforced); guide-table advisory locks depend on consistent key
construction (single shared helper).

---

## 15. Deferred / future enhancements

- Refactor `family_location_photos` / `couples_location_photos` to
  `session_photo_id` references (after data audit) + unique indexes
- `ai_usage_log` table for cross-session spend reporting
- `session_publications` as a dedicated entity (would inherit the
  `publication_id` name in `content_events`)
- Public Suffix List dependency for true registrable-domain analytics
- Backfill tooling linking historical blog posts/testimonials to sessions
- **Phase 2: social captions** — generator, editor, approval flow, publisher
  (schema, taxonomy, and publisher design already in place)
- True near-duplicate detection (perceptual hashing, image embeddings,
  structural similarity, visual clustering)
- `content_hash` backfill for the 130 legacy portfolio images
- Storage cleanup tooling: abandoned-upload sweep, orphaned private objects,
  orphaned public derivatives, retention-window review (§4.4)
- Social auto-posting integrations
- Playwright end-to-end suite
- Multiple photography sessions per client session (drop the partial unique
  index, keep the warning flow)
- Aggregation of `content_events` older than the retention window
