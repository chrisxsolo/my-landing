# Content Engine Upload Pipeline + Domain Modules (Plan 2 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Session Content Engine's private upload/finalization pipeline (server-side trust boundary) and the pure domain modules — canonical taxonomy, Zod payload schemas, idempotency-key builder, and the derived workflow-state machine — that every later plan depends on, per spec `docs/superpowers/specs/2026-06-10-session-content-engine-design.md` (commit 5386b20), §3.4, §4.2, §6, §8.5.

**Architecture:** Pure, dependency-free domain modules live in `lib/contentEngine/*` and are unit-tested with Vitest. The upload pipeline is two thin Next.js route handlers (`/api/admin/session-content/photos/sign` and `.../finalize`) over a testable service function `finalizeUpload()`; the browser uploads to a **private** bucket via a server-issued signed URL, and the server alone computes the authoritative SHA-256 and verifies the image with `sharp` before writing a `session_photos` row. Integration tests exercise `finalizeUpload()` against the local Supabase stack's real storage + database.

**Tech Stack:** TypeScript, Next.js 16 App Router route handlers, `zod` (new prod dep), `sharp` (new prod dep), `@supabase/supabase-js`, Vitest (unit + integration).

**Plan series:** 1 Foundation (DONE) → **2 Upload pipeline + domain modules/Zod (this plan)** → 3 Analysis & generation → 4 Publishers' Node side + admin workflow UI → 5 Public-page integrations → 6 Analytics + deployment verification. Social captions are Phase 2 of the product and appear in **no** plan (their Zod schema is defined here but never offered or published).

**Spec is law:** if any step here contradicts the spec, the spec wins; stop and flag it.

**Standing constraints (from Plan 1, still in force):**
- **Nothing in this plan is applied to production.** Production migration apply is a Plan-6 gate needing explicit user authorization. This plan adds no migrations.
- The browser Supabase client (`@/lib/supabase`) is **never** used to touch engine tables. All engine reads/writes go through `requireAdmin(req)` → service-role client (`createSupabaseAdminClient()`), per spec §5.
- Files stay under 400 lines; functions under 50 lines, nesting ≤3 (AGENTS.md).

---

## File Structure

```
lib/contentEngine/
  taxonomy.ts        — canonical slugs/types + validators + canonical internal-link list (spec §8.5)
  idempotency.ts     — buildIdempotencyKey() (spec §3.4)
  payloads.ts        — Zod schemas per content_type + session-facts snapshot (spec §3.4, §8.3)
  state.ts           — deriveSessionEngineState() + lease-expiry helpers (spec §6)
  uploadConfig.ts    — bucket id, MIME/size/pixel caps, path issue/ownership helpers (spec §4.1, §4.2)
  imageVerification.ts — verifyImageBuffer(): sharp metadata + SHA-256 (spec §4.2 step 4)
  finalizeUpload.ts  — service fn: download→verify→ownership→insert session_photos (spec §4.2)
app/api/admin/session-content/photos/
  sign/route.ts      — POST: requireAdmin, validate declared meta, issue signed upload URL (spec §4.2 step 1)
  finalize/route.ts  — POST: requireAdmin, call finalizeUpload (spec §4.2 steps 3-6)
supabase/test/
  test-grants.sql    — service_role grants on baseline live tables (carry-forward from migration 8)
scripts/content-engine/reset-test-db.sh  — MODIFY: apply test-grants.sql after baseline
supabase/migrations/20260611000008_create_content_engine_rpcs.sql — MODIFY: remove the 7 grant statements
tests/unit/
  taxonomy.test.ts
  idempotency.test.ts
  payloads.test.ts
  state.test.ts
  imageVerification.test.ts
  uploadConfig.test.ts
tests/integration/
  upload-finalize.test.ts
package.json — MODIFY: add sharp + zod to dependencies
```

Conventions: domain modules in `lib/contentEngine/*` are pure (no Next.js, no `process.env`, except `uploadConfig` constants) so they unit-test anywhere. The two routes are thin wrappers; all logic lives in `finalizeUpload.ts` and `uploadConfig.ts`, mirroring how `lib/clientSessions.ts` holds logic for thin session routes. Every route importing `sharp` declares `export const runtime = "nodejs"` (spec §12).

---

### Task 1: Add `sharp` and `zod` production dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install both as production dependencies**

Run: `npm install sharp zod`
Expected: `sharp` and `zod` appear under `dependencies` (not `devDependencies`) in `package.json`; lockfile updated.

- [ ] **Step 2: Verify sharp loads its native binary on this platform**

Run: `node -e "const s=require('sharp'); s({create:{width:8,height:8,channels:3,background:{r:1,g:2,b:3}}}).jpeg().toBuffer().then(b=>console.log('sharp ok',b.length>0))"`
Expected: prints `sharp ok true`. If it errors with a missing-binary message, run `npm rebuild sharp` and retry. **If it still fails, STOP and flag** — the upload pipeline cannot verify images without sharp.

- [ ] **Step 3: Verify zod imports**

