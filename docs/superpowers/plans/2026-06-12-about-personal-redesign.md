# Personal About Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rotating personal-facts card and a photography-journey timeline to `/about`, with fact photos uploadable from a new Darkroom admin tab.

**Architecture:** Fact/timeline text is hardcoded in `lib/aboutFacts.ts` (same convention as the rest of the About copy). Photos live in a new `about_photos` table (one row per fact slug) + public `about-photos` storage bucket, written only through a `requireAdmin`-gated API route that mirrors `app/api/admin/family-photos/route.ts`. The public page fetches photos server-side with ISR (`revalidate = 3600`); the admin tab pings `/api/admin/revalidate` after mutations.

**Tech Stack:** Next.js 16 App Router (server components + one client component), Supabase (Postgres + Storage, service-role writes), Vitest for unit tests, existing Darkroom admin tab system.

**Spec:** `docs/superpowers/specs/2026-06-12-about-personal-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/photoAdminShared.ts` | Create | Generic photo upload validation (extracted from family helpers) |
| `lib/familyPhotosAdmin.ts` | Modify | Re-export shared validators under existing names (no call-site churn) |
| `lib/aboutFacts.ts` | Create | Fact + timeline content, table/bucket constants, slug validator |
| `tests/unit/photoAdminShared.test.ts` | Create | Validator unit tests |
| `tests/unit/aboutFacts.test.ts` | Create | Fact content invariants |
| `supabase/migrations/20260612000001_create_about_photos{,_rollback,_verify}.sql` | Create | Table + bucket |
| `app/api/admin/about-photos/route.ts` | Create | Admin CRUD API (GET/POST/PATCH/DELETE) |
| `app/components/AboutFactsCard.tsx` | Create | Client rotating-facts card |
| `app/components/AboutTimeline.tsx` | Create | Server-rendered timeline section |
| `app/(professional)/about/page.tsx` | Modify | Fetch photos, mount the two new sections, `revalidate = 3600` |
| `app/admin/AboutPhotosTab.tsx` | Create | Admin photo manager (one row per fact) |
| `app/admin/page.tsx` | Modify | Register the `aboutPage` tab |

**Conventions to honor (from AGENTS.md):** no hardcoded hex outside existing CSS-string pattern, magic strings in constants, `requireAdmin` on API routes, `showToast(msg, false)` for client errors, files < 400 lines.

---

### Task 1: Extract shared photo validation helpers

`lib/familyPhotosAdmin.ts` has generic validators (file type/size, alt text, safe filename) that the about-photos feature also needs. Extract them to `lib/photoAdminShared.ts`; keep `familyPhotosAdmin.ts` exporting the old names so its call sites (`app/api/admin/family-photos/route.ts`, `app/admin/FamilyGuideTab.tsx`) don't change.

**Files:**
- Create: `lib/photoAdminShared.ts`
- Modify: `lib/familyPhotosAdmin.ts`
- Test: `tests/unit/photoAdminShared.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/photoAdminShared.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_ADMIN_PHOTO_BYTES,
  validateAdminPhotoFile,
  validatePhotoAltText,
  safePhotoFileName,
} from "@/lib/photoAdminShared";

describe("validateAdminPhotoFile", () => {
  it("rejects a missing file", () => {
    expect(validateAdminPhotoFile(null).ok).toBe(false);
  });
  it("rejects unsupported types", () => {
    expect(validateAdminPhotoFile({ type: "image/gif", size: 100 }).ok).toBe(false);
  });
  it("rejects oversized files", () => {
    expect(validateAdminPhotoFile({ type: "image/jpeg", size: MAX_ADMIN_PHOTO_BYTES + 1 }).ok).toBe(false);
  });
  it("accepts a normal jpeg", () => {
    expect(validateAdminPhotoFile({ type: "image/jpeg", size: 1024 }).ok).toBe(true);
  });
});

describe("validatePhotoAltText", () => {
  it("requires non-empty text", () => {
    expect(validatePhotoAltText("").ok).toBe(false);
    expect(validatePhotoAltText("   ").ok).toBe(false);
    expect(validatePhotoAltText(undefined).ok).toBe(false);
  });
  it("rejects text over 300 chars", () => {
    expect(validatePhotoAltText("x".repeat(301)).ok).toBe(false);
  });
  it("accepts reasonable alt text", () => {
    expect(validatePhotoAltText("Chris hiking Mount Tam at sunrise").ok).toBe(true);
  });
});

describe("safePhotoFileName", () => {
  it("normalizes unsafe characters", () => {
    const out = safePhotoFileName("My Photo (1).JPG");
    expect(out).toMatch(/^[\w.-]+$/);
    expect(out).toBe(out.toLowerCase());
  });
  it("falls back when nothing survives", () => {
    expect(safePhotoFileName("***", "about-photo")).toBe("about-photo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/photoAdminShared.test.ts`
Expected: FAIL — `Cannot find module '@/lib/photoAdminShared'`

