# Content Engine Public-Page Integrations (Plan 5 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the DB-backed school galleries on `/grads/*` (spec §3.5, §5): published engine photos appear on their school pages via the `school_page_photos → session_photos` join, with ISR + the already-wired targeted revalidation.

**Architecture:** A server-only data module queries through the service-role client (no browser DB access, spec §5); an async server component renders inside the existing `SchoolLandingTemplate` (already a server component); the seven school pages gain `export const revalidate = 3600` so hourly ISR backstops the publish-time `revalidatePath`. Journal, portfolio, and guide pages already render from live tables the publishers write to — no changes there.

**Tech Stack:** Next.js 16 server components, `createSupabaseServerClient`, Vitest integration test for the join.

**Spec is law.** Standing constraints: nothing applied to production; never `git add -A` (user's payments feature is in-flight in this tree).

---

## File Structure

```
lib/contentEngine/schoolGalleryData.ts        — getSchoolGalleryPhotos(slug) (server-only)
app/components/SchoolGallery.tsx              — async server component (renders null when empty)
app/components/SchoolLandingTemplate.tsx      — MODIFY: render <SchoolGallery slug=…/> after the spots section
app/(professional)/grads/{csueb,santa-clara,sf-state,sjsu,stanford,uc-berkeley,usf}/page.tsx
                                              — MODIFY: add `export const revalidate = 3600;`
tests/integration/school-gallery.test.ts
```

---

### Task 1: Gallery data module (test-first)

**Files:**
- Create: `lib/contentEngine/schoolGalleryData.ts`
- Create: `tests/integration/school-gallery.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/integration/school-gallery.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";
import { getSchoolGalleryPhotos } from "@/lib/contentEngine/schoolGalleryData";

beforeAll(() => resetDb());

async function placement(slug: string, photoId: string, sortOrder: number, opts: {
  active?: boolean; alt_override?: string | null; caption?: string | null;
} = {}) {
  const { error } = await service.from("school_page_photos").insert({
    school_slug: slug, session_photo_id: photoId, sort_order: sortOrder,
    active: opts.active ?? true, alt_override: opts.alt_override ?? null, caption: opts.caption ?? null,
  });
  if (error) throw error;
}

describe("getSchoolGalleryPhotos (spec §3.5)", () => {
  it("returns active placements joined to derivative URLs in sort order, alt_override winning", async () => {
    const sessionId = await createTestSession();
    const a = await createTestPhoto(sessionId); // helper sets derivative + alt_text
    const b = await createTestPhoto(sessionId);
    await placement("sjsu", b.id, 2, { caption: "Cap toss" });
    await placement("sjsu", a.id, 1, { alt_override: "Override alt" });

    const photos = await getSchoolGalleryPhotos(service, "sjsu");
    expect(photos.map((p) => p.url)).toEqual([a.public_derivative_url, b.public_derivative_url]);
    expect(photos[0].alt).toBe("Override alt");                       // override wins
    expect(photos[1].alt).toBe("Bay Area grad portrait by soloxsnaps"); // canonical photo alt
    expect(photos[1].caption).toBe("Cap toss");
  });

  it("hides inactive placements and photos without a public derivative", async () => {
    const sessionId = await createTestSession();
    const hidden = await createTestPhoto(sessionId);
    await placement("stanford", hidden.id, 1, { active: false });

    const noDeriv = await createTestPhoto(sessionId, { derivative: false });
    await placement("stanford", noDeriv.id, 2);

    expect(await getSchoolGalleryPhotos(service, "stanford")).toEqual([]);
  });

  it("returns [] for a school with no placements", async () => {
    expect(await getSchoolGalleryPhotos(service, "usf")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- school-gallery` → FAIL (module missing).

- [ ] **Step 3: Write the module** (`lib/contentEngine/schoolGalleryData.ts`)

```ts
// Public school-gallery query (spec §3.5, §5): joins school_page_photos →
// session_photos for the derivative URL and canonical alt. Server-only —
// called from server components through the service-role client; the browser
// never touches engine tables. Photos without a published derivative are
// excluded defensively (publication always creates one, spec §9.1 Step A).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SchoolGalleryPhoto {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
}

interface PlacementRow {
  id: string;
  alt_override: string | null;
  caption: string | null;
  session_photos: {
    public_derivative_url: string | null;
    alt_text: string | null;
  } | null;
}

export async function getSchoolGalleryPhotos(
  client: SupabaseClient, schoolSlug: string,
): Promise<SchoolGalleryPhoto[]> {
  const { data, error } = await client
    .from("school_page_photos")
    .select("id,alt_override,caption,session_photos!inner(public_derivative_url,alt_text)")
    .eq("school_slug", schoolSlug)
    .eq("active", true)
    .order("sort_order")
    .order("created_at");
  if (error) {
    console.error(`school gallery query failed for ${schoolSlug}:`, error.message);
    return []; // a gallery failure must never break the page
  }
  return ((data ?? []) as unknown as PlacementRow[])
    .filter((row) => row.session_photos?.public_derivative_url)
    .map((row) => ({
      id: row.id,
      url: row.session_photos!.public_derivative_url as string,
      alt: row.alt_override?.trim()
        ? row.alt_override
        : row.session_photos!.alt_text ?? "Graduation portrait by soloxsnaps",
      caption: row.caption,
    }));
}
```

NOTE: PostgREST may return the embedded `session_photos` as an object (many-to-one). If the runtime shape is an array on this stack version, adapt the cast (`row.session_photos[0]`) — the test pins the behavior either way.

- [ ] **Step 4: Run** — `npm run test:integration -- school-gallery` → 3/3 PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/schoolGalleryData.ts tests/integration/school-gallery.test.ts
git commit -m "feat: school gallery join query for public grads pages"
```

---

### Task 2: Gallery component + template wiring + ISR

**Files:**
- Create: `app/components/SchoolGallery.tsx`
- Modify: `app/components/SchoolLandingTemplate.tsx` (render the gallery after the spots section)
- Modify: all seven `app/(professional)/grads/<slug>/page.tsx` (add `export const revalidate = 3600;` after the imports)

- [ ] **Step 1: Write the component** (`app/components/SchoolGallery.tsx`)

```tsx
// DB-backed school gallery (spec §3.5): async server component, renders
// nothing until published placements exist. Plain <img> like the rest of the
// site's Supabase-hosted public images (remote loader not configured).
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSchoolGalleryPhotos } from "@/lib/contentEngine/schoolGalleryData";