Run: `node -e "const {z}=require('zod'); console.log('zod ok', typeof z.object==='function')"`
Expected: prints `zod ok true`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp and zod for content engine upload pipeline"
```

---

### Task 2: Carry-forward — move service_role grants out of migration 8 into test setup

Plan 1 left a carry-forward: migration 8 contains seven `grant all … to service_role` statements on **pre-existing** live tables. Those grants are a local-test artifact (the schema-only baseline dump does not carry production's grants); on production `service_role` already holds them. Keeping them in a migration would re-grant on every production apply — harmless but misleading. Move them to a dedicated test-setup script.

**Files:**
- Create: `supabase/test/test-grants.sql`
- Modify: `supabase/migrations/20260611000008_create_content_engine_rpcs.sql` (remove the grant block)
- Modify: `scripts/content-engine/reset-test-db.sh` (apply the new script after the baseline)

- [ ] **Step 1: Create `supabase/test/test-grants.sql`**

```sql
-- Local-test-only grants. The schema-only production baseline dump does not
-- carry production's privilege grants, so the service-role test client cannot
-- write to these pre-existing live tables until we grant here. On PRODUCTION
-- service_role already holds these (Supabase default), so this file is NEVER a
-- migration — it lives only in the local reset path.
grant all on public.blog_posts to service_role;
grant all on public.portfolio_categories to service_role;
grant all on public.portfolio_images to service_role;
grant all on public.testimonials to service_role;
grant all on public.image_library to service_role;
grant all on public.family_location_photos to service_role;
grant all on public.couples_location_photos to service_role;
```

- [ ] **Step 2: Remove the grant block from migration 8**

In `supabase/migrations/20260611000008_create_content_engine_rpcs.sql`, delete these lines (the block between the header comment and `create or replace function public.create_content_package`):

```sql
-- Grant service_role access to live tables that the publish RPC writes to.
-- In the local test stack the prod-baseline dump does not carry these grants;
-- this is idempotent and harmless on production (service_role is already the
-- owner-equivalent there via Supabase's default grants).
grant all on public.blog_posts to service_role;
grant all on public.portfolio_categories to service_role;
grant all on public.portfolio_images to service_role;
grant all on public.testimonials to service_role;
grant all on public.image_library to service_role;
grant all on public.family_location_photos to service_role;
grant all on public.couples_location_photos to service_role;
```

The file must now begin with the `-- Transactional RPCs (spec §8.2, §8.4, §9). …` header comment followed directly by `create or replace function public.create_content_package(`.

- [ ] **Step 3: Apply the grants in `reset-test-db.sh` after the baseline**

In `scripts/content-engine/reset-test-db.sh`, find:

```bash
echo "Applying production schema baseline..."
run_psql -f supabase/test/prod-baseline.sql
```

Insert immediately after it:

```bash
echo "Applying local test grants..."
run_psql -f supabase/test/test-grants.sql
```

- [ ] **Step 4: Rebuild the local DB and re-run the full foundation integration suite**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration`
Expected: `test db ready`, every verify prints `VERIFY OK: …`, and ALL existing integration tests (packages, publish-guards, publish-journal, publish-portfolio, publish-school-guide) still PASS. This proves the grant move is behavior-preserving.

> If `prod-baseline.sql` is missing (a fresh clone — it is gitignored), regenerate it first: `supabase db dump --linked -f supabase/test/prod-baseline.sql` (requires `supabase link`, Plan 1 Task 2). The integration suite cannot run without the local stack up (`supabase start`) and `.env.test` populated.

- [ ] **Step 5: Commit**

```bash
git add supabase/test/test-grants.sql supabase/migrations/20260611000008_create_content_engine_rpcs.sql scripts/content-engine/reset-test-db.sh
git commit -m "refactor: move service_role test grants out of migration 8 into test setup"
```

---

### Task 3: Canonical taxonomy module (spec §8.5)

`lib/contentEngine/taxonomy.ts` is the single source of truth for engine slugs/types and the closed canonical internal-link list. School slugs match the `/grads/*` route segments (`app/(professional)/grads/*`); guide location keys are derived from the existing guide registries so they never drift. **Every** engine create/update path validates against this module, so `uc-berkley` / `UC-Berkeley` are unstorable.

**Files:**
- Create: `lib/contentEngine/taxonomy.ts`
- Create: `tests/unit/taxonomy.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/taxonomy.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  SERVICE_TYPES, SCHOOL_SLUGS, PORTFOLIO_CATEGORIES, LIGHTING_CONDITIONS,
  CONTENT_TYPES, PUBLICATION_TARGET_TYPES, GUIDE_TYPES, CANONICAL_INTERNAL_LINKS,
  isServiceType, isSchoolSlug, isPortfolioCategory, isLightingCondition,
  isContentType, isGuideType, isGuideLocationKey, isCanonicalInternalLink,
  guideLocationKeys,
} from "@/lib/contentEngine/taxonomy";

describe("taxonomy constants", () => {
  it("school slugs match the /grads/* route segments and exclude non-Bay-Area schools", () => {
    expect(SCHOOL_SLUGS).toEqual(
      expect.arrayContaining(["sjsu", "uc-berkeley", "sf-state", "stanford", "santa-clara", "usf", "csueb"]),
    );
    expect(SCHOOL_SLUGS).not.toContain("ucsc");
    expect(SCHOOL_SLUGS).not.toContain("uc-davis");
  });

  it("offers exactly the v1 service types and lighting conditions", () => {
    expect(SERVICE_TYPES).toContain("grads");
    expect(LIGHTING_CONDITIONS).toContain("golden_hour");
  });

  it("content types include social_caption (Phase 2, schema-supported) and the 7 targets", () => {
    expect(CONTENT_TYPES).toContain("social_caption");
    expect(PUBLICATION_TARGET_TYPES).toContain("none");
  });
});

describe("taxonomy validators", () => {
  it("validate known values and reject unknown / wrong-case", () => {
    expect(isServiceType("grads")).toBe(true);
    expect(isServiceType("weddings")).toBe(false);
    expect(isSchoolSlug("uc-berkeley")).toBe(true);
    expect(isSchoolSlug("UC-Berkeley")).toBe(false);
    expect(isSchoolSlug("uc-berkley")).toBe(false);
    expect(isPortfolioCategory("grads")).toBe(true);
    expect(isLightingCondition("golden_hour")).toBe(true);
    expect(isContentType("journal_post")).toBe(true);
    expect(isGuideType("family")).toBe(true);
    expect(isGuideType("families")).toBe(false);
  });

  it("guide location keys are validated per guide and come from the registries", () => {
    const familyKeys = guideLocationKeys("family");
    expect(familyKeys.length).toBeGreaterThan(0);
    expect(isGuideLocationKey("family", familyKeys[0])).toBe(true);
    expect(isGuideLocationKey("family", "not-a-real-location")).toBe(false);
    // a couples-only location must not validate under family
    expect(isGuideLocationKey("couples", "legion-of-honor")).toBe(true);
  });
});

describe("canonical internal links (closed list)", () => {
  it("includes every school page, both guide hubs, and pricing — and rejects anything else", () => {
    expect(CANONICAL_INTERNAL_LINKS).toContain("/grads/sjsu");
    expect(CANONICAL_INTERNAL_LINKS).toContain("/family-guide");
    expect(CANONICAL_INTERNAL_LINKS).toContain("/couples-guide");
    expect(CANONICAL_INTERNAL_LINKS).toContain("/pricing");
    expect(isCanonicalInternalLink("/grads/uc-berkeley")).toBe(true);
    expect(isCanonicalInternalLink("/grads/made-up")).toBe(false);
    expect(isCanonicalInternalLink("https://evil.example.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- taxonomy`
Expected: FAIL — cannot resolve `@/lib/contentEngine/taxonomy`.

- [ ] **Step 3: Write the module** (`lib/contentEngine/taxonomy.ts`)

```ts
// Canonical taxonomy for the Session Content Engine (spec §8.5). Single source
// of truth: school slugs match the /grads/* route segments, guide location keys
// derive from the existing guide registries, and the internal-link list is the
// CLOSED set the generator may reference. Every engine create/update path
// validates against this module so invalid slugs are unstorable.
import { getAllFamilyLocations } from "@/lib/familyGuide/locations";
import { getAllCouplesLocations } from "@/lib/couplesGuide/locations";

export const SERVICE_TYPES = [
  "grads", "couples", "families", "portraits", "maternity", "events", "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

// Matches app/(professional)/grads/<slug> directories exactly (Bay Area only;
// no UCSC / UC Davis — see project scope memory).
export const SCHOOL_SLUGS = [
  "csueb", "santa-clara", "sf-state", "sjsu", "stanford", "uc-berkeley", "usf",
] as const;
export type SchoolSlug = (typeof SCHOOL_SLUGS)[number];

// Marketing portfolio categories (the suggested_category constraint set, spec
// §3.2). NOTE: a portfolio_pick's live destination category is additionally
// validated against the portfolio_categories DB table at publish time (spec §7.4).
export const PORTFOLIO_CATEGORIES = [
  "grads", "couples", "families", "portraits", "maternity",
] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export const LIGHTING_CONDITIONS = [
  "morning", "midday", "afternoon", "golden_hour", "blue_hour", "night", "mixed",
] as const;
export type LightingCondition = (typeof LIGHTING_CONDITIONS)[number];

export const CONTENT_TYPES = [
  "journal_post", "portfolio_pick", "school_page_photo", "guide_photo",
  "social_caption", "testimonial_feature", "internal_link_suggestion",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// v1 generation offers everything EXCEPT social_caption (Phase 2, spec §8.2).
export const GENERATABLE_CONTENT_TYPES = CONTENT_TYPES.filter(
  (t) => t !== "social_caption",
) as Exclude<ContentType, "social_caption">[];

export const PUBLICATION_TARGET_TYPES = [
  "blog_post", "portfolio_image", "school_page_photo",
  "family_location_photo", "couples_location_photo", "testimonial", "none",
] as const;
export type PublicationTargetType = (typeof PUBLICATION_TARGET_TYPES)[number];

export const GUIDE_TYPES = ["family", "couples"] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

// Guide location keys derive from the registries (spec §8.5: keys never drift
// from the guide pages). Includes unpublished locations: publication targeting
// is independent of a location's search-visibility flag.
const FAMILY_LOCATION_KEYS = getAllFamilyLocations().map((l) => l.slug);
const COUPLES_LOCATION_KEYS = getAllCouplesLocations().map((l) => l.slug);

export function guideLocationKeys(guide: GuideType): string[] {
  return guide === "family" ? FAMILY_LOCATION_KEYS : COUPLES_LOCATION_KEYS;
}

// Closed canonical internal-link list fed to the journal generator (spec §8.3):
// every school page, both guide hubs, and the pricing page. Output links are
// validated against this list — anything else is a validation failure.
export const CANONICAL_INTERNAL_LINKS = [
  ...SCHOOL_SLUGS.map((s) => `/grads/${s}`),
  "/family-guide",
  "/couples-guide",
  ...FAMILY_LOCATION_KEYS.map((k) => `/family-guide/locations/${k}`),
  ...COUPLES_LOCATION_KEYS.map((k) => `/couples-guide/locations/${k}`),
  "/pricing",
] as const;

const has = <T extends string>(arr: readonly T[]) => {
  const set = new Set<string>(arr);
  return (v: unknown): v is T => typeof v === "string" && set.has(v);
};

export const isServiceType = has(SERVICE_TYPES);
export const isSchoolSlug = has(SCHOOL_SLUGS);
export const isPortfolioCategory = has(PORTFOLIO_CATEGORIES);
export const isLightingCondition = has(LIGHTING_CONDITIONS);
export const isContentType = has(CONTENT_TYPES);
export const isGuideType = has(GUIDE_TYPES);
export const isCanonicalInternalLink = has(CANONICAL_INTERNAL_LINKS);

export function isGuideLocationKey(guide: GuideType, key: unknown): boolean {
  return typeof key === "string" && guideLocationKeys(guide).includes(key);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- taxonomy`
Expected: PASS. If `guideLocationKeys("family")` is empty, the family registry import path is wrong — confirm `lib/familyGuide/locations` exports `getAllFamilyLocations` (it does).

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/taxonomy.ts tests/unit/taxonomy.test.ts
git commit -m "feat: canonical content-engine taxonomy module with validators"
```

---

### Task 4: Idempotency-key builder (spec §3.4)

The publish RPC enforces a unique `idempotency_key` per item. Generation builds it deterministically as `session:package:type:destination:photo` so a retry of the same logical piece reuses the same key. `destination`/`photo` are optional segments (a journal post has no single photo; an internal-link suggestion has no destination); absent segments become a stable `-` placeholder so keys never collide across shapes.

**Files:**
- Create: `lib/contentEngine/idempotency.ts`
- Create: `tests/unit/idempotency.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/idempotency.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { buildIdempotencyKey } from "@/lib/contentEngine/idempotency";

describe("buildIdempotencyKey", () => {
  it("joins session:package:type:destination:photo", () => {
    expect(buildIdempotencyKey({
      sessionId: "S", packageId: "P", contentType: "school_page_photo",
      destination: "sjsu", photoId: "PH",
    })).toBe("S:P:school_page_photo:sjsu:PH");
  });

  it("uses '-' for absent destination/photo and is stable across calls", () => {
    const args = { sessionId: "S", packageId: "P", contentType: "journal_post" } as const;
    expect(buildIdempotencyKey(args)).toBe("S:P:journal_post:-:-");
    expect(buildIdempotencyKey(args)).toBe(buildIdempotencyKey(args));
  });

  it("distinguishes two photos of the same type+destination", () => {
    const base = { sessionId: "S", packageId: "P", contentType: "portfolio_pick", destination: "grads" } as const;
    expect(buildIdempotencyKey({ ...base, photoId: "A" }))
      .not.toBe(buildIdempotencyKey({ ...base, photoId: "B" }));
  });

  it("rejects segment values containing the ':' delimiter", () => {
    expect(() => buildIdempotencyKey({
      sessionId: "S", packageId: "P", contentType: "portfolio_pick", destination: "a:b",
    })).toThrow(/delimiter|colon/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- idempotency`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the module** (`lib/contentEngine/idempotency.ts`)

```ts
// Deterministic idempotency key for session_content_items (spec §3.4):
// "session:package:type:destination:photo". Absent optional segments become a
// stable "-" so keys never collide across content shapes. The DB enforces a
// unique constraint on this key.
export interface IdempotencyKeyParts {
  sessionId: string;
  packageId: string;
  contentType: string;
  destination?: string | null;
  photoId?: string | null;
}

const PLACEHOLDER = "-";

function segment(value: string | null | undefined): string {
  if (value == null || value === "") return PLACEHOLDER;
  if (value.includes(":")) {
    throw new Error(`idempotency key segment must not contain the ':' delimiter: "${value}"`);
  }
  return value;
}

export function buildIdempotencyKey(parts: IdempotencyKeyParts): string {
  return [
    segment(parts.sessionId),
    segment(parts.packageId),
    segment(parts.contentType),
    segment(parts.destination),
    segment(parts.photoId),
  ].join(":");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- idempotency`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/idempotency.ts tests/unit/idempotency.test.ts
git commit -m "feat: deterministic idempotency-key builder for content items"
```

---

### Task 5: Zod payload schemas + session-facts snapshot (spec §3.4, §8.3)

`lib/contentEngine/payloads.ts` defines a Zod schema per `content_type` and a `validatePayload(contentType, payload)` dispatcher used by every item create/update boundary. Schemas validate against the taxonomy (school slug, portfolio category, guide location key, canonical internal-link URL) so invalid destinations are unrepresentable. `social_caption` is defined (Phase 2) but is **not** in the dispatcher's generatable set. `buildSessionFactsSnapshot(session)` strips internal-only fields (`internal_client_name`, `internal_notes`, email) so they can never reach the AI (spec §8.3).

**Files:**
- Create: `lib/contentEngine/payloads.ts`
- Create: `tests/unit/payloads.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/payloads.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  validatePayload, buildSessionFactsSnapshot, sessionFactsSnapshotSchema,
} from "@/lib/contentEngine/payloads";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("journal_post payload", () => {
  const valid = {
    title: "Golden Hour at SJSU", slug: "golden-hour-sjsu",
    body: "Para one.\n\nPara two.", meta_description: "Grad session at SJSU.",
    meta_keywords: "sjsu, graduation photos",
    photo_ids: [UUID, UUID2], cover_photo_id: UUID,
    internal_links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
    testimonial_id: null,
  };

  it("accepts a complete valid payload", () => {
    const r = validatePayload("journal_post", valid);
    expect(r.success).toBe(true);
  });

  it("rejects an internal link outside the canonical list", () => {
    const r = validatePayload("journal_post", {
      ...valid, internal_links: [{ url: "/grads/made-up", label: "x" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a cover_photo_id not present in photo_ids", () => {
    const r = validatePayload("journal_post", { ...valid, cover_photo_id: "33333333-3333-4333-8333-333333333333" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty slug and a non-uuid photo id", () => {
    expect(validatePayload("journal_post", { ...valid, slug: "" }).success).toBe(false);
    expect(validatePayload("journal_post", { ...valid, photo_ids: ["not-a-uuid"], cover_photo_id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("destination-validated payloads", () => {
  it("portfolio_pick requires a known category", () => {
    expect(validatePayload("portfolio_pick", {
      session_photo_id: UUID, category: "grads", title: "t", alt_text: "a", description: "", featured: false,
    }).success).toBe(true);
    expect(validatePayload("portfolio_pick", {
      session_photo_id: UUID, category: "weddings", title: "t", alt_text: "a", description: "", featured: false,
    }).success).toBe(false);
  });

  it("school_page_photo requires a known school slug", () => {
    expect(validatePayload("school_page_photo", {
      session_photo_id: UUID, school_slug: "uc-berkeley", alt_override: "", caption: "", sort_order: 1,
    }).success).toBe(true);
    expect(validatePayload("school_page_photo", {
      session_photo_id: UUID, school_slug: "UC-Berkeley", alt_override: "", caption: "", sort_order: 1,
    }).success).toBe(false);
  });

  it("guide_photo requires a location_key valid for its guide", () => {
    expect(validatePayload("guide_photo", {
      session_photo_id: UUID, guide: "couples", location_key: "legion-of-honor", alt_text: "a",
    }).success).toBe(true);
    // legion-of-honor is couples-only, so it must fail under family
    expect(validatePayload("guide_photo", {
      session_photo_id: UUID, guide: "family", location_key: "legion-of-honor", alt_text: "a",
    }).success).toBe(false);
  });

  it("testimonial_feature and internal_link_suggestion validate", () => {
    expect(validatePayload("testimonial_feature", { testimonial_id: UUID, quote_excerpt: "easy and fun" }).success).toBe(true);
    expect(validatePayload("internal_link_suggestion", {
      links: [{ url: "/pricing", label: "Pricing", reason: "ready to book" }],
    }).success).toBe(true);
    expect(validatePayload("internal_link_suggestion", {
      links: [{ url: "/nope", label: "x", reason: "y" }],
    }).success).toBe(false);
  });
});

describe("social_caption is Phase 2 — not validatable through the dispatcher", () => {
  it("rejects social_caption as a generatable type", () => {
    const r = validatePayload("social_caption", { platform: "instagram", caption: "hi", photo_ids: [UUID] });
    expect(r.success).toBe(false);
  });
});

describe("buildSessionFactsSnapshot", () => {
  it("keeps public facts and strips internal-only fields", () => {
    const snap = buildSessionFactsSnapshot({
      public_display_name: "Mia", service_type: "grads", school_slug: "sjsu",
      primary_location: "Tower Lawn", secondary_locations: [], session_date: "2026-05-01",
      lighting_condition: "golden_hour", graduation_year: 2026, degree: "B.S. Biology",
      outfit_count: 2, group_size: 1, public_session_summary: "A sunset grad shoot.",
      internal_client_name: "Mia Hidden", internal_notes: "paid cash", email: "mia@example.com",
    });
    expect(snap.public_display_name).toBe("Mia");
    expect(snap.service_type).toBe("grads");
    expect(snap).not.toHaveProperty("internal_client_name");
    expect(snap).not.toHaveProperty("internal_notes");
    expect(snap).not.toHaveProperty("email");
    // the result must itself be schema-valid
    expect(sessionFactsSnapshotSchema.safeParse(snap).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- payloads`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the module** (`lib/contentEngine/payloads.ts`)

```ts
// Per-content-type Zod payload schemas (spec §3.4) and the session-facts
// snapshot builder (spec §8.3). All destination references are validated
// against the canonical taxonomy so invalid slugs are unrepresentable.
import { z } from "zod";
import {
  isSchoolSlug, isPortfolioCategory, isCanonicalInternalLink,
  isGuideLocationKey, GUIDE_TYPES, SERVICE_TYPES, LIGHTING_CONDITIONS,
} from "@/lib/contentEngine/taxonomy";

const uuid = z.string().uuid();
const nonEmpty = z.string().min(1);

const internalLink = z.object({
  url: z.string().refine(isCanonicalInternalLink, "url is not in the canonical internal-link list"),
  label: nonEmpty,
});

export const journalPostPayloadSchema = z.object({
  title: nonEmpty,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  body: nonEmpty,
  meta_description: z.string().default(""),
  meta_keywords: z.string().default(""),
  photo_ids: z.array(uuid).min(1),
  cover_photo_id: uuid,
  internal_links: z.array(internalLink).default([]),
  testimonial_id: uuid.nullable().default(null),
}).refine((p) => p.photo_ids.includes(p.cover_photo_id), {
  message: "cover_photo_id must be one of photo_ids",
  path: ["cover_photo_id"],
});

export const portfolioPickPayloadSchema = z.object({
  session_photo_id: uuid,
  category: z.string().refine(isPortfolioCategory, "unknown portfolio category"),
  title: z.string().default(""),
  alt_text: z.string().default(""),
  description: z.string().default(""),
  featured: z.boolean().default(false),
});

export const schoolPagePhotoPayloadSchema = z.object({
  session_photo_id: uuid,
  school_slug: z.string().refine(isSchoolSlug, "unknown school slug"),
  alt_override: z.string().default(""),
  caption: z.string().default(""),
  sort_order: z.number().int().min(0).default(0),
});

export const guidePhotoPayloadSchema = z.object({
  session_photo_id: uuid,
  guide: z.enum(GUIDE_TYPES),
  location_key: z.string(),
  alt_text: z.string().default(""),
}).refine((p) => isGuideLocationKey(p.guide, p.location_key), {
  message: "location_key is not valid for this guide",
  path: ["location_key"],
});

// Phase 2 (spec §3.4, §8.2) — schema retained, deliberately NOT generatable.
export const socialCaptionPayloadSchema = z.object({
  platform: z.enum(["instagram", "tiktok"]),
  caption: nonEmpty,
  photo_ids: z.array(uuid).min(1),
});

export const testimonialFeaturePayloadSchema = z.object({
  testimonial_id: uuid,
  quote_excerpt: z.string().default(""),
});

export const internalLinkSuggestionPayloadSchema = z.object({
  links: z.array(z.object({
    url: z.string().refine(isCanonicalInternalLink, "url is not in the canonical internal-link list"),
    label: nonEmpty,
    reason: z.string().default(""),
  })).default([]),
});

// Dispatcher: social_caption is intentionally absent (Phase 2, spec §8.2).
const PAYLOAD_SCHEMAS = {
  journal_post: journalPostPayloadSchema,
  portfolio_pick: portfolioPickPayloadSchema,
  school_page_photo: schoolPagePhotoPayloadSchema,
  guide_photo: guidePhotoPayloadSchema,
  testimonial_feature: testimonialFeaturePayloadSchema,
  internal_link_suggestion: internalLinkSuggestionPayloadSchema,
} as const;

export type GeneratableContentType = keyof typeof PAYLOAD_SCHEMAS;

export function validatePayload(contentType: string, payload: unknown) {
  const schema = PAYLOAD_SCHEMAS[contentType as GeneratableContentType];
  if (!schema) {
    return { success: false as const, error: new Error(`no validatable payload schema for content type "${contentType}"`) };
  }
  return schema.safeParse(payload);
}

// Session-facts snapshot (spec §8.3): the ONLY facts allowed to reach the AI.
// Note the absence of internal_client_name / internal_notes / email.
export const sessionFactsSnapshotSchema = z.object({
  public_display_name: z.string().nullable().optional(),
  service_type: z.enum(SERVICE_TYPES),
  school_slug: z.string().nullable().optional(),
  primary_location: z.string().nullable().optional(),
  secondary_locations: z.array(z.string()).default([]),
  session_date: z.string().nullable().optional(),
  lighting_condition: z.enum(LIGHTING_CONDITIONS).nullable().optional(),
  graduation_year: z.number().int().nullable().optional(),
  degree: z.string().nullable().optional(),
  outfit_count: z.number().int().nullable().optional(),
  group_size: z.number().int().nullable().optional(),
  public_session_summary: z.string().nullable().optional(),
});
export type SessionFactsSnapshot = z.infer<typeof sessionFactsSnapshotSchema>;

// Pick only public fields off a session row; internal-only fields are dropped
// by construction (they are never read here), then validated by the schema.
export function buildSessionFactsSnapshot(session: Record<string, unknown>): SessionFactsSnapshot {
  return sessionFactsSnapshotSchema.parse({
    public_display_name: session.public_display_name ?? null,
    service_type: session.service_type,
    school_slug: session.school_slug ?? null,
    primary_location: session.primary_location ?? null,
    secondary_locations: session.secondary_locations ?? [],
    session_date: session.session_date ?? null,
    lighting_condition: session.lighting_condition ?? null,
    graduation_year: session.graduation_year ?? null,
    degree: session.degree ?? null,
    outfit_count: session.outfit_count ?? null,
    group_size: session.group_size ?? null,
    public_session_summary: session.public_session_summary ?? null,
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- payloads`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/payloads.ts tests/unit/payloads.test.ts
git commit -m "feat: Zod payload schemas and session-facts snapshot for content engine"
```

---

### Task 6: Derived workflow-state machine (spec §6)

`lib/contentEngine/state.ts` exports the pure `deriveSessionEngineState({ photos, activePackage, activeItems, now })` consumed by every UI surface (never re-derived in components). Lease expiry is evaluated first: an expired `processing`/`publishing` claim is treated as interrupted, not active. Only **active-package** items are passed in (archived-package failures must not affect state). Rules are evaluated top-down, first match wins (spec §6).

**Files:**
- Create: `lib/contentEngine/state.ts`
- Create: `tests/unit/state.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/state.test.ts`) — the ten mandated cases from spec §6

```ts
import { describe, it, expect } from "vitest";
import {
  deriveSessionEngineState, isLeaseExpired,
  type PhotoState, type PackageState, type ItemState,
} from "@/lib/contentEngine/state";

const NOW = new Date("2026-06-11T12:00:00Z");
const PAST = "2026-06-11T11:50:00Z";   // lease already expired
const FUTURE = "2026-06-11T12:05:00Z"; // lease still valid

const photo = (o: Partial<PhotoState> = {}): PhotoState => ({
  excluded: false, analysis_status: "completed", analysis_lease_expires_at: null, ...o,
});
const item = (o: Partial<ItemState> = {}): ItemState => ({
  status: "draft", publishing_started_at: null, ...o,
});
const pkg = (status: PackageState["status"]): PackageState => ({ status });

function derive(args: {
  photos?: PhotoState[]; activePackage?: PackageState | null; activeItems?: ItemState[];
}) {
  return deriveSessionEngineState({
    photos: args.photos ?? [], activePackage: args.activePackage ?? null,
    activeItems: args.activeItems ?? [], now: NOW,
  });
}

describe("isLeaseExpired", () => {
  it("treats null and past leases as expired, future as live", () => {
    expect(isLeaseExpired(null, NOW)).toBe(true);
    expect(isLeaseExpired(PAST, NOW)).toBe(true);
    expect(isLeaseExpired(FUTURE, NOW)).toBe(false);
  });
});

describe("deriveSessionEngineState — ten mandated cases (spec §6)", () => {
  it("1. all-rejected → reviewed (not published)", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "rejected" }), item({ status: "rejected" })],
    })).toBe("reviewed");
  });

  it("2. all-published → published", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "published" }), item({ status: "published" })],
    })).toBe("published");
  });

  it("3. one published + one approved → partially_published", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "published" }), item({ status: "approved" })],
    })).toBe("partially_published");
  });

  it("4. one published + one failed → failed (rule 1 precedence)", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "published" }), item({ status: "failed" })],
    })).toBe("failed");
  });

  it("5. archived-package failures are excluded → active 'ready' draft → generated", () => {
    // The caller passes only ACTIVE-package items, so archived failures never
    // appear here. With an active ready package + a draft, state is generated.
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"), activeItems: [item({ status: "draft" })],
    })).toBe("generated");
  });

  it("6. zero items + analyzed photos → analyzed", () => {
    expect(derive({ photos: [photo()], activePackage: null, activeItems: [] })).toBe("analyzed");
  });

  it("7. excluded failed photo does not force failed → analyzed", () => {
    expect(derive({
      photos: [photo({ excluded: true, analysis_status: "failed" }), photo({ analysis_status: "completed" })],
    })).toBe("analyzed");
  });

  it("8. all photos skipped → analyzed", () => {
    expect(derive({ photos: [photo({ analysis_status: "skipped" }), photo({ analysis_status: "skipped" })] }))
      .toBe("analyzed");
  });

  it("9. one photo processing with a live lease → analyzing", () => {
    expect(derive({
      photos: [photo({ analysis_status: "processing", analysis_lease_expires_at: FUTURE }), photo()],
    })).toBe("analyzing");
  });

  it("10. failed package with completed photos → failed", () => {
    expect(derive({ photos: [photo()], activePackage: pkg("failed"), activeItems: [] })).toBe("failed");
  });
});