- [ ] **Step 3: Create `lib/photoAdminShared.ts`**

```ts
// lib/photoAdminShared.ts
// Generic photo-upload validation shared by admin photo features (family guide,
// about page). No server or Next imports, so it's safe to import from client
// tabs, API routes, and unit tests alike.

export const MAX_ADMIN_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB (matches the bucket limits)
export const ALLOWED_ADMIN_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type PhotoUploadCheck = { ok: true } | { ok: false; error: string };

export function validateAdminPhotoFile(file: { type?: string; size?: number } | null): PhotoUploadCheck {
  if (!file) return { ok: false, error: "Choose an image to upload." };
  if (!file.type || !ALLOWED_ADMIN_PHOTO_TYPES.includes(file.type as typeof ALLOWED_ADMIN_PHOTO_TYPES[number])) {
    return { ok: false, error: "Image must be a JPEG, PNG, WebP, or AVIF file." };
  }
  if (typeof file.size === "number" && file.size > MAX_ADMIN_PHOTO_BYTES) {
    return { ok: false, error: "Image must be 10 MB or smaller." };
  }
  return { ok: true };
}

/** Alt text is required for accessibility + image SEO. */
export function validatePhotoAltText(alt: unknown): PhotoUploadCheck {
  if (typeof alt !== "string" || alt.trim().length === 0) {
    return { ok: false, error: "Descriptive alt text is required." };
  }
  if (alt.trim().length > 300) {
    return { ok: false, error: "Alt text is too long (max 300 characters)." };
  }
  return { ok: true };
}

/** Turn a filename into a safe storage object name. */
export function safePhotoFileName(fileName: string, fallback = "photo") {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || fallback;
}
```

- [ ] **Step 4: Rewire `lib/familyPhotosAdmin.ts` to the shared module**

Replace the bodies of the duplicated helpers with re-exports. The file becomes:

```ts
// lib/familyPhotosAdmin.ts
// Shared constants + validation for family-guide photo administration. No server
// or Next imports, so it's safe to import from both the admin client tab and the
// server-only API route (and unit-testable). All writes happen through the admin
// API route (requireAdmin + service role); this file only validates input.
// Generic validation lives in lib/photoAdminShared.ts; this module re-exports it
// under the family-specific names its call sites already use.

import { FAMILY_LOCATIONS } from "@/lib/familyGuide/locations";
import { locationDisplayName } from "@/lib/familyGuide/types";
import {
  MAX_ADMIN_PHOTO_BYTES,
  ALLOWED_ADMIN_PHOTO_TYPES,
  validateAdminPhotoFile,
  validatePhotoAltText,
  safePhotoFileName,
  type PhotoUploadCheck,
} from "@/lib/photoAdminShared";

export const FAMILY_PHOTOS_BUCKET = "family-photos";
export const FAMILY_LOCATION_PHOTOS_TABLE = "family_location_photos";

export const MAX_FAMILY_PHOTO_BYTES = MAX_ADMIN_PHOTO_BYTES;
export const ALLOWED_FAMILY_PHOTO_TYPES = ALLOWED_ADMIN_PHOTO_TYPES;

/** Location choices for the admin dropdown (every location, published or not). */
export const FAMILY_PHOTO_LOCATION_OPTIONS = FAMILY_LOCATIONS.map((loc) => ({
  slug: loc.slug,
  label: locationDisplayName(loc),
  published: loc.published,
}));

const VALID_SLUGS = new Set(FAMILY_LOCATIONS.map((loc) => loc.slug));

export function isValidFamilyLocationSlug(slug: unknown): slug is string {
  return typeof slug === "string" && VALID_SLUGS.has(slug);
}

export type FamilyPhotoUploadCheck = PhotoUploadCheck;

export const validateFamilyPhotoFile = validateAdminPhotoFile;
export const validateAltText = validatePhotoAltText;

export function safeFamilyFileName(fileName: string) {
  return safePhotoFileName(fileName, "family-photo");
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/photoAdminShared.test.ts && npm run test`
Expected: new test PASSES, and the full unit suite still passes (existing family-photo behavior unchanged).

- [ ] **Step 6: Commit**

```bash
git add lib/photoAdminShared.ts lib/familyPhotosAdmin.ts tests/unit/photoAdminShared.test.ts
git commit -m "refactor: extract shared admin photo validation helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: About facts content module

**Files:**
- Create: `lib/aboutFacts.ts`
- Test: `tests/unit/aboutFacts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/aboutFacts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ABOUT_FACTS, ABOUT_TIMELINE, isValidAboutFactSlug } from "@/lib/aboutFacts";

describe("ABOUT_FACTS", () => {
  it("has at least 3 facts with unique slugs", () => {
    expect(ABOUT_FACTS.length).toBeGreaterThanOrEqual(3);
    const slugs = ABOUT_FACTS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("every fact has a title and body", () => {
    for (const f of ABOUT_FACTS) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.body.length).toBeGreaterThan(20);
    }
  });
});

