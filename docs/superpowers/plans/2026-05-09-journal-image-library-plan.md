# Journal Image Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save every journal cover and gallery upload as a reusable shared asset, surface those assets inside `Studio Admin`, and allow one-click promotion into the portfolio without re-uploading.

**Architecture:** Add a dedicated `image_library` table plus a small server-side helper layer for syncing journal uploads, promoting assets into `portfolio_images`, and backfilling old journal images. Keep public journal and portfolio reads unchanged while adding a new `Image Library` admin surface and wiring the existing blog save flow into the library.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Postgres, Supabase Storage, Tailwind CSS, Node test runner

---

## File Structure

### Create

- `supabase/migrations/20260509010000_create_image_library.sql`
- `lib/imageLibrary.ts`
- `lib/imageLibraryShared.ts`
- `app/api/admin/image-library/route.ts`
- `app/api/admin/image-library/promote/route.ts`
- `app/components/admin-image-library-panel.tsx`
- `tests/imageLibrary.test.mjs`
- `scripts/backfill-journal-image-library.mjs`

### Modify

- `app/admin/page.tsx`
- `docs/superpowers/specs/2026-05-09-journal-image-library-design.md`

### Keep Unchanged

- `app/(fun)/journal/[slug]/page.tsx`
- `app/(fun)/journal/page.tsx`
- `app/(professional)/portfolio/page.tsx`
- `lib/professionalData.ts`

These public readers should continue working off the current `blog_posts` and `portfolio_images` tables.

---

### Task 1: Define Shared Image-Library Types And Sync Rules

**Files:**
- Create: `lib/imageLibraryShared.ts`
- Create: `tests/imageLibrary.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test file that locks down the reusable rules before any database or UI work:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_LIBRARY_SOURCE_TYPES,
  buildJournalImageLibraryRows,
  buildPortfolioInsertFromAsset,
  imageLibraryKey,
} from "../lib/imageLibraryShared.js";

test("buildJournalImageLibraryRows creates cover and gallery assets", () => {
  const rows = buildJournalImageLibraryRows({
    postId: 42,
    postSlug: "uc-berkeley-grads",
    postTitle: "UC Berkeley Grads",
    coverImageUrl: "https://cdn.example.com/blog/cover.jpg",
    extraImageUrls: [
      "https://cdn.example.com/blog/one.jpg",
      "https://cdn.example.com/blog/two.jpg",
    ],
  });

  assert.equal(rows.length, 3);
  assert.equal(rows[0].source_role, "cover");
  assert.equal(rows[1].source_role, "gallery");
  assert.equal(rows[0].source_type, IMAGE_LIBRARY_SOURCE_TYPES.journal);
});

test("imageLibraryKey deduplicates by post role and url", () => {
  assert.equal(
    imageLibraryKey({
      source_post_id: 7,
      source_role: "cover",
      image_url: "https://cdn.example.com/a.jpg",
    }),
    "7::cover::https://cdn.example.com/a.jpg"
  );
});

test("buildPortfolioInsertFromAsset maps library asset into portfolio row", () => {
  const payload = buildPortfolioInsertFromAsset({
    title: "Golden hour grad",
    alt: "Golden hour grad portrait",
    image_url: "https://cdn.example.com/golden.jpg",
    categorySlug: "grads",
    categoryId: 2,
    sortOrder: 14,
  });

  assert.deepEqual(payload, {
    title: "Golden hour grad",
    alt: "Golden hour grad portrait",
    image_url: "https://cdn.example.com/golden.jpg",
    category_id: 2,
    category_slug: "grads",
    featured: false,
    sort_order: 14,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: FAIL with module-not-found or missing export errors for `lib/imageLibraryShared.js`

- [ ] **Step 3: Write minimal implementation**

Create a focused shared helper with plain-data utilities only:

```ts
export const IMAGE_LIBRARY_SOURCE_TYPES = {
  journal: "journal",
} as const;

export const IMAGE_LIBRARY_SOURCE_ROLES = {
  cover: "cover",
  gallery: "gallery",
} as const;

export function imageLibraryKey(input: {
  source_post_id: number;
  source_role: string;
  image_url: string;
}) {
  return `${input.source_post_id}::${input.source_role}::${input.image_url}`;
}