export default async function SchoolGallery({ slug, school }: { slug: string; school: string }) {
  const photos = await getSchoolGalleryPhotos(createSupabaseServerClient(), slug);
  if (photos.length === 0) return null;

  return (
    <section className="school-section" aria-label={`${school} graduation photo gallery`}>
      <h2 className="school-h2">Recent {school} sessions</h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 12,
      }}>
        {photos.map((photo) => (
          <figure key={photo.id} style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; matches site convention */}
            <img src={photo.url} alt={photo.alt} loading="lazy"
              style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 12, display: "block" }} />
            {photo.caption && (
              <figcaption style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>{photo.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
```

NOTE: inspect `SchoolLandingTemplate.tsx` for the actual section/heading class names (`school-section`, `school-h2` are presumed — match whatever the template's other sections use so the gallery inherits styling; if the template uses inline styles instead of classes, mirror that pattern).

- [ ] **Step 2: Wire into the template.** In `app/components/SchoolLandingTemplate.tsx`: import `SchoolGallery` at the top and render `<SchoolGallery slug={data.slug} school={data.schoolShort} />` immediately AFTER the campus-spots section in the default export's JSX (find the spots `.map` block; insert after its closing section element). The template is a server component — an async child is fine.

- [ ] **Step 3: ISR on the seven school pages.** In each `app/(professional)/grads/<slug>/page.tsx` add, right after the imports:

```ts
export const revalidate = 3600; // hourly ISR backstop; publish revalidates /grads/<slug> directly
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx eslint app/components/SchoolGallery.tsx app/components/SchoolLandingTemplate.tsx` clean; `npx next build --webpack` succeeds and the seven `/grads/*` routes now show a `1h` revalidate column.

- [ ] **Step 5: Commit**

```bash
git add app/components/SchoolGallery.tsx app/components/SchoolLandingTemplate.tsx "app/(professional)/grads"
git commit -m "feat: DB-backed school galleries with hourly ISR on grads pages"
```

---

### Task 3: Wrap-up

- [ ] **Step 1:** `./scripts/content-engine/reset-test-db.sh && npm test && npm run test:integration` — all green.
- [ ] **Step 2:** Confirm guide/journal/portfolio pages needed no changes (they already read the live tables the publishers write: `family/couples_location_photos` filtered on `published`, `blog_posts`, `portfolio_images`) — verify by grepping each page's data source once and noting it in the commit message if anything is off (STOP and flag if a page filters in a way that would hide published engine rows).
- [ ] **Step 3:** Commit any stragglers explicitly (never `git add -A`):

```bash
git status --porcelain  # engine files only; payments files stay untouched
```

---

## Self-Review Notes

- **Spec coverage:** §3.5 join semantics (derivative URL + canonical alt via the photo row, alt_override wins, active filter, sort_order) → Task 1; §5 (server components, service-role client, no browser DB access) → Task 2's component; ISR backstop + targeted revalidation interplay (§9.1 Step C already revalidates `/grads/[slug]` at publish) → Task 2 Step 3.
- **Type consistency:** `getSchoolGalleryPhotos(client, slug)` signature matches both the test and the component; `SchoolGalleryPhoto` fields consumed exactly.
- **No placeholders:** the two NOTEs are verification instructions against the live file (class names, PostgREST embed shape), each with the concrete adaptation to make.