describe("deriveSessionEngineState — lease-aware edges", () => {
  it("empty session → empty", () => {
    expect(derive({ photos: [] })).toBe("empty");
  });

  it("an EXPIRED processing lease is NOT 'analyzing' (interrupted, resumable)", () => {
    // expired processing claim falls through to 'uploaded' (analysis incomplete)
    expect(derive({
      photos: [photo({ analysis_status: "processing", analysis_lease_expires_at: PAST })],
    })).toBe("uploaded");
  });

  it("an active item publishing with a live lease → publishing", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "publishing", publishing_started_at: FUTURE })],
    })).toBe("publishing");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- state`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the module** (`lib/contentEngine/state.ts`)

```ts
// Pure derived workflow state for a photography session (spec §6). Consumed by
// every UI surface; never re-derived in components. Rules are evaluated
// top-down, first match wins. Lease expiry is evaluated first: an expired
// processing/publishing claim is treated as interrupted (resumable), not active.
export interface PhotoState {
  excluded: boolean;
  analysis_status: "pending" | "processing" | "completed" | "failed" | "skipped";
  analysis_lease_expires_at: string | null;
}
export interface PackageState {
  status: "generating" | "ready" | "needs_attention" | "failed" | "archived";
}
export interface ItemState {
  status: "draft" | "approved" | "rejected" | "publishing" | "published" | "failed";
  publishing_started_at: string | null;
}