describe("isValidAboutFactSlug", () => {
  it("accepts known slugs", () => {
    expect(isValidAboutFactSlug("burritos")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidAboutFactSlug("nope")).toBe(false);
    expect(isValidAboutFactSlug(null)).toBe(false);
    expect(isValidAboutFactSlug(42)).toBe(false);
  });
});

describe("ABOUT_TIMELINE", () => {
  it("is chronological", () => {
    const years = ABOUT_TIMELINE.map((t) => t.year);
    expect([...years].sort()).toEqual(years);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/aboutFacts.test.ts`
Expected: FAIL — `Cannot find module '@/lib/aboutFacts'`

- [ ] **Step 3: Create `lib/aboutFacts.ts`**

```ts
// lib/aboutFacts.ts
// Content + constants for the personal sections of /about: the rotating facts
// card and the photography-journey timeline. Fact/timeline TEXT is hardcoded
// here (same convention as the rest of the About copy); fact PHOTOS live in the
// about_photos table and are managed from the Darkroom "About Page" tab.
// No server or Next imports — safe for client components, API routes, and tests.

export const ABOUT_PHOTOS_BUCKET = "about-photos";
export const ABOUT_PHOTOS_TABLE = "about_photos";

export type AboutFact = {
  slug: string;
  title: string;
  body: string;
};

export const ABOUT_FACTS: readonly AboutFact[] = [
  {
    slug: "burritos",
    title: "Powered by El Farolito",
    body: "I keep a running, citywide ranking of San Francisco burritos, and I take the research seriously. After years of field testing across every neighborhood, El Farolito holds the crown. Always accepting challengers.",
  },
  {
    slug: "running",
    title: "Runner's high, ocean views",
    body: "You'll usually find me looping Lake Merced or running the coast from the SF Zoo up to Sutro Baths — easily my favorite stretch in the city. It doubles as location scouting; some of my best session spots showed up mid-run.",
  },
  {
    slug: "skateboard",
    title: "Scouting on four wheels",
    body: "I ride my electric skateboard all over San Francisco hunting for photo spots you wouldn't normally think of. Half of my favorite shoot locations started as a random detour on the board.",
  },
  {
    slug: "mt-tam",
    title: "Across the bridge to Mount Tam",
    body: "When I want big views, I head across the Golden Gate to hike Mount Tamalpais. The camera always comes along — sunrise above the fog line never gets old.",
  },
];

export type AboutTimelineEntry = {
  year: string;
  title: string;
  body: string;
};

export const ABOUT_TIMELINE: readonly AboutTimelineEntry[] = [
  {
    year: "2019",
    title: "The first camera",
    body: "Picked up my first real camera right after graduating high school. What hooked me was the quality — realizing a photo could make a moment look even better than it did in person.",
  },
  {
    year: "2022",
    title: "Going all in on grads",
    body: "Started shooting graduation sessions for real — learning the campuses, the light, and how to direct people who had never been photographed before.",
  },
  {
    year: "2023",
    title: "The season that proved it",
    body: "My first big season: at least one grad session every single day through April, May, and the back half of June. Somewhere in that stretch I realized this is exactly what I want to be doing.",
  },
  {
    year: "2026",
    title: "Sharpening the experience",
    body: "Now it's about refining everything — the planning, the sessions, the delivery — using every lesson from the seasons before to make the client experience better each year.",
  },
];

const VALID_FACT_SLUGS = new Set(ABOUT_FACTS.map((f) => f.slug));

export function isValidAboutFactSlug(slug: unknown): slug is string {
  return typeof slug === "string" && VALID_FACT_SLUGS.has(slug);
}

/** Map of fact slug → uploaded photo, as consumed by the public page. */
export type AboutPhotoMap = Record<string, { url: string; alt: string }>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/aboutFacts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/aboutFacts.ts tests/unit/aboutFacts.test.ts
git commit -m "feat: about facts + timeline content module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Database migration — `about_photos` table + `about-photos` bucket

**Files:**
- Create: `supabase/migrations/20260612000001_create_about_photos.sql`
- Create: `supabase/migrations/20260612000001_create_about_photos_rollback.sql`
- Create: `supabase/migrations/20260612000001_create_about_photos_verify.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260612000001_create_about_photos.sql`:

```sql
-- about_photos: one optional photo per hardcoded About-page fact slug.
-- Written only via /api/admin/about-photos (requireAdmin + service role).
create table if not exists public.about_photos (
  id uuid primary key default gen_random_uuid(),
  fact_slug text not null unique,
  image_url text not null,
  storage_path text not null,
  alt_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public-read bucket for the fact photos (10 MB cap, image types only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'about-photos',
  'about-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;
```

- [ ] **Step 2: Write the rollback**

`supabase/migrations/20260612000001_create_about_photos_rollback.sql`:

```sql
drop table if exists public.about_photos;
delete from storage.objects where bucket_id = 'about-photos';
delete from storage.buckets where id = 'about-photos';
```

- [ ] **Step 3: Write the verify script**

`supabase/migrations/20260612000001_create_about_photos_verify.sql`:

```sql
-- Expect one row each.
select 'table' as check, count(*) = 1 as ok
from information_schema.tables
where table_schema = 'public' and table_name = 'about_photos'
union all
select 'unique_slug', count(*) >= 1
from pg_indexes
where schemaname = 'public' and tablename = 'about_photos' and indexdef ilike '%unique%fact_slug%'
union all
select 'bucket', count(*) = 1
from storage.buckets
where id = 'about-photos' and public = true;
```

- [ ] **Step 4: Apply to production via Supabase MCP**

This project applies migrations through the Supabase MCP (see memory: content-engine migrations were applied this way). Use `mcp__claude_ai_Supabase__list_projects` to find the project ref, then `mcp__claude_ai_Supabase__apply_migration` with name `create_about_photos` and the migration SQL. Afterwards run the verify SQL via `mcp__claude_ai_Supabase__execute_sql` — all three rows must report `ok = true`.

The change is purely additive (new table + new bucket); nothing existing is touched.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260612000001_create_about_photos*.sql
git commit -m "feat: about_photos table + about-photos storage bucket

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Admin API route `/api/admin/about-photos`

Mirrors `app/api/admin/family-photos/route.ts`, simplified to one-photo-per-fact: `POST` upserts (replacing any existing photo for that slug), `PATCH` edits alt text, `DELETE` removes by slug.

**Files:**
- Create: `app/api/admin/about-photos/route.ts`

- [ ] **Step 1: Create the route**

```ts
// Admin API for About-page fact photos (about_photos, one row per fact slug).
// Every method is gated by requireAdmin and uses the service-role client, so the
// public anon key can never write here. POST upserts: uploading for a slug that
// already has a photo replaces it and deletes the old storage object, so the
// bucket never accumulates orphans.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import { ABOUT_PHOTOS_BUCKET, ABOUT_PHOTOS_TABLE, isValidAboutFactSlug } from "@/lib/aboutFacts";
import { validateAdminPhotoFile, validatePhotoAltText, safePhotoFileName } from "@/lib/photoAdminShared";

export const dynamic = "force-dynamic";

const SELECT = "id,fact_slug,image_url,storage_path,alt_text,created_at,updated_at";

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/about-photos] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

// ── GET: list every fact photo ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(ABOUT_PHOTOS_TABLE).select(SELECT);
    if (error) throw error;
    return NextResponse.json({ photos: data ?? [] });
  } catch (error) {
    return jsonError(error, "Failed to load about photos.");
  }
}

// ── POST (multipart): upload or replace the photo for a fact ──────────────────
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const slug = form.get("fact_slug");
    const altText = form.get("alt_text");

    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    if (!isValidAboutFactSlug(slug)) throw new Error("Unknown about fact.");
    const fileCheck = validateAdminPhotoFile(file);
    if (!fileCheck.ok) throw new Error(fileCheck.error);
    const altCheck = validatePhotoAltText(altText);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const supabase = createSupabaseAdminClient();
    const path = `${slug}/${crypto.randomUUID()}-${safePhotoFileName(file.name, "about-photo")}`;

    const { error: uploadError } = await supabase.storage
      .from(ABOUT_PHOTOS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const image_url = supabase.storage.from(ABOUT_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;

    try {
      const { data: existing, error: readErr } = await supabase
        .from(ABOUT_PHOTOS_TABLE)
        .select("id,storage_path")
        .eq("fact_slug", slug)
        .maybeSingle();
      if (readErr) throw readErr;

      const { data, error } = await supabase
        .from(ABOUT_PHOTOS_TABLE)
        .upsert(
          { fact_slug: slug, image_url, storage_path: path, alt_text: (altText as string).trim(), updated_at: new Date().toISOString() },
          { onConflict: "fact_slug" },
        )
        .select(SELECT)
        .single();
      if (error) throw error;

      if (existing?.storage_path) {
        const rm = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([existing.storage_path]);
        if (rm.error) console.error("[admin/about-photos] old object cleanup failed", rm.error);
      }
      return NextResponse.json({ photo: data }, { status: existing ? 200 : 201 });
    } catch (error) {
      // Roll back the just-uploaded object if the DB write failed.
      const rm = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([path]);
      if (rm.error) console.error("[admin/about-photos] upload rollback failed", rm.error);
      throw error;
    }
  } catch (error) {
    return jsonError(error, "Failed to save the photo.", 400);
  }
}

// ── PATCH (json): update alt text for a fact's photo ──────────────────────────
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { fact_slug?: unknown; alt_text?: unknown };
    if (!isValidAboutFactSlug(body.fact_slug)) throw new Error("Unknown about fact.");
    const altCheck = validatePhotoAltText(body.alt_text);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(ABOUT_PHOTOS_TABLE)
      .update({ alt_text: (body.alt_text as string).trim(), updated_at: new Date().toISOString() })
      .eq("fact_slug", body.fact_slug)
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No photo exists for that fact yet.");
    return NextResponse.json({ photo: data });
  } catch (error) {
    return jsonError(error, "Failed to update the photo.", 400);
  }
}

// ── DELETE (json): remove a fact's photo row and storage object ───────────────
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { fact_slug?: unknown };
    if (!isValidAboutFactSlug(body.fact_slug)) throw new Error("Unknown about fact.");

    const supabase = createSupabaseAdminClient();
    const { data: row, error: readError } = await supabase
      .from(ABOUT_PHOTOS_TABLE)
      .select("id,storage_path")
      .eq("fact_slug", body.fact_slug)
      .maybeSingle();
    if (readError) throw readError;
    if (!row) throw new Error("No photo exists for that fact.");

    const { error: deleteError } = await supabase.from(ABOUT_PHOTOS_TABLE).delete().eq("id", row.id);
    if (deleteError) throw deleteError;

    let cleanupWarning: string | null = null;
    if (row.storage_path) {
      const { error } = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([row.storage_path]);
      if (error) {
        cleanupWarning = "Record deleted, but the storage file needs manual cleanup.";
        console.error("[admin/about-photos] delete cleanup failed", error);
      }
    }
    return NextResponse.json({ deleted: body.fact_slug, cleanup_warning: cleanupWarning });
  } catch (error) {
    return jsonError(error, "Failed to delete the photo.", 400);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (pre-existing errors, if any, are unchanged).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/about-photos/route.ts
git commit -m "feat: admin API for about-page fact photos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `AboutFactsCard` client component

One fact at a time inside a glass card: progress kicker ("Fact 01 / 04"), title, body, optional photo column, next-arrow + dot navigation, crossfade, touch swipe. Reuses the page-level classes `about-shell`, `about-section-kicker`, `about-section-title` (defined in the About page's CSS string, which is global at render time).

**Files:**
- Create: `app/components/AboutFactsCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

// Rotating personal-facts card for /about ("Off the clock"). One fact at a time
// with next-arrow + dot navigation, crossfade between facts, and touch swipe.
// Fact text comes from lib/aboutFacts; photos (optional) come from the
// about_photos table via the page's server fetch. Renders text-only until a
// photo is uploaded for a fact. Depends on the About page's global classes
// (about-shell, about-section-kicker, about-section-title).

import { useRef, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { ABOUT_FACTS, type AboutPhotoMap } from "@/lib/aboutFacts";

const SWIPE_THRESHOLD_PX = 40;

const CSS = `
  .afc-section {
    background: #f5f6f4;
    padding: 90px 0;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
  }
  .afc-card {
    position: relative;
    margin-top: 36px;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 40px rgba(18, 24, 22, 0.07);
    overflow: hidden;
  }
  .afc-inner {
    display: grid;
    grid-template-columns: 1fr;
    gap: 36px;
    padding: 44px 48px;
    align-items: center;
  }
  .afc-inner[data-has-photo="true"] {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  }
  @keyframes afcFade {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .afc-fact { animation: afcFade 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .afc-counter {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    font-variant-numeric: tabular-nums;
  }
  .afc-title {
    margin: 0 0 14px;
    color: #101412;
    font-size: clamp(1.5rem, 3vw, 2.2rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1.02;
    text-wrap: balance;
  }
  .afc-body {
    margin: 0;
    color: #4b5a55;
    font-size: 16.5px;
    line-height: 1.74;
    max-width: 56ch;
  }
  .afc-photo-wrap {
    position: relative;
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border-radius: 12px;
    background: #dfe8e4;
    width: 100%;
  }
  .afc-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 48px;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
    background: rgba(246, 250, 248, 0.6);
  }
  .afc-dots { display: flex; gap: 8px; }
  .afc-dot {
    width: 8px; height: 8px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(18, 24, 22, 0.16);
    cursor: pointer;
    transition: background 0.18s ease, transform 0.18s ease;
  }
  .afc-dot[data-active="true"] { background: #4f6d67; transform: scale(1.25); }
  .afc-next {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 18px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    font-size: 14px;
    font-weight: 820;
    cursor: pointer;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
  }
  .afc-next:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
  }
  @media (max-width: 900px) {
    .afc-inner, .afc-inner[data-has-photo="true"] { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .afc-section { padding: 62px 0 70px; }
    .afc-inner { padding: 28px 24px; gap: 24px; }
    .afc-nav { padding: 14px 24px; }
    .afc-body { font-size: 15.5px; }
  }
`;

export default function AboutFactsCard({ photos }: { photos: AboutPhotoMap }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const count = ABOUT_FACTS.length;
  const fact = ABOUT_FACTS[index];
  const photo = photos[fact.slug];

  function go(next: number) {
    setIndex(((next % count) + count) % count);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    go(delta < 0 ? index + 1 : index - 1);
  }

  return (
    <section className="afc-section" aria-label="Personal facts about Chris">
      <style>{CSS}</style>
      <div className="about-shell">
        <p className="about-section-kicker">Off the clock</p>
        <h2 className="about-section-title">A few things about me, beyond the camera.</h2>

        <div className="afc-card" data-reveal onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="afc-inner" data-has-photo={photo ? "true" : "false"}>
            <div className="afc-fact" key={fact.slug}>
              <p className="afc-counter">
                Fact {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
              <h3 className="afc-title">{fact.title}</h3>
              <p className="afc-body">{fact.body}</p>
            </div>
            {photo && (
              <div className="afc-photo-wrap" key={`photo-${fact.slug}`}>
                <OptimizedPhoto src={photo.url} alt={photo.alt} sizes="(max-width: 900px) 90vw, 38vw" quality={85} />
              </div>
            )}
          </div>
          <div className="afc-nav">
            <div className="afc-dots" role="tablist" aria-label="Choose a fact">
              {ABOUT_FACTS.map((f, i) => (
                <button
                  key={f.slug}
                  type="button"
                  className="afc-dot"
                  data-active={i === index ? "true" : "false"}
                  aria-label={`Fact ${i + 1}: ${f.title}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <button type="button" className="afc-next" onClick={() => go(index + 1)} aria-label="Next fact">
              Next fact <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/AboutFactsCard.tsx
git commit -m "feat: rotating personal-facts card component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `AboutTimeline` server component

**Files:**
- Create: `app/components/AboutTimeline.tsx`

- [ ] **Step 1: Create the component**

```tsx
// Photography-journey timeline for /about ("The road here"). Server component —
// pure markup from ABOUT_TIMELINE, revealed on scroll via the site's existing
// data-reveal pattern. Depends on the About page's global classes (about-shell,
// about-section-kicker, about-section-title).

import { ABOUT_TIMELINE } from "@/lib/aboutFacts";

const CSS = `
  .atl-section {
    background: #ffffff;
    padding: 90px 0;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
  }
  .atl-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.65fr) minmax(0, 1.35fr);
    gap: 72px;
    align-items: start;
  }
  .atl-label { position: sticky; top: 110px; }
  .atl-list {
    position: relative;
    margin: 0;
    padding: 0 0 0 28px;
    list-style: none;
    border-left: 2px solid rgba(18, 24, 22, 0.1);
  }
  .atl-item { position: relative; padding: 0 0 36px; }
  .atl-item:last-child { padding-bottom: 0; }
  .atl-item::before {
    content: "";
    position: absolute;
    left: -35px;
    top: 6px;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: #4f6d67;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 1px rgba(18, 24, 22, 0.12);
  }
  .atl-year {
    margin: 0 0 6px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    font-variant-numeric: tabular-nums;
  }
  .atl-title {
    margin: 0 0 8px;
    color: #101412;
    font-size: 19px;
    font-weight: 860;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .atl-body {
    margin: 0;
    color: #4b5a55;
    font-size: 15.5px;
    line-height: 1.7;
    max-width: 58ch;
  }
  @media (max-width: 900px) {
    .atl-grid { grid-template-columns: 1fr; gap: 40px; }
    .atl-label { position: static; }
  }
  @media (max-width: 760px) {
    .atl-section { padding: 62px 0 70px; }
  }
`;

export default function AboutTimeline() {
  return (
    <section className="atl-section" aria-label="Photography journey timeline">
      <style>{CSS}</style>
      <div className="about-shell atl-grid">
        <div className="atl-label">
          <p className="about-section-kicker">The road here</p>
          <h2 className="about-section-title">From first camera to every-day seasons.</h2>
        </div>
        <ol className="atl-list">
          {ABOUT_TIMELINE.map((entry, i) => (
            <li key={entry.year} className="atl-item" data-reveal data-delay={String(Math.min(i + 1, 4))}>
              <p className="atl-year">{entry.year}</p>
              <h3 className="atl-title">{entry.title}</h3>
              <p className="atl-body">{entry.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/AboutTimeline.tsx
git commit -m "feat: photography-journey timeline component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Wire the new sections into `/about`

**Files:**
- Modify: `app/(professional)/about/page.tsx`

- [ ] **Step 1: Add imports, ISR, and the photo fetch**

At the top of `app/(professional)/about/page.tsx`, after the existing imports (`OptimizedPhoto`, `pricingCatalog`), add:

```tsx
import AboutFactsCard from "@/app/components/AboutFactsCard";
import AboutTimeline from "@/app/components/AboutTimeline";
import { ABOUT_PHOTOS_TABLE, type AboutPhotoMap } from "@/lib/aboutFacts";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
```

Below the `metadata` export add ISR (the page currently has no revalidate export — it's fully static; it now reads Supabase, so it needs one):

```tsx
// ISR: photos uploaded in the Darkroom appear within the hour, or immediately
// via the admin revalidate ping (see /api/admin/revalidate).
export const revalidate = 3600;
```

Above the `ProfessionalAboutPage` component add the fetch helper. A query failure must never break the page — fall back to text-only cards:

```tsx
async function getAboutPhotos(): Promise<AboutPhotoMap> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(ABOUT_PHOTOS_TABLE)
      .select("fact_slug,image_url,alt_text");
    if (error) throw error;
    const map: AboutPhotoMap = {};
    for (const row of data ?? []) map[row.fact_slug] = { url: row.image_url, alt: row.alt_text };
    return map;
  } catch (error) {
    console.error("[about] failed to load fact photos, rendering text-only", error);
    return {};
  }
}
```

- [ ] **Step 2: Mount the sections**

Make the component async and fetch the photos:

```tsx
export default async function ProfessionalAboutPage() {
  const aboutPhotos = await getAboutPhotos();
  return (
```

Insert the two new sections between the Bio section's closing `</section>` (currently line ~404) and the Approach section comment:

```tsx
      {/* ── OFF THE CLOCK ────────────────────────────────────────────────────────
           Rotating personal facts card. Text lives in lib/aboutFacts.ts;
           photos are uploaded from the Darkroom "About Page" tab. */}
      <AboutFactsCard photos={aboutPhotos} />

      {/* ── THE ROAD HERE ────────────────────────────────────────────────────────
           Photography-journey timeline. Entries live in lib/aboutFacts.ts. */}
      <AboutTimeline />
```

Also update the page-map comment block at the top of the file (lines 4–9) to list the two new sections between Bio and Approach.

Note: `.afc-section` uses the gray band (`#f5f6f4`) and `.atl-section` uses white, so the alternating band rhythm stays intact: Bio (white) → Facts (gray) → Timeline (white) → Approach (gray) → Process (white) → CTA (gray).

- [ ] **Step 3: Verify in the dev server**

Run: `npm run dev`, open `http://localhost:3000/about`.
Expected: facts card rotates via arrow + dots (text-only, no photos yet), timeline reveals on scroll, existing sections unchanged. Check 900px and 760px widths.

- [ ] **Step 4: Run tests + build**

Run: `npm run test && npm run build`
Expected: all unit tests pass; build succeeds with `/about` listed as ISR (revalidate: 1h).

- [ ] **Step 5: Commit**

```bash
git add "app/(professional)/about/page.tsx"
git commit -m "feat: personal facts + journey timeline on the About page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Darkroom admin tab — About Page photos

**Files:**
- Create: `app/admin/AboutPhotosTab.tsx`
- Modify: `app/admin/page.tsx` (import block ~line 71, `Tab` type line 104, `WEBSITE_TABS` line 125, `TAB_LABELS` line 128, tab mount ~line 2176)

- [ ] **Step 1: Create `app/admin/AboutPhotosTab.tsx`**

```tsx
"use client";

// Admin → About Page. Upload/replace/delete the optional photo for each
// hardcoded About-page fact (lib/aboutFacts.ts) and edit alt text. All writes
// go through /api/admin/about-photos (requireAdmin + service role); this
// component never touches Supabase directly. Mutations ping /api/admin/revalidate
// so the ISR'd /about page refreshes immediately.

import { useCallback, useEffect, useRef, useState } from "react";
import { ABOUT_FACTS } from "@/lib/aboutFacts";
import { ALLOWED_ADMIN_PHOTO_TYPES, validateAdminPhotoFile, validatePhotoAltText } from "@/lib/photoAdminShared";

type Photo = {
  id: string;
  fact_slug: string;
  image_url: string;
  alt_text: string;
};

type Props = { showToast: (message: string, ok?: boolean) => void };

const API = "/api/admin/about-photos";

export default function AboutPhotosTab({ showToast }: Props) {
  const [photos, setPhotos] = useState<Record<string, Photo>>({});
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load photos");
      const map: Record<string, Photo> = {};
      for (const p of (json.photos ?? []) as Photo[]) map[p.fact_slug] = p;
      setPhotos(map);
      setAltDrafts(Object.fromEntries(Object.values(map).map((p) => [p.fact_slug, p.alt_text])));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load photos", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function revalidate() {
    try { await fetch("/api/admin/revalidate", { method: "POST" }); } catch { /* non-fatal */ }
  }

  async function handleUpload(slug: string) {
    const input = fileRefs.current[slug];
    const file = input?.files?.[0] ?? null;
    const alt = altDrafts[slug] ?? "";
    const fileCheck = validateAdminPhotoFile(file);
    if (!fileCheck.ok) { showToast(fileCheck.error, false); return; }
    const altCheck = validatePhotoAltText(alt);
    if (!altCheck.ok) { showToast(altCheck.error, false); return; }

    setBusySlug(slug);
    try {
      const form = new FormData();
      form.append("file", file as File);
      form.append("fact_slug", slug);
      form.append("alt_text", alt.trim());
      const res = await fetch(API, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPhotos((prev) => ({ ...prev, [slug]: json.photo }));
      if (input) input.value = "";
      showToast("Photo saved!");
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", false);
    } finally {
      setBusySlug(null);
    }
  }

  async function handleSaveAlt(slug: string) {
    const alt = altDrafts[slug] ?? "";
    const altCheck = validatePhotoAltText(alt);
    if (!altCheck.ok) { showToast(altCheck.error, false); return; }
    setBusySlug(slug);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact_slug: slug, alt_text: alt.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setPhotos((prev) => ({ ...prev, [slug]: json.photo }));
      showToast("Alt text saved!");
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDelete(slug: string) {
    if (!window.confirm("Remove this photo? The fact card goes back to text-only.")) return;
    setBusySlug(slug);
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact_slug: slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setPhotos((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      showToast("Photo removed.");
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">About page — fact photos</h2>
        <p className="text-sm opacity-70">
          Each card on /about can show one photo next to its fact. Fact text is edited in code
          (lib/aboutFacts.ts); photos and alt text are managed here. Cards without a photo render text-only.
        </p>
      </div>

      {loading ? (
        <p className="text-sm opacity-70">Loading…</p>
      ) : (
        ABOUT_FACTS.map((fact) => {
          const photo = photos[fact.slug];
          const busy = busySlug === fact.slug;
          return (
            <div key={fact.slug} className="rounded-xl border border-black/10 bg-white/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold">{fact.title}</h3>
                  <p className="text-xs opacity-60">{fact.slug}</p>
                </div>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.image_url} alt={photo.alt_text} className="h-20 w-28 rounded-lg object-cover" />
                ) : (
                  <span className="text-xs rounded-full border border-black/10 px-3 py-1 opacity-60">No photo yet</span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block text-xs font-semibold">
                  Alt text (required)
                  <input
                    className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="e.g. Chris hiking Mount Tam at sunrise"
                    value={altDrafts[fact.slug] ?? ""}
                    onChange={(e) => setAltDrafts((d) => ({ ...d, [fact.slug]: e.target.value }))}
                  />
                </label>
                {photo && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveAlt(fact.slug)}
                    className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Save alt text
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={(el) => { fileRefs.current[fact.slug] = el; }}
                  type="file"
                  accept={ALLOWED_ADMIN_PHOTO_TYPES.join(",")}
                  className="text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleUpload(fact.slug)}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Working…" : photo ? "Replace photo" : "Upload photo"}
                </button>
                {photo && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(fact.slug)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
```

Styling note for the executor: before finalizing, look at how `FamilyGuideTab.tsx` and `adminTheme.ts` (`T` tokens) style cards/inputs in the Darkroom and match that (the Darkroom uses the `T` theme object, not plain Tailwind grays). Adjust classNames/styles to match the neighboring tabs — keep the structure above.

- [ ] **Step 2: Register the tab in `app/admin/page.tsx`**

Four edits (AGENTS.md: new tabs go in both the `Tab` type and the tab arrays):

1. Imports (next to the `FamilyGuideTab` import, ~line 71):
```tsx
import AboutPhotosTab from "@/app/admin/AboutPhotosTab";
```
2. `Tab` type (line 104) — add `"aboutPage"` after `"navigation"`:
```tsx
type Tab = "home"|...|"navigation"|"aboutPage"|"analytics"|...;
```
3. `WEBSITE_TABS` (line 125) — append:
```tsx
const WEBSITE_TABS:Tab[]=["poses","couplesGuide","couplesLocations","locations","bayGuide","familyGuide","portfolio","categories","blog","library","navigation","aboutPage"];
```
4. `TAB_LABELS` (line 128) — add:
```tsx
aboutPage:"🙋 About Page",
```
5. Mount next to the other tab mounts (~line 2176):
```tsx
{tab==="aboutPage"&&<AboutPhotosTab showToast={showToast}/>}
```

(The ⌘K palette derives its entries from `TAB_LABELS` at line 1424, so the new tab appears there automatically.)

- [ ] **Step 3: Verify in the dev server**

Run: `npm run dev`, log into `/admin`, open the new "About Page" tab.
Expected: four fact rows, all "No photo yet". Upload a test image with alt text → thumbnail appears; reload `/about` → photo shows in the matching fact card. Delete it → card returns to text-only. Confirm the tab also appears in the ⌘K palette.

- [ ] **Step 4: Run tests + build**

Run: `npm run test && npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/admin/AboutPhotosTab.tsx app/admin/page.tsx
git commit -m "feat: Darkroom tab for About-page fact photos

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Final regression pass

- [ ] **Step 1: Regression checks (AGENTS.md)**

- `npm run test && npm run build` — green.
- `/about` renders all 7 sections in order; no layout shift on fact rotation.
- Family Guide tab still uploads (it now consumes re-exported validators) — load the tab, confirm the photo list renders.
- `/api/admin/about-photos` without auth returns 401/403 (curl it: `curl -i -X POST http://localhost:3000/api/admin/about-photos` → denied).

- [ ] **Step 2: Done**

Report back with what shipped and the manual QA results. Deployment to Vercel happens via push to `main` (user's call).