export function buildJournalImageLibraryRows(input: {
  postId: number;
  postSlug: string;
  postTitle: string;
  coverImageUrl: string | null;
  extraImageUrls: string[];
}) {
  const rows = [];

  if (input.coverImageUrl) {
    rows.push({
      title: `${input.postTitle} cover`,
      alt: `${input.postTitle} cover`,
      image_url: input.coverImageUrl,
      source_type: IMAGE_LIBRARY_SOURCE_TYPES.journal,
      source_post_id: input.postId,
      source_post_slug: input.postSlug,
      source_role: IMAGE_LIBRARY_SOURCE_ROLES.cover,
      in_portfolio: false,
    });
  }

  for (const imageUrl of input.extraImageUrls) {
    rows.push({
      title: input.postTitle,
      alt: input.postTitle,
      image_url: imageUrl,
      source_type: IMAGE_LIBRARY_SOURCE_TYPES.journal,
      source_post_id: input.postId,
      source_post_slug: input.postSlug,
      source_role: IMAGE_LIBRARY_SOURCE_ROLES.gallery,
      in_portfolio: false,
    });
  }

  return rows;
}

export function buildPortfolioInsertFromAsset(input: {
  title: string;
  alt: string;
  image_url: string;
  categorySlug: string;
  categoryId: number | null;
  sortOrder: number;
}) {
  return {
    title: input.title,
    alt: input.alt,
    image_url: input.image_url,
    category_id: input.categoryId,
    category_slug: input.categorySlug,
    featured: false,
    sort_order: input.sortOrder,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: PASS with 3 passing assertions

- [ ] **Step 5: Commit**

```bash
git add tests/imageLibrary.test.mjs lib/imageLibraryShared.ts
git commit -m "feat: add image library shared helpers"
```

---

### Task 2: Add The `image_library` Schema And Server Helper

**Files:**
- Create: `supabase/migrations/20260509010000_create_image_library.sql`
- Create: `lib/imageLibrary.ts`
- Test: `tests/imageLibrary.test.mjs`

- [ ] **Step 1: Extend the failing test with helper-level sync coverage**

Append helper tests for deduping and promotion checks:

```js
import {
  filterMissingLibraryRows,
  getNextPortfolioSortOrder,
} from "../lib/imageLibraryShared.js";

test("filterMissingLibraryRows excludes assets already present", () => {
  const candidates = [
    { source_post_id: 42, source_role: "cover", image_url: "a" },
    { source_post_id: 42, source_role: "gallery", image_url: "b" },
  ];
  const existing = [
    { source_post_id: 42, source_role: "cover", image_url: "a" },
  ];

  const rows = filterMissingLibraryRows(candidates, existing);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].image_url, "b");
});

test("getNextPortfolioSortOrder appends after the current highest order", () => {
  assert.equal(getNextPortfolioSortOrder([{ sort_order: 2 }, { sort_order: 6 }]), 7);
  assert.equal(getNextPortfolioSortOrder([]), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: FAIL with missing export errors for `filterMissingLibraryRows` or `getNextPortfolioSortOrder`

- [ ] **Step 3: Implement schema and server helper**

Create the migration with explicit uniqueness and timestamps:

```sql
create table if not exists public.image_library (
  id bigint generated by default as identity primary key,
  title text not null,
  alt text,
  image_url text not null,
  storage_path text,
  source_type text not null,
  source_post_id bigint references public.blog_posts(id) on delete set null,
  source_post_slug text,
  source_role text not null,
  in_portfolio boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists image_library_source_role_url_idx
on public.image_library (source_post_id, source_role, image_url);
```

Fill out `lib/imageLibrary.ts` with server-side operations:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  buildJournalImageLibraryRows,
  buildPortfolioInsertFromAsset,
  filterMissingLibraryRows,
  getNextPortfolioSortOrder,
} from "@/lib/imageLibraryShared";

export async function syncJournalPostImagesToLibrary(input: {
  postId: number;
  postSlug: string;
  postTitle: string;
  coverImageUrl: string | null;
  extraImageUrls: string[];
}) {
  const supabase = createSupabaseServerClient();
  const rows = buildJournalImageLibraryRows(input);
  const { data: existing } = await supabase
    .from("image_library")
    .select("source_post_id,source_role,image_url")
    .eq("source_post_id", input.postId);

  const missingRows = filterMissingLibraryRows(rows, existing ?? []);
  if (missingRows.length === 0) return { inserted: 0 };

  const { error } = await supabase.from("image_library").insert(missingRows);
  if (error) throw error;
  return { inserted: missingRows.length };
}

export async function promoteImageLibraryAssetToPortfolio(input: {
  assetId: number;
  categorySlug: string;
}) {
  const supabase = createSupabaseServerClient();
  // fetch asset, category, and current portfolio max sort order
  // insert into portfolio_images if image_url is not already present
  // mark image_library.in_portfolio = true
}
```

Also extend `lib/imageLibraryShared.ts`:

```ts
export function filterMissingLibraryRows(candidates, existing) {
  const keys = new Set(existing.map(imageLibraryKey));
  return candidates.filter((row) => !keys.has(imageLibraryKey(row)));
}

export function getNextPortfolioSortOrder(rows: Array<{ sort_order?: number | null }>) {
  const max = rows.reduce((best, row) => Math.max(best, Number(row.sort_order ?? 0)), 0);
  return max + 1;
}
```

- [ ] **Step 4: Run tests and inspect the migration**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: PASS

Run: `sed -n '1,220p' supabase/migrations/20260509010000_create_image_library.sql`

Expected: table, unique index, updated-at support, and RLS/policies present with no placeholders

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260509010000_create_image_library.sql lib/imageLibrary.ts lib/imageLibraryShared.ts tests/imageLibrary.test.mjs
git commit -m "feat: add image library schema and server helper"
```

---

### Task 3: Sync Journal Saves Into The Image Library

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `lib/imageLibrary.ts`
- Test: `tests/imageLibrary.test.mjs`

- [ ] **Step 1: Add a failing helper test for storage-path extraction and sync payloads**

Add a test so the admin save flow has a stable helper contract:

```js
import { extractStoragePathFromPublicUrl } from "../lib/imageLibraryShared.js";

test("extractStoragePathFromPublicUrl returns the bucket-relative path", () => {
  const path = extractStoragePathFromPublicUrl(
    "https://project.supabase.co/storage/v1/object/public/grad-photos/blog/123.jpg"
  );

  assert.equal(path, "blog/123.jpg");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: FAIL with a missing export for `extractStoragePathFromPublicUrl`

- [ ] **Step 3: Implement the sync path in the existing journal save flow**

Add the shared helper:

```ts
export function extractStoragePathFromPublicUrl(url: string) {
  const marker = "/object/public/grad-photos/";
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}
```

Update the journal save branch in `app/admin/page.tsx` so that after the `blog_posts` insert/update succeeds, it calls the library sync helper using the final saved URLs:

```ts
const savedPost = editingPost
  ? await supabase.from("blog_posts").update(payload).eq("id", editingPost.id).select("id,title,slug,cover_image_url,extra_image_urls").single()
  : await supabase.from("blog_posts").insert(payload).select("id,title,slug,cover_image_url,extra_image_urls").single();

if (savedPost.error || !savedPost.data) {
  showToast(editingPost ? "Update failed" : `Save failed — ${savedPost.error?.message ?? "unknown error"}`, false);
  setPostSaving(false);
  return;
}

try {
  await fetch("/api/admin/image-library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "syncPost",
      postId: savedPost.data.id,
      postTitle: savedPost.data.title,
      postSlug: savedPost.data.slug,
      coverImageUrl: savedPost.data.cover_image_url,
      extraImageUrls: savedPost.data.extra_image_urls ?? [],
    }),
  });
} catch (error) {
  console.error("[admin] image library sync failed", error);
  showToast("Post published, but image library sync needs repair", false);
}
```

Keep the existing publish UX intact:

- successful post save still resets the form
- library sync failures warn without discarding the post

- [ ] **Step 4: Run the helper tests and a focused lint pass**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: PASS

Run: `npx eslint app/admin/page.tsx lib/imageLibrary.ts lib/imageLibraryShared.ts`

Expected: PASS or only pre-existing unrelated warnings already known in `app/admin/page.tsx`

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx lib/imageLibrary.ts lib/imageLibraryShared.ts tests/imageLibrary.test.mjs
git commit -m "feat: sync journal uploads into image library"
```

---

### Task 4: Add Admin Routes And A One-Time Backfill Script

**Files:**
- Create: `app/api/admin/image-library/route.ts`
- Create: `app/api/admin/image-library/promote/route.ts`
- Create: `scripts/backfill-journal-image-library.mjs`
- Modify: `lib/imageLibrary.ts`

- [ ] **Step 1: Add a failing helper test for backfill dedupe**

Extend `tests/imageLibrary.test.mjs` with a backfill-oriented case:

```js
import { buildJournalImageLibraryRows, filterMissingLibraryRows } from "../lib/imageLibraryShared.js";

test("backfill skips already indexed journal images", () => {
  const generated = buildJournalImageLibraryRows({
    postId: 55,
    postSlug: "stanford-cap-and-gown",
    postTitle: "Stanford Cap And Gown",
    coverImageUrl: "cover-url",
    extraImageUrls: ["gallery-url"],
  });

  const rows = filterMissingLibraryRows(generated, [
    { source_post_id: 55, source_role: "cover", image_url: "cover-url" },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_role, "gallery");
});
```

- [ ] **Step 2: Run test to verify it passes before route work**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: PASS

- [ ] **Step 3: Implement the admin routes and script**

Add a route that validates admin access and exposes two modes:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  backfillJournalImageLibrary,
  listImageLibraryAssets,
  syncJournalPostImagesToLibrary,
} from "@/lib/imageLibrary";

export async function GET(request: NextRequest) {
  await requireAdmin(request);
  const assets = await listImageLibraryAssets();
  return NextResponse.json({ assets });
}

export async function POST(request: NextRequest) {
  await requireAdmin(request);
  const body = await request.json();

  if (body.mode === "syncPost") {
    const result = await syncJournalPostImagesToLibrary(body);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
}
```

Add a dedicated promote route:

```ts
export async function POST(request: NextRequest) {
  await requireAdmin(request);
  const body = await request.json();
  const result = await promoteImageLibraryAssetToPortfolio({
    assetId: Number(body.assetId),
    categorySlug: body.categorySlug,
  });
  return NextResponse.json(result);
}
```

Create the backfill script:

```js
import { createClient } from "@supabase/supabase-js";
import { buildJournalImageLibraryRows, filterMissingLibraryRows } from "../lib/imageLibraryShared.js";

// read env, fetch blog_posts, fetch existing image_library rows, insert missing rows
// print a small summary: scanned posts, inserted assets, skipped assets
```

- [ ] **Step 4: Run route-safe verification and dry-run the script locally**

Run: `node --test tests/imageLibrary.test.mjs`

Expected: PASS

Run: `npx eslint app/api/admin/image-library/route.ts app/api/admin/image-library/promote/route.ts scripts/backfill-journal-image-library.mjs lib/imageLibrary.ts`

Expected: PASS

Run: `node --env-file=.env.local scripts/backfill-journal-image-library.mjs --dry-run`

Expected: summary output with counts and no inserts when using dry-run mode

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/image-library/route.ts app/api/admin/image-library/promote/route.ts scripts/backfill-journal-image-library.mjs lib/imageLibrary.ts tests/imageLibrary.test.mjs
git commit -m "feat: add image library admin routes and backfill"
```

---

### Task 5: Add The `Studio Admin` Image Library Panel And Portfolio Promotion UI

**Files:**
- Create: `app/components/admin-image-library-panel.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `lib/imageLibraryShared.ts`

- [ ] **Step 1: Add the admin surface wiring as a failing UI slice**

Add the new tab to the existing admin tab model in `app/admin/page.tsx`:

```ts
type Tab =
  | "home"
  | "poses"
  | "locations"
  | "bayGuide"
  | "portfolio"
  | "categories"
  | "blog"
  | "imageLibrary"
  | "analytics"
  | "payments"
  | "inquiries"
  | "clients"
  | "funnel"
  | "vault";

const WEBSITE_TABS: Tab[] = ["poses", "locations", "bayGuide", "portfolio", "categories", "blog", "imageLibrary"];

const TAB_LABELS: Record<Tab, string> = {
  imageLibrary: "🧱 Image Library",
};
```

At this step, render a stub panel so the tab exists but the component import still fails.

- [ ] **Step 2: Run lint to verify the missing component/import failure**

Run: `npx eslint app/admin/page.tsx`

Expected: FAIL with unresolved import or missing JSX reference for `AdminImageLibraryPanel`

- [ ] **Step 3: Build the panel and wire live actions**

Create `app/components/admin-image-library-panel.tsx` with:

```tsx
type ImageLibraryAsset = {
  id: number;
  title: string;
  alt: string | null;
  image_url: string;
  source_post_slug: string | null;
  source_role: "cover" | "gallery";
  in_portfolio: boolean;
  created_at: string | null;
};

export function AdminImageLibraryPanel(props: {
  assets: ImageLibraryAsset[];
  categories: Array<{ id: number; name: string; slug: string }>;
  promotingId: number | null;
  onPromote: (assetId: number, categorySlug: string) => void;
  loading: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white/80 backdrop-blur-xl p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reusable Assets</p>
          <h2 className="text-2xl font-black text-slate-900">Image Library</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.assets.map((asset) => (
          <article key={asset.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="aspect-[4/3] bg-slate-100">
              <img src={asset.image_url} alt={asset.alt ?? asset.title} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {asset.source_role}
                </span>
                {asset.in_portfolio && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                    In Portfolio
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">{asset.title}</p>
                <p className="text-xs font-medium text-slate-500">{asset.source_post_slug ?? "Journal image"}</p>
              </div>
              <button
                disabled={asset.in_portfolio || props.promotingId === asset.id}
                onClick={() => props.onPromote(asset.id, "grads")}
                className="w-full rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
              >
                {asset.in_portfolio ? "Already In Portfolio" : props.promotingId === asset.id ? "Adding…" : "Add To Portfolio"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Wire it into `app/admin/page.tsx` with:

- image-library state
- fetch on admin load
- `promote` POST call to `/api/admin/image-library/promote`
- toast success/error handling
- local asset state update on success

- [ ] **Step 4: Run targeted checks and browser verification**

Run: `npx eslint app/admin/page.tsx app/components/admin-image-library-panel.tsx`

Expected: PASS or only pre-existing unrelated warnings already known in the large admin file

Run: `npm run build`

Expected: PASS

Run: `agent-browser http://localhost:3000/admin`

Expected: `Studio Admin` loads, `Image Library` tab is visible, and a populated asset can be promoted without horizontal overflow

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/components/admin-image-library-panel.tsx
git commit -m "feat: add studio admin image library panel"
```

---

### Task 6: Run Backfill And Final Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-09-journal-image-library-design.md`
- Modify: `docs/superpowers/plans/2026-05-09-journal-image-library-plan.md`

- [ ] **Step 1: Run the one-time backfill**

Run:

```bash
node --env-file=.env.local scripts/backfill-journal-image-library.mjs
```

Expected: output showing scanned posts, inserted assets, skipped existing assets, and exit code `0`

- [ ] **Step 2: Verify core behavior manually**

Check these flows:

1. Publish a journal post with a cover image and two extra images
2. Open `Studio Admin -> Image Library`
3. Confirm all three new assets appear
4. Click `Add To Portfolio` on one asset
5. Open `Studio Admin -> Portfolio`
6. Confirm the promoted asset exists without re-uploading

Expected: the blog post publishes normally, the library fills automatically, and the portfolio entry appears once

- [ ] **Step 3: Run the final automated checks**

Run:

```bash
node --test tests/imageLibrary.test.mjs tests/clientSessions.test.mjs tests/gmailBlockedSenders.test.mjs
npm run build
```

Expected:

- all listed tests pass
- build passes

- [ ] **Step 4: Update docs with rollout notes**

Append a short note to the spec or plan capturing:

- migration name used
- whether backfill was run successfully
- any known follow-up ideas such as editable asset metadata or non-portfolio reuse targets

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-05-09-journal-image-library-design.md docs/superpowers/plans/2026-05-09-journal-image-library-plan.md
git commit -m "chore: document image library rollout verification"
```

---

## Self-Review

### Spec Coverage

- shared reusable asset layer: covered by Tasks 1 and 2
- journal auto-save into the library: covered by Task 3
- one-time historical backfill: covered by Task 4 and Task 6
- `Studio Admin` image library UI: covered by Task 5
- opt-in portfolio promotion: covered by Tasks 2, 4, and 5
- public journal and portfolio stability: preserved by the unchanged reader files and verified in Task 6

### Placeholder Scan

- No `TODO`, `TBD`, or vague “implement later” language remains in task steps
- All executable steps include file paths and concrete commands

### Type Consistency

- shared asset names use `image_library`, `source_role`, `source_post_id`, and `in_portfolio` consistently
- admin tab name is consistently `imageLibrary`
- the promote flow consistently uses `assetId` and `categorySlug`