export type SessionEngineState =
  | "failed" | "publishing" | "partially_published" | "published" | "reviewed"
  | "generated" | "analyzing" | "analyzed" | "uploaded" | "empty";

export interface DeriveInput {
  photos: PhotoState[];
  activePackage: PackageState | null;
  activeItems: ItemState[];
  now: Date;
}

// A lease is "expired" when absent or strictly in the past (spec §6).
export function isLeaseExpired(leaseExpiresAt: string | null, now: Date): boolean {
  if (!leaseExpiresAt) return true;
  return new Date(leaseExpiresAt).getTime() <= now.getTime();
}

export function deriveSessionEngineState(input: DeriveInput): SessionEngineState {
  const { photos, activePackage, activeItems, now } = input;
  const liveProcessing = (p: PhotoState) =>
    p.analysis_status === "processing" && !isLeaseExpired(p.analysis_lease_expires_at, now);
  const livePublishing = (i: ItemState) =>
    i.status === "publishing" && !isLeaseExpired(i.publishing_started_at, now);

  const nonExcluded = photos.filter((p) => !p.excluded);
  const nonRejected = activeItems.filter((i) => i.status !== "rejected");
  const published = nonRejected.filter((i) => i.status === "published");
  const otherUnpublished = nonRejected.filter(
    (i) => i.status === "approved" || i.status === "draft"
        || i.status === "publishing" || i.status === "failed",
  );

  // 1. failed
  if (nonExcluded.some((p) => p.analysis_status === "failed")
      || activePackage?.status === "failed"
      || activeItems.some((i) => i.status === "failed")) {
    return "failed";
  }
  // 2. publishing (live lease only)
  if (activeItems.some(livePublishing)) return "publishing";
  // 3. partially_published
  if (published.length >= 1 && otherUnpublished.length >= 1) return "partially_published";
  // 4. published (≥1 published AND every non-rejected item published)
  if (published.length >= 1 && nonRejected.every((i) => i.status === "published")) return "published";
  // 5. reviewed (items exist; all approved/rejected; none published/publishing)
  if (activeItems.length >= 1
      && activeItems.every((i) => i.status === "approved" || i.status === "rejected")) {
    return "reviewed";
  }
  // 6. generated (active package ready/needs_attention with ≥1 draft)
  if ((activePackage?.status === "ready" || activePackage?.status === "needs_attention")
      && activeItems.some((i) => i.status === "draft")) {
    return "generated";
  }
  // 7. analyzing (any non-excluded photo processing with a live lease)
  if (nonExcluded.some(liveProcessing)) return "analyzing";
  // 8. analyzed (≥1 photo; all non-excluded completed or skipped)
  if (photos.length >= 1
      && nonExcluded.every((p) => p.analysis_status === "completed" || p.analysis_status === "skipped")) {
    return "analyzed";
  }
  // 9. uploaded (≥1 photo; analysis incomplete)
  if (photos.length >= 1) return "uploaded";
  // 10. empty
  return "empty";
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- state`
Expected: PASS (all ten mandated cases + lease edges).

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/state.ts tests/unit/state.test.ts
git commit -m "feat: derived session workflow-state machine with lease-expiry handling"
```

---

### Task 7: Upload config + path-ownership helpers (spec §4.1, §4.2)

`lib/contentEngine/uploadConfig.ts` holds the private bucket id, the MIME/size/pixel caps, and the path helpers the sign route uses to **issue** a server-owned path and the finalize service uses to **verify** ownership. The server issues `originals/<sessionId>/<uuid>.<ext>`; finalize rejects any path that does not match the pattern for *that* session (a caller can never register a path belonging to another session, spec §4.2 step 5).

**Files:**
- Create: `lib/contentEngine/uploadConfig.ts`
- Create: `tests/unit/uploadConfig.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/uploadConfig.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  ORIGINALS_BUCKET, MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, ALLOWED_UPLOAD_MIME,
  extForMime, issueUploadPath, isOwnedUploadPath,
} from "@/lib/contentEngine/uploadConfig";

const SESSION = "11111111-1111-4111-8111-111111111111";

describe("upload config", () => {
  it("uses the private bucket and sane caps", () => {
    expect(ORIGINALS_BUCKET).toBe("session-content-originals");
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_IMAGE_PIXELS).toBeGreaterThan(0);
    expect(ALLOWED_UPLOAD_MIME).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("maps allowed MIME to an extension and rejects others", () => {
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/gif")).toBeNull();
    expect(extForMime("application/pdf")).toBeNull();
  });
});

describe("path issue + ownership", () => {
  it("issues originals/<session>/<uuid>.<ext>", () => {
    const p = issueUploadPath(SESSION, "image/jpeg");
    expect(p).toMatch(new RegExp(`^originals/${SESSION}/[0-9a-f-]{36}\\.jpg$`));
  });

  it("accepts a path it issued for this session", () => {
    const p = issueUploadPath(SESSION, "image/webp");
    expect(isOwnedUploadPath(p, SESSION)).toBe(true);
  });

  it("rejects a path for a different session, traversal, or wrong prefix", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    expect(isOwnedUploadPath(`originals/${other}/abc.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`originals/${SESSION}/../${other}/x.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`engine/${SESSION}/x.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`originals/${SESSION}/sub/x.jpg`, SESSION)).toBe(false);
    expect(isOwnedUploadPath(`originals/${SESSION}/x.gif`, SESSION)).toBe(false);
  });

  it("rejects issuing a path for a disallowed MIME", () => {
    expect(() => issueUploadPath(SESSION, "image/gif")).toThrow(/mime|unsupported/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- uploadConfig`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the module** (`lib/contentEngine/uploadConfig.ts`)

```ts
// Upload trust-boundary configuration (spec §4.1, §4.2). The server OWNS the
// storage path: it issues originals/<sessionId>/<uuid>.<ext> and later verifies
// a finalized path matches that pattern for the same session.
import { randomUUID } from "node:crypto";

export const ORIGINALS_BUCKET = "session-content-originals";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB (spec §4.2)
export const MAX_IMAGE_PIXELS = 50_000_000;       // decompression-bomb guard (sharp limitInputPixels)
export const ALLOWED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];

const MIME_EXT: Record<AllowedUploadMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extForMime(mime: string): string | null {
  return MIME_EXT[mime as AllowedUploadMime] ?? null;
}

export function isAllowedMime(mime: string): mime is AllowedUploadMime {
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(mime);
}

export function issueUploadPath(sessionId: string, mime: string): string {
  const ext = extForMime(mime);
  if (!ext) throw new Error(`unsupported upload MIME: ${mime}`);
  return `originals/${sessionId}/${randomUUID()}.${ext}`;
}

// True only for a single-segment file directly under originals/<sessionId>/ with
// an allowed extension. Rejects traversal, nested paths, and foreign sessions.
export function isOwnedUploadPath(path: string, sessionId: string): boolean {
  const m = /^originals\/([^/]+)\/([^/]+)\.([a-z0-9]+)$/.exec(path);
  if (!m) return false;
  const [, pathSession, base, ext] = m;
  if (pathSession !== sessionId) return false;
  if (base.includes("..") || base.includes("/")) return false;
  return (Object.values(MIME_EXT) as string[]).includes(ext);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- uploadConfig`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/uploadConfig.ts tests/unit/uploadConfig.test.ts
git commit -m "feat: upload config and server-owned path helpers for content engine"
```

---

### Task 8: Server-side image verification with sharp (spec §4.2 step 4)

`lib/contentEngine/imageVerification.ts` is the authoritative check: given the bytes the server downloaded, it computes its own SHA-256, runs `sharp.metadata()` (with `limitInputPixels` for decompression-bomb protection), and confirms the file is genuinely a supported image within the pixel/byte caps. Browser-declared hash/MIME/size/dimensions are convenience only and never trusted here.

**Files:**
- Create: `lib/contentEngine/imageVerification.ts`
- Create: `tests/unit/imageVerification.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/imageVerification.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { verifyImageBuffer, ImageVerificationError } from "@/lib/contentEngine/imageVerification";

async function jpegFixture(width = 64, height = 48) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 160, b: 140 } } })
    .jpeg().toBuffer();
}

describe("verifyImageBuffer", () => {
  it("accepts a valid JPEG and returns server-computed hash + dimensions", async () => {
    const buf = await jpegFixture(64, 48);
    const result = await verifyImageBuffer(buf);
    expect(result.format).toBe("jpeg");
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.bytes).toBe(buf.length);
    expect(result.hash).toBe(createHash("sha256").update(buf).digest("hex"));
  });

  it("rejects non-image bytes", async () => {
    await expect(verifyImageBuffer(Buffer.from("this is not an image")))
      .rejects.toBeInstanceOf(ImageVerificationError);
  });

  it("rejects a disallowed format (gif)", async () => {
    const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 1, b: 1 } } })
      .gif().toBuffer();
    await expect(verifyImageBuffer(gif)).rejects.toThrow(/format|unsupported/i);
  });

  it("rejects bytes over the size cap", async () => {
    const buf = await jpegFixture(64, 48);
    await expect(verifyImageBuffer(buf, { maxBytes: buf.length - 1 })).rejects.toThrow(/size|bytes/i);
  });

  it("rejects an image over the pixel cap (decompression-bomb guard)", async () => {
    const buf = await jpegFixture(2000, 2000); // 4,000,000 px
    await expect(verifyImageBuffer(buf, { maxPixels: 1_000_000 })).rejects.toThrow(/pixel|dimension|bomb|limit/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- imageVerification`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the module** (`lib/contentEngine/imageVerification.ts`)

```ts
// Authoritative server-side image verification (spec §4.2 step 4). Computes its
// OWN SHA-256 and validates the bytes with sharp; browser-declared metadata is
// never trusted. limitInputPixels protects against decompression bombs.
import sharp from "sharp";
import { createHash } from "node:crypto";
import {
  MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, ALLOWED_UPLOAD_MIME,
} from "@/lib/contentEngine/uploadConfig";

export class ImageVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageVerificationError";
  }
}

export interface VerifiedImage {
  hash: string;          // server-computed SHA-256 (feeds the unique constraint)
  format: string;        // 'jpeg' | 'png' | 'webp'
  width: number;
  height: number;
  bytes: number;
}

export interface VerifyOptions {
  maxBytes?: number;
  maxPixels?: number;
}

// sharp format names mapped from the allowed MIME list.
const ALLOWED_FORMATS = new Set(
  ALLOWED_UPLOAD_MIME.map((m) => (m === "image/jpeg" ? "jpeg" : m.replace("image/", ""))),
);

export async function verifyImageBuffer(buffer: Buffer, opts: VerifyOptions = {}): Promise<VerifiedImage> {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  const maxPixels = opts.maxPixels ?? MAX_IMAGE_PIXELS;

  if (buffer.length === 0) throw new ImageVerificationError("empty upload");
  if (buffer.length > maxBytes) {
    throw new ImageVerificationError(`file size ${buffer.length} bytes exceeds cap ${maxBytes}`);
  }

  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: maxPixels }).metadata();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ImageVerificationError(`not a decodable image (or exceeds pixel limit): ${reason}`);
  }

  const { format, width, height } = meta;
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new ImageVerificationError(`unsupported image format: ${format ?? "unknown"}`);
  }
  if (!width || !height) throw new ImageVerificationError("image has no decodable dimensions");
  if (width * height > maxPixels) {
    throw new ImageVerificationError(`image ${width}x${height} exceeds pixel cap ${maxPixels}`);
  }

  return {
    hash: createHash("sha256").update(buffer).digest("hex"),
    format, width, height, bytes: buffer.length,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- imageVerification`
Expected: PASS. (The pixel-cap test relies on sharp reading dimensions before the explicit `width*height` check; both the `limitInputPixels` decode guard and the explicit check are exercised.)

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/imageVerification.ts tests/unit/imageVerification.test.ts
git commit -m "feat: server-side sharp image verification with bomb protection"
```

---

### Task 9: `finalizeUpload` service + integration tests (spec §4.2 steps 3-6)

`lib/contentEngine/finalizeUpload.ts` is the testable core of the finalize route: given a service-role client, a session id, and the client-reported storage path, it (1) checks path ownership, (2) downloads the object, (3) verifies it with `verifyImageBuffer`, (4) inserts a `session_photos` row with the **server** hash/dimensions, and (5) on any failure deletes the object and throws. Integration tests run it against the local stack's real storage + database.

**Files:**
- Create: `lib/contentEngine/finalizeUpload.ts`
- Create: `tests/integration/upload-finalize.test.ts`

- [ ] **Step 1: Write the failing integration test** (`tests/integration/upload-finalize.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { service, resetDb, createTestSession } from "./helpers";
import { finalizeUpload, UploadFinalizationError } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";

beforeAll(() => resetDb());

async function jpeg(width = 80, height = 60) {
  return sharp({ create: { width, height, channels: 3, background: { r: 100, g: 150, b: 130 } } })
    .jpeg().toBuffer();
}

async function uploadRaw(path: string, body: Buffer, contentType: string) {
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}

describe("finalizeUpload (spec §4.2)", () => {
  it("inserts a session_photos row with the SERVER-computed hash and dimensions", async () => {
    const sessionId = await createTestSession();
    const path = issueUploadPath(sessionId, "image/jpeg");
    const buf = await jpeg(80, 60);
    await uploadRaw(path, buf, "image/jpeg");

    const row = await finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "shot.jpg", mime: "image/jpeg", sizeBytes: 999, contentHash: "client-claimed-bogus" },
    });

    expect(row.width).toBe(80);
    expect(row.height).toBe(60);
    expect(row.content_hash).not.toBe("client-claimed-bogus");
    expect(row.content_hash).toHaveLength(64); // sha256 hex
    expect(row.storage_path).toBe(path);
    expect(row.analysis_status).toBe("pending");

    const { data } = await service.from("session_photos").select("id,content_hash,width,height").eq("id", row.id).single();
    expect(data!.content_hash).toBe(row.content_hash);
  });

  it("rejects a path belonging to another session and deletes nothing it doesn't own", async () => {
    const sessionId = await createTestSession();
    const other = await createTestSession();
    const path = issueUploadPath(other, "image/jpeg"); // foreign path
    await uploadRaw(path, await jpeg(), "image/jpeg");

    await expect(finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "x.jpg", mime: "image/jpeg", sizeBytes: 1, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);

    // The foreign object must remain (we only delete objects we own + reject).
    const { data } = await service.storage.from(ORIGINALS_BUCKET).download(path);
    expect(data).not.toBeNull();
  });

  it("rejects non-image bytes and deletes the invalid object", async () => {
    const sessionId = await createTestSession();
    const path = issueUploadPath(sessionId, "image/jpeg");
    await uploadRaw(path, Buffer.from("definitely not an image"), "image/jpeg");

    await expect(finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "x.jpg", mime: "image/jpeg", sizeBytes: 1, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);

    const { data } = await service.storage.from(ORIGINALS_BUCKET).download(path);
    expect(data).toBeNull(); // invalid object cleaned up (spec §4.2 step 6)
  });

  it("rejects a duplicate source hash within the same session (unique constraint)", async () => {
    const sessionId = await createTestSession();
    const buf = await jpeg(120, 90);

    const p1 = issueUploadPath(sessionId, "image/jpeg");
    await uploadRaw(p1, buf, "image/jpeg");
    await finalizeUpload({
      client: service, sessionId, storagePath: p1,
      declared: { filename: "a.jpg", mime: "image/jpeg", sizeBytes: buf.length, contentHash: "x" },
    });

    const p2 = issueUploadPath(sessionId, "image/jpeg");
    await uploadRaw(p2, buf, "image/jpeg"); // identical bytes → identical server hash
    await expect(finalizeUpload({
      client: service, sessionId, storagePath: p2,
      declared: { filename: "b.jpg", mime: "image/jpeg", sizeBytes: buf.length, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);
  });

  it("rejects a path whose object does not exist in storage", async () => {
    const sessionId = await createTestSession();
    const path = `originals/${sessionId}/${randomUUID()}.jpg`; // owned shape, never uploaded
    await expect(finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "x.jpg", mime: "image/jpeg", sizeBytes: 1, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:integration -- upload-finalize`
Expected: FAIL — cannot resolve `@/lib/contentEngine/finalizeUpload`.

- [ ] **Step 3: Write the service** (`lib/contentEngine/finalizeUpload.ts`)

```ts
// Server-side upload finalization (spec §4.2 steps 3-6). The browser-declared
// metadata is convenience only; this function trusts ONLY what it downloads and
// verifies. On any failure it deletes the object it owns and throws.
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyImageBuffer, ImageVerificationError } from "@/lib/contentEngine/imageVerification";
import { ORIGINALS_BUCKET, isOwnedUploadPath } from "@/lib/contentEngine/uploadConfig";

export class UploadFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadFinalizationError";
  }
}

export interface DeclaredUploadMeta {
  filename: string;
  mime: string;
  sizeBytes: number;
  contentHash: string; // client-claimed; NOT trusted (compared for telemetry only)
}

export interface FinalizeUploadArgs {
  client: SupabaseClient;
  sessionId: string;
  storagePath: string;
  declared: DeclaredUploadMeta;
}

export interface SessionPhotoRow {
  id: string;
  storage_path: string;
  content_hash: string;
  width: number;
  height: number;
  mime_type: string;
  analysis_status: string;
}

async function removeOwnedObject(client: SupabaseClient, path: string) {
  await client.storage.from(ORIGINALS_BUCKET).remove([path]);
}

export async function finalizeUpload(args: FinalizeUploadArgs): Promise<SessionPhotoRow> {
  const { client, sessionId, storagePath, declared } = args;

  // (5) Path ownership: never delete or register a path we don't own.
  if (!isOwnedUploadPath(storagePath, sessionId)) {
    throw new UploadFinalizationError(`storage path is not owned by session ${sessionId}: ${storagePath}`);
  }

  // (4a) Download the object (service role).
  const { data: blob, error: dlErr } = await client.storage.from(ORIGINALS_BUCKET).download(storagePath);
  if (dlErr || !blob) {
    throw new UploadFinalizationError(`could not download finalized object: ${dlErr?.message ?? "missing"}`);
  }
  const buffer = Buffer.from(await blob.arrayBuffer());

  // (4b) Authoritative verification; invalid → delete + reject (6).
  let verified;
  try {
    verified = await verifyImageBuffer(buffer);
  } catch (err) {
    await removeOwnedObject(client, storagePath);
    const reason = err instanceof ImageVerificationError ? err.message : String(err);
    throw new UploadFinalizationError(`image verification failed: ${reason}`);
  }

  const format = verified.format === "jpeg" ? "image/jpeg" : `image/${verified.format}`;

  // (6) Insert with SERVER-computed hash/dimensions. The unique
  // (photography_session_id, content_hash) prevents accidental re-upload.
  const { data, error } = await client
    .from("session_photos")
    .insert({
      photography_session_id: sessionId,
      storage_path: storagePath,
      content_hash: verified.hash,
      original_filename: declared.filename,
      width: verified.width,
      height: verified.height,
      mime_type: format,
      file_size_bytes: verified.bytes,
      analysis_status: "pending",
    })
    .select("id,storage_path,content_hash,width,height,mime_type,analysis_status")
    .single();

  if (error) {
    // Duplicate hash or any insert failure: delete the now-orphaned object.
    await removeOwnedObject(client, storagePath);
    throw new UploadFinalizationError(`could not record session photo: ${error.message}`);
  }
  return data as SessionPhotoRow;
}
```

- [ ] **Step 4: Run the integration tests**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration -- upload-finalize`
Expected: all five `upload-finalize` cases PASS.

> If the duplicate-hash case fails because the object from the FIRST finalize was deleted, re-read: the first finalize succeeds and keeps its object; only the SECOND (duplicate) insert errors and deletes the second object. If storage downloads return a non-null empty Blob for missing objects on this local stack version, assert on `(await blob.arrayBuffer()).byteLength === 0` inside the test instead of `data === null` — but the service's own download-error path already covers the missing-object case via `finalizeUpload`.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/finalizeUpload.ts tests/integration/upload-finalize.test.ts
git commit -m "feat: finalizeUpload service with server-side verification and cleanup"
```

---

### Task 10: Sign + finalize route handlers (spec §4.2 steps 1, 3)

Two thin route handlers under `app/api/admin/session-content/photos/`. `sign` validates the declared filename/MIME/size, issues a server-owned path, and returns a signed upload URL + token. `finalize` calls `finalizeUpload`. Both gate on `requireAdmin(req)` and use the service-role admin client; both declare `runtime = "nodejs"` (finalize imports sharp transitively; sign is kept consistent).

**Files:**
- Create: `app/api/admin/session-content/photos/sign/route.ts`
- Create: `app/api/admin/session-content/photos/finalize/route.ts`

- [ ] **Step 1: Write the sign route** (`app/api/admin/session-content/photos/sign/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  ORIGINALS_BUCKET, MAX_UPLOAD_BYTES, isAllowedMime, issueUploadPath,
} from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { sessionId?: unknown; filename?: unknown; mime?: unknown; sizeBytes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const mime = typeof body.mime === "string" ? body.mime : "";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : -1;

  if (!UUID_RE.test(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  if (!isAllowedMime(mime)) return NextResponse.json({ error: "unsupported MIME type" }, { status: 400 });
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `sizeBytes must be 1..${MAX_UPLOAD_BYTES}` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: session, error: sErr } = await admin
    .from("photography_sessions").select("id").eq("id", sessionId).maybeSingle();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "photography session not found" }, { status: 404 });

  const path = issueUploadPath(sessionId, mime);
  const { data, error } = await admin.storage.from(ORIGINALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("sign upload url failed", error);
    return NextResponse.json({ error: "could not create signed upload URL" }, { status: 500 });
  }

  return NextResponse.json({ bucket: ORIGINALS_BUCKET, path: data.path, token: data.token, signedUrl: data.signedUrl });
}
```

- [ ] **Step 2: Write the finalize route** (`app/api/admin/session-content/photos/finalize/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { finalizeUpload, UploadFinalizationError } from "@/lib/contentEngine/finalizeUpload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: {
    sessionId?: unknown; storagePath?: unknown;
    filename?: unknown; mime?: unknown; sizeBytes?: unknown; contentHash?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  if (!UUID_RE.test(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  if (!storagePath) return NextResponse.json({ error: "storagePath is required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  try {
    const row = await finalizeUpload({
      client: admin, sessionId, storagePath,
      declared: {
        filename: typeof body.filename === "string" ? body.filename : "upload",
        mime: typeof body.mime === "string" ? body.mime : "",
        sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : 0,
        contentHash: typeof body.contentHash === "string" ? body.contentHash : "",
      },
    });
    return NextResponse.json({ photo: row });
  } catch (err) {
    if (err instanceof UploadFinalizationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("finalizeUpload unexpected error", err);
    return NextResponse.json({ error: "upload finalization failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check and lint the new routes**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (If `tsc` flags the Supabase storage `createSignedUploadUrl` return shape, confirm `@supabase/supabase-js` is v2 — it is, `^2.101.1` — which returns `{ data: { path, token, signedUrl } }`.)

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/session-content/photos/sign/route.ts app/api/admin/session-content/photos/finalize/route.ts
git commit -m "feat: signed-upload and finalize routes for session photos"
```

---

### Task 11: Full-suite run + plan wrap-up

- [ ] **Step 1: Clean rebuild and run every test**

Run: `./scripts/content-engine/reset-test-db.sh && npm test && npm run test:integration`
Expected: every unit test (smoke, taxonomy, idempotency, payloads, state, uploadConfig, imageVerification) and every integration test (packages, publish-guards, publish-journal, publish-portfolio, publish-school-guide, upload-finalize) passes from a fresh database.

- [ ] **Step 2: Type-check and lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Confirm no production contact**

Run: `git log --oneline -12`
Confirm the commits are all local domain/upload work; **nothing was applied to production** (this plan adds no migrations and the only DB the tests touch is the local stack, guarded by `reset-test-db.sh`'s non-local refusal). 

- [ ] **Step 4: Final commit of any stragglers and stop**

```bash
git add -A && git commit -m "chore: content engine upload pipeline + domain modules complete (plan 2 of 6)" || echo "nothing to commit"
```

**STOP.** Plan 3 (analysis & generation) builds on these domain modules: the analysis pipeline (adaptive batching, atomic photo-claim, Claude vision per spec §8.1), the generation pipeline calling `create_content_package` + per-type generation (§8.2), prompt construction (§8.3) using `buildSessionFactsSnapshot` and the canonical internal-link list, and the AI pricing/usage map (§11). Production migration apply remains a Plan-6 gate requiring explicit user authorization.

---

## Self-Review Notes

- **Spec coverage (Plan 2 scope):** §8.5 canonical taxonomy → Task 3; §3.4 idempotency key → Task 4; §3.4 per-type Zod payloads + §8.3 session-facts snapshot (internal-field stripping) → Task 5; §6 derived state machine with the ten mandated cases + lease expiry → Task 6; §4.1/§4.2 private bucket id, caps, server-owned path issue/ownership → Task 7; §4.2 step 4 sharp verification + SHA-256 + bomb guard → Task 8; §4.2 steps 3-6 finalize service with cleanup + the §13.2 upload-verification integration cases (bad MIME/non-image, foreign path, duplicate source hash, missing object) → Task 9; §4.2 step 1/3 routes with `requireAdmin` + service-role + `runtime=nodejs` (§12) → Task 10. Carry-forward from Plan 1 (grants out of migration 8) → Task 2.
- **Deferred to later plans (correctly out of scope):** signed-URL *thumbnail* reads for the admin UI (Plan 4 UI), the `prepareApprovedDerivatives` public-derivative builder (Plan 4 publishers), analysis/generation prompts and pipelines (Plan 3), analytics path/referrer normalization and attribution (Plan 6), abandoned-upload sweep and retention tooling (deferred §15). The `social_caption` schema is defined but never dispatcher-validatable or generatable (Phase 2).
- **Type consistency:** `validatePayload(contentType, payload)` returns a Zod `SafeParseReturnType` (`.success`) in Task 5 and is asserted that way in its test; `verifyImageBuffer` returns `VerifiedImage {hash,format,width,height,bytes}` (Task 8) and `finalizeUpload` consumes exactly those fields (Task 9); `ORIGINALS_BUCKET`/`issueUploadPath`/`isOwnedUploadPath` signatures match across Tasks 7, 9, 10; `deriveSessionEngineState` input/return types match the test in Task 6. The two routes import only symbols exported by `uploadConfig.ts` and `finalizeUpload.ts`.
- **No placeholders:** every code step contains complete code; every run step has an exact command and expected output.
