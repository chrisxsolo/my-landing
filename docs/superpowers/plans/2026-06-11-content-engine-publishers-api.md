# Content Engine Publishers + Engine APIs (Plan 4A of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the publishers' Node side — public-derivative creation (spec §4.3), the three-step publish flow (§9.1 Step A/B/C), takedown with the shared-derivative rule, and reconciliation (§9.4) — plus every engine API route the Plan-4B admin UI will consume (sessions CRUD with prefill and derived state, item autosave with optimistic concurrency, item status transitions, photo listing/editing, permissions with revocation acknowledgement).

**Architecture:** Services hold all logic and take an injected Supabase client (and, for publish, an injected `revalidate` function) so integration tests run against the real local stack with no Next runtime. Routes stay thin (`requireAdmin` → service). Derivatives are content-addressed (`engine/<session>/<photo>/<hash>.jpg`) in the EXISTING public bucket `grad-photos`, created only at publish Step A, with EXIF/GPS stripped (sharp strips all metadata by default). Step B is the existing `publish_session_content_item` RPC; Step C is targeted `revalidatePath` from a pure path map, with failures returned as recoverable (never unpublishing).

**Tech Stack:** TypeScript, Next.js 16 route handlers (`params: Promise<{id}>` + `await params` — repo convention), sharp, zod v4, `@supabase/supabase-js`, Vitest integration tests on the local stack.

**Plan series:** 1 Foundation (DONE) → 2 Upload + domain (DONE) → 3 Analysis & generation (DONE) → **4A Publishers + engine APIs (this plan)** → 4B Admin workflow UI → 5 Public-page integrations → 6 Analytics + deployment verification.

**Spec is law:** if any step contradicts `docs/superpowers/specs/2026-06-10-session-content-engine-design.md`, the spec wins; stop and flag it.

**Standing constraints:** Nothing applied to production (Plan-6 gate; this plan adds NO migrations). Engine tables only via `requireAdmin` → service-role client. `marketing_permission` is enforced server-side in Step A AND in the RPC. Files <400 lines, functions <50 lines.

**Decisions locked in this plan (apply consistently):**
- **Step-A failure** (derivative build error) leaves the item `approved` (retryable) and returns `failed` — no DB mark. **Step-B guard rejections** (not approved / permission / already published / archived / claimed) → `blocked`, item untouched. **Step-B genuine failures** (slug conflict, db errors) → route records `status='failed'` + capped error (draft preserved, spec §9.1).
- **Editing an approved item's payload reverts it to `draft`** (approval is a review of specific content; changed content needs re-review). `approve` is allowed from `draft` and `failed` (clears `error`); `reject` from `draft|approved|failed`; `unreject` → `draft`.
- **Takedown preserves history**: the item stays `published` and gains `published_ref.taken_down_at`; live records are deleted (blog+library, portfolio) or deactivated (school `active=false`, guide `published=false`, testimonial unlink); derivatives are deleted only when zero live references remain (§4.3).

---

## File Structure

```
lib/contentEngine/
  derivatives.ts        — prepareApprovedDerivatives + photoIdsFromPayload (spec §4.3, §9.1 Step A)
  derivativeRefs.ts     — countLiveReferences: shared-derivative reference counting (§4.3)
  publishRevalidation.ts — pathsForPublishedItem: content_type → revalidate paths (§9.1 Step C)
  publishItem.ts        — publishApprovedItem: Step A → RPC Step B → Step C (§9.1)
  takedown.ts           — takedownPublishedItem (§7.3, §4.3)
  reconcile.ts          — stuck publishing / failed-with-existing-target / orphaned derivatives (§9.4)
  prefill.ts            — sessionTypeToServiceType + firstNameOf (§7.2)
  sessionState.ts       — assembleSessionState: DB rows → deriveSessionEngineState inputs (§6 consumer)
app/api/admin/session-content/
  publish/route.ts                      — POST publish one approved item
  takedown/route.ts                     — POST takedown one published item
  reconcile/route.ts                    — GET report · POST link-to-existing / mark_failed
  sessions/route.ts                     — GET list (with derived state) · POST create (blank | from client session)
  sessions/[id]/route.ts                — GET workspace payload · PATCH facts
  sessions/[id]/permissions/route.ts    — PATCH permissions (+ revocation acknowledgement)
  items/[id]/route.ts                   — PATCH autosave (payload_revision optimistic concurrency)
  items/[id]/status/route.ts            — POST approve | reject | unreject
  photos/route.ts                       — GET photos for a session (1h signed thumbnails)
  photos/[id]/route.ts                  — PATCH photo (exclude, sort, metadata)
tests/integration/
  derivatives.test.ts · publish-item.test.ts · takedown.test.ts · items-api.test.ts
  sessions-api.test.ts · reconcile.test.ts
tests/unit/
  publishRevalidation.test.ts · prefill.test.ts
```

Conventions: service errors are typed classes with a `kind`; routes map kinds to status codes. Integration tests import services directly (not routes) with the `service` client from `tests/integration/helpers.ts` — route-level behavior lands on the Plan-4B manual checklist. `grad-photos` does not exist in the local stack's storage; tests create it via `ensurePublicBucket()` (helper added in Task 1).

---

### Task 1: Derivatives — `prepareApprovedDerivatives` (spec §4.3, §9.1 Step A)

**Files:**
- Create: `lib/contentEngine/derivatives.ts`
- Create: `tests/integration/derivatives.test.ts`
- Modify: `tests/integration/helpers.ts` (add `ensurePublicBucket`)

- [ ] **Step 1: Add the bucket helper.** In `tests/integration/helpers.ts`, append:

```ts
// The public derivatives bucket exists in production but not in the local
// stack (the baseline dump is schema-only). Tests create it on demand.
export async function ensurePublicBucket(name: string) {
  const { error } = await service.storage.createBucket(name, { public: true });
  if (error && !/already exists/i.test(error.message)) throw error;
}
```

- [ ] **Step 2: Write the failing test** (`tests/integration/derivatives.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import {
  prepareApprovedDerivatives, photoIdsFromPayload, DerivativeError,
  PUBLIC_DERIVATIVES_BUCKET,
} from "@/lib/contentEngine/derivatives";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
});

// Unique real bytes (seed varies dimensions — JPEG quantization collapses
// near-identical solid colors to identical bytes).
async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 400 + seed * 2, height: 300, channels: 3, background: { r: (seed * 37) % 255, g: 90, b: 60 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  return finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `d${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
}

async function approvedItem(sessionId: string, contentType: string, payload: Record<string, unknown>) {
  const { data: pkg, error: pErr } = await service.rpc("create_content_package", {
    p_session_id: sessionId, p_model_name: "claude-sonnet-4-6", p_prompt_version: "v1",
    p_selected_types: [contentType === "portfolio_pick" ? "portfolio_pick" : "journal_post"],
    p_session_facts: { service_type: "grads" }, p_generation_settings: {},
    p_archive_current: true, p_copy_items: [], // archive prior package: tests reuse sessions
  });
  if (pErr) throw pErr;
  const { data, error } = await service.from("session_content_items").insert({
    package_id: pkg, content_type: contentType, status: "approved", payload,
    approved_at: new Date().toISOString(), approved_by: "test",
    idempotency_key: `deriv:${pkg}:${contentType}:${Math.random()}`,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

describe("photoIdsFromPayload", () => {
  it("extracts ids per content type", () => {
    expect(photoIdsFromPayload("journal_post", { photo_ids: ["a", "b"], cover_photo_id: "a" }))
      .toEqual(["a", "b"]);
    expect(photoIdsFromPayload("portfolio_pick", { session_photo_id: "x" })).toEqual(["x"]);
    expect(photoIdsFromPayload("school_page_photo", { session_photo_id: "y" })).toEqual(["y"]);
    expect(photoIdsFromPayload("guide_photo", { session_photo_id: "z" })).toEqual(["z"]);
    expect(photoIdsFromPayload("testimonial_feature", { testimonial_id: "t" })).toEqual([]);
    expect(photoIdsFromPayload("internal_link_suggestion", { links: [] })).toEqual([]);
  });
});

describe("prepareApprovedDerivatives (spec §4.3)", () => {
  it("builds a content-addressed public derivative and records it on the photo", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 1);
    const item = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "t", alt_text: "a", description: "", featured: false,
    });

    const results = await prepareApprovedDerivatives({ client: service, itemId: item });
    expect(results).toHaveLength(1);
    expect(results[0].reused).toBe(false);
    expect(results[0].url).toContain(`engine/${sessionId}/${photo.id}/${photo.content_hash}.jpg`);

    const { data: row } = await service.from("session_photos")
      .select("public_derivative_url,public_derivative_storage_path,public_derivative_content_hash,public_derivative_created_at")
      .eq("id", photo.id).single();
    expect(row!.public_derivative_url).toBe(results[0].url);
    expect(row!.public_derivative_storage_path).toBe(`engine/${sessionId}/${photo.id}/${photo.content_hash}.jpg`);
    expect(row!.public_derivative_content_hash).toBe(photo.content_hash);
    expect(row!.public_derivative_created_at).not.toBeNull();

    // the object is genuinely in the public bucket and is a valid JPEG with no EXIF
    const { data: blob } = await service.storage.from(PUBLIC_DERIVATIVES_BUCKET)
      .download(`engine/${sessionId}/${photo.id}/${photo.content_hash}.jpg`);
    const meta = await sharp(Buffer.from(await blob!.arrayBuffer())).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined(); // metadata stripped (spec §4.3: incl. GPS)
  });

  it("is idempotent: a second run reuses the existing derivative", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 2);
    const item = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    const first = await prepareApprovedDerivatives({ client: service, itemId: item });
    const second = await prepareApprovedDerivatives({ client: service, itemId: item });
    expect(first[0].reused).toBe(false);
    expect(second[0].reused).toBe(true);
    expect(second[0].url).toBe(first[0].url);
  });

  it("covers every journal photo (cover + extras), deduplicated", async () => {
    const sessionId = await createTestSession();
    const a = await realPhoto(sessionId, 3);
    const b = await realPhoto(sessionId, 4);
    const item = await approvedItem(sessionId, "journal_post", {
      title: "T", slug: `deriv-journal-${Date.now()}`, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [a.id, b.id], cover_photo_id: a.id, internal_links: [], testimonial_id: null,
    });
    const results = await prepareApprovedDerivatives({ client: service, itemId: item });
    expect(results).toHaveLength(2);
    expect(new Set(results.map((r) => r.photoId))).toEqual(new Set([a.id, b.id]));
  });

  it("rejects unapproved items, missing permission, and foreign photos", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 5);

    // draft item
    const draft = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    await service.from("session_content_items").update({ status: "draft", approved_at: null }).eq("id", draft);
    await expect(prepareApprovedDerivatives({ client: service, itemId: draft }))
      .rejects.toMatchObject({ kind: "not_approved" });

    // marketing permission off
    const noPerm = await createTestSession({ marketing_permission: false });
    const photo2 = await realPhoto(noPerm, 6);
    const item2 = await approvedItem(noPerm, "portfolio_pick", {
      session_photo_id: photo2.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    await expect(prepareApprovedDerivatives({ client: service, itemId: item2 }))
      .rejects.toMatchObject({ kind: "permission" });

    // payload referencing another session's photo
    const other = await createTestSession();
    const foreign = await realPhoto(other, 7);
    const item3 = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: foreign.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    await expect(prepareApprovedDerivatives({ client: service, itemId: item3 }))
      .rejects.toMatchObject({ kind: "foreign_photo" });
  });

  it("returns [] for photo-less content types without touching storage", async () => {
    const sessionId = await createTestSession();
    const item = await approvedItem(sessionId, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "Pricing", reason: "r" }],
    });
    expect(await prepareApprovedDerivatives({ client: service, itemId: item })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure** — `npm run test:integration -- derivatives` → FAIL (module missing).

- [ ] **Step 4: Write the module** (`lib/contentEngine/derivatives.ts`)

```ts
// Publish Step A (spec §4.3, §9.1): build the public, content-addressed
// derivative for every photo an approved item references. Photo ids come ONLY
// from the item's validated payload; ownership is verified; sharp strips all
// metadata (EXIF/GPS) by default. Content-addressed paths make retries exact
// and idempotent; an A-succeeded/B-failed gap leaves only an unreferenced file.
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORIGINALS_BUCKET, MAX_IMAGE_PIXELS } from "@/lib/contentEngine/uploadConfig";
import { validatePayload } from "@/lib/contentEngine/payloads";

export const PUBLIC_DERIVATIVES_BUCKET = "grad-photos"; // existing public bucket (spec §4.1)
export const MAX_DERIVATIVE_DIMENSION = 2400;
export const DERIVATIVE_JPEG_QUALITY = 82;

export type DerivativeErrorKind =
  | "not_found" | "not_approved" | "permission" | "payload"
  | "foreign_photo" | "source_missing" | "storage";

export class DerivativeError extends Error {
  readonly kind: DerivativeErrorKind;
  constructor(message: string, kind: DerivativeErrorKind) {
    super(message);
    this.name = "DerivativeError";
    this.kind = kind;
  }
}

// Photo ids referenced by a payload, deduplicated, per content type. Photo-less
// types return [] (they need no derivatives).
export function photoIdsFromPayload(contentType: string, payload: Record<string, unknown>): string[] {
  switch (contentType) {
    case "journal_post": {
      const ids = Array.isArray(payload.photo_ids) ? (payload.photo_ids as string[]) : [];
      const cover = typeof payload.cover_photo_id === "string" ? [payload.cover_photo_id] : [];
      return [...new Set([...ids, ...cover])];
    }
    case "portfolio_pick":
    case "school_page_photo":
    case "guide_photo":
      return typeof payload.session_photo_id === "string" ? [payload.session_photo_id] : [];
    default:
      return [];
  }
}

export interface DerivativeResult {
  photoId: string;
  url: string;
  storagePath: string;
  reused: boolean;
}

interface PhotoRow {
  id: string;
  photography_session_id: string;
  storage_path: string;
  content_hash: string;
  public_derivative_url: string | null;
  public_derivative_content_hash: string | null;
}

export function derivativeStoragePath(sessionId: string, photoId: string, contentHash: string): string {
  return `engine/${sessionId}/${photoId}/${contentHash}.jpg`;
}

async function buildDerivative(client: SupabaseClient, sessionId: string, photo: PhotoRow): Promise<DerivativeResult> {
  const { data: blob, error: dlErr } = await client.storage.from(ORIGINALS_BUCKET).download(photo.storage_path);
  if (dlErr || !blob) {
    throw new DerivativeError(`source object missing for photo ${photo.id}: ${dlErr?.message ?? "missing"}`, "source_missing");
  }
  const derivative = await sharp(Buffer.from(await blob.arrayBuffer()), { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate() // EXIF-orient (spec §4.3)
    .resize({ width: MAX_DERIVATIVE_DIMENSION, height: MAX_DERIVATIVE_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: DERIVATIVE_JPEG_QUALITY }) // metadata (EXIF/GPS) stripped by default
    .toBuffer();

  const storagePath = derivativeStoragePath(sessionId, photo.id, photo.content_hash);
  const { error: upErr } = await client.storage.from(PUBLIC_DERIVATIVES_BUCKET)
    .upload(storagePath, derivative, { contentType: "image/jpeg", upsert: true }); // content-addressed: retries are exact
  if (upErr) throw new DerivativeError(`derivative upload failed for photo ${photo.id}: ${upErr.message}`, "storage");

  const url = client.storage.from(PUBLIC_DERIVATIVES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const { error: recErr } = await client.from("session_photos").update({
    public_derivative_url: url,
    public_derivative_storage_path: storagePath,
    public_derivative_content_hash: photo.content_hash,
    public_derivative_created_at: new Date().toISOString(),
  }).eq("id", photo.id);
  if (recErr) throw new DerivativeError(`could not record derivative for photo ${photo.id}: ${recErr.message}`, "storage");

  return { photoId: photo.id, url, storagePath, reused: false };
}

export interface PrepareDerivativesArgs {
  client: SupabaseClient;
  itemId: string;
}

export async function prepareApprovedDerivatives(args: PrepareDerivativesArgs): Promise<DerivativeResult[]> {
  const { client, itemId } = args;

  const { data: item, error: iErr } = await client.from("session_content_items")
    .select("id,content_type,status,payload,package_id").eq("id", itemId).maybeSingle();
  if (iErr || !item) throw new DerivativeError(`content item not found: ${iErr?.message ?? itemId}`, "not_found");
  if (item.status !== "approved") {
    throw new DerivativeError(`item is not approved (status=${item.status})`, "not_approved");
  }

  const { data: pkg } = await client.from("session_content_packages")
    .select("photography_session_id").eq("id", item.package_id).single();
  const sessionId = pkg!.photography_session_id as string;

  const { data: session } = await client.from("photography_sessions")
    .select("marketing_permission").eq("id", sessionId).single();
  if (!session?.marketing_permission) {
    throw new DerivativeError("marketing permission is not enabled for this session", "permission");
  }

  const ids = photoIdsFromPayload(item.content_type, item.payload as Record<string, unknown>);
  if (ids.length === 0) return [];

  // photo ids are derived from the item's VALIDATED payload (spec §4.3)
  const validated = validatePayload(item.content_type, item.payload);
  if (!validated.success) {
    throw new DerivativeError(`item payload is invalid: ${validated.error.message}`, "payload");
  }

  const { data: photos, error: pErr } = await client.from("session_photos")
    .select("id,photography_session_id,storage_path,content_hash,public_derivative_url,public_derivative_content_hash")
    .in("id", ids);
  if (pErr) throw new DerivativeError(`could not load photos: ${pErr.message}`, "storage");
  const byId = new Map((photos ?? []).map((p) => [p.id as string, p as PhotoRow]));

  const results: DerivativeResult[] = [];
  for (const id of ids) {
    const photo = byId.get(id);
    if (!photo || photo.photography_session_id !== sessionId) {
      throw new DerivativeError(`photo ${id} does not belong to this item's session`, "foreign_photo");
    }
    if (photo.public_derivative_url && photo.public_derivative_content_hash === photo.content_hash) {
      results.push({
        photoId: photo.id, url: photo.public_derivative_url,
        storagePath: derivativeStoragePath(sessionId, photo.id, photo.content_hash), reused: true,
      });
      continue;
    }
    results.push(await buildDerivative(client, sessionId, photo));
  }
  return results;
}
```

- [ ] **Step 5: Run the tests** — `./scripts/content-engine/reset-test-db.sh && npm run test:integration -- derivatives` → all 5 PASS. Then `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/derivatives.ts tests/integration/derivatives.test.ts tests/integration/helpers.ts
git commit -m "feat: content-addressed public derivatives for approved items"
```

---

### Task 2: Publish flow — path map + `publishApprovedItem` (spec §9.1)

**Files:**
- Create: `lib/contentEngine/publishRevalidation.ts`
- Create: `lib/contentEngine/publishItem.ts`
- Create: `tests/unit/publishRevalidation.test.ts`
- Create: `tests/integration/publish-item.test.ts`

- [ ] **Step 1: Write the failing unit test** (`tests/unit/publishRevalidation.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";

describe("pathsForPublishedItem (spec §9.1 Step C map)", () => {
  it("journal → blog index + post page", () => {
    expect(pathsForPublishedItem("journal_post", { slug: "golden-hour-sjsu" }))
      .toEqual(["/blog", "/blog/golden-hour-sjsu"]);
  });
  it("portfolio → /portfolio, plus / when featured", () => {
    expect(pathsForPublishedItem("portfolio_pick", { featured: false })).toEqual(["/portfolio"]);
    expect(pathsForPublishedItem("portfolio_pick", { featured: true })).toEqual(["/portfolio", "/"]);
  });
  it("school → its grads page", () => {
    expect(pathsForPublishedItem("school_page_photo", { school_slug: "sjsu" })).toEqual(["/grads/sjsu"]);
  });
  it("guide → its guide location page", () => {
    expect(pathsForPublishedItem("guide_photo", { guide: "family", location_key: "crissy-field" }))
      .toEqual(["/family-guide/locations/crissy-field"]);
    expect(pathsForPublishedItem("guide_photo", { guide: "couples", location_key: "ocean-beach" }))
      .toEqual(["/couples-guide/locations/ocean-beach"]);
  });
  it("photo-less types revalidate nothing", () => {
    expect(pathsForPublishedItem("testimonial_feature", {})).toEqual([]);
    expect(pathsForPublishedItem("internal_link_suggestion", {})).toEqual([]);
    expect(pathsForPublishedItem("unknown_type", {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- publishRevalidation` → FAIL.

- [ ] **Step 3: Write the path map** (`lib/contentEngine/publishRevalidation.ts`)

```ts
// Targeted revalidation map (spec §9.1 Step C): published content invalidates
// exactly the routes it appears on. Hourly ISR is the backstop; Step-C
// failures are recoverable tasks, never a reason to unpublish.
export function pathsForPublishedItem(contentType: string, payload: Record<string, unknown>): string[] {
  switch (contentType) {
    case "journal_post":
      return ["/blog", `/blog/${payload.slug as string}`];
    case "portfolio_pick":
      return payload.featured === true ? ["/portfolio", "/"] : ["/portfolio"];
    case "school_page_photo":
      return [`/grads/${payload.school_slug as string}`];
    case "guide_photo": {
      const hub = payload.guide === "family" ? "family-guide" : "couples-guide";
      return [`/${hub}/locations/${payload.location_key as string}`];
    }
    default:
      return [];
  }
}
```

- [ ] **Step 4: Write the failing integration test** (`tests/integration/publish-item.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, createPackage, createItem, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { PUBLIC_DERIVATIVES_BUCKET } from "@/lib/contentEngine/derivatives";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
});

async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 500 + seed * 2, height: 320, channels: 3, background: { r: (seed * 53) % 255, g: 70, b: 110 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  const row = await finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `p${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
  await service.from("session_photos").update({ alt_text: `Alt ${seed}`, analysis_status: "completed" }).eq("id", row.id);
  return row;
}

function trackingRevalidate() {
  const calls: string[] = [];
  return { calls, fn: (path: string) => { calls.push(path); } };
}

describe("publishApprovedItem (spec §9.1 A→B→C)", () => {
  it("publishes a journal end-to-end: derivative + blog row + library rows + targeted revalidation", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 1);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `publish-flow-${Date.now()}`;
    const item = await createItem(pkg, "journal_post", {
      title: "Publish Flow", slug, body: "Body.", meta_description: "d", meta_keywords: "k",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");

    const tracker = trackingRevalidate();
    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: tracker.fn });

    expect(outcome.status).toBe("published");
    if (outcome.status !== "published") throw new Error("unreachable");
    expect(outcome.targetType).toBe("blog_post");
    expect(tracker.calls).toEqual(["/blog", `/blog/${slug}`]);
    expect(outcome.revalidationFailures).toEqual([]);

    const { data: post } = await service.from("blog_posts")
      .select("id,cover_image_url").eq("slug", slug).single();
    expect(post!.cover_image_url).toContain(`engine/${sessionId}/${photo.id}/`); // derivative, not original
    const { data: row } = await service.from("session_content_items")
      .select("status,published_target_type").eq("id", item).single();
    expect(row!.status).toBe("published");
  });

  it("Step-C failure is recoverable: item STAYS published, failures reported", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 2);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    await service.from("portfolio_categories").upsert({ slug: "grads", name: "grads" }, { onConflict: "slug" });
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "T", alt_text: "A", description: "", featured: false,
    }, "approved");

    const outcome = await publishApprovedItem({
      client: service, itemId: item,
      revalidate: () => { throw new Error("revalidation backend down"); },
    });
    expect(outcome.status).toBe("published");
    if (outcome.status !== "published") throw new Error("unreachable");
    expect(outcome.revalidationFailures).toEqual(["/portfolio"]);
    const { data: row } = await service.from("session_content_items").select("status").eq("id", item).single();
    expect(row!.status).toBe("published"); // never flipped back (spec §9.1 Step C)
  });

  it("guard rejections are 'blocked' and leave the item untouched", async () => {
    const sessionId = await createTestSession({ marketing_permission: false });
    const photo = await realPhoto(sessionId, 3);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    }, "approved");

    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: () => {} });
    expect(outcome.status).toBe("blocked");
    const { data: row } = await service.from("session_content_items").select("status,error").eq("id", item).single();
    expect(row!.status).toBe("approved");
    expect(row!.error).toBeNull();
  });

  it("a genuine Step-B failure records status=failed with the error (draft preserved)", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 4);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `conflict-${Date.now()}`;
    await service.from("blog_posts").insert({
      title: "Existing", body: "x", slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    });
    const item = await createItem(pkg, "journal_post", {
      title: "Conflict", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");

    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: () => {} });
    expect(outcome.status).toBe("failed");
    const { data: row } = await service.from("session_content_items").select("status,error").eq("id", item).single();
    expect(row!.status).toBe("failed");
    expect(row!.error).toMatch(/slug/i);
  });
});
```

- [ ] **Step 5: Run to verify failure** — `npm run test:integration -- publish-item` → FAIL (module missing).

- [ ] **Step 6: Write the service** (`lib/contentEngine/publishItem.ts`)

```ts
// The three-step publish flow (spec §9.1). Step A builds derivatives
// (idempotent, content-addressed). Step B is the transactional RPC. Step C is
// targeted revalidation; its failures are RECOVERABLE — they never unpublish.
// Guard rejections (preconditions) are 'blocked' and leave the item untouched;
// genuine Step-B failures record status='failed' with a capped error.
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareApprovedDerivatives, DerivativeError } from "@/lib/contentEngine/derivatives";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";

export type PublishOutcome =
  | { status: "published"; targetType: string; targetId: string | null;
      revalidated: string[]; revalidationFailures: string[] }
  | { status: "blocked"; reason: string }
  | { status: "failed"; error: string };

const GUARD_PATTERN = /not approved|already published|marketing permission|archived package|claimed by another/i;

export interface PublishArgs {
  client: SupabaseClient;
  itemId: string;
  revalidate: (path: string) => void;
}

export async function publishApprovedItem(args: PublishArgs): Promise<PublishOutcome> {
  const { client, itemId, revalidate } = args;

  // Step A — derivatives (item left approved on failure; retryable)
  try {
    await prepareApprovedDerivatives({ client, itemId });
  } catch (err) {
    if (err instanceof DerivativeError) {
      if (err.kind === "not_approved" || err.kind === "permission" || err.kind === "not_found") {
        return { status: "blocked", reason: err.message };
      }
      return { status: "failed", error: err.message };
    }
    throw err;
  }

  // Step B — transactional live write via the RPC
  const { data, error } = await client.rpc("publish_session_content_item", { p_item_id: itemId });
  if (error) {
    if (GUARD_PATTERN.test(error.message)) {
      return { status: "blocked", reason: error.message };
    }
    // genuine publish failure: record failed, preserve the draft (spec §9.1)
    await client.from("session_content_items")
      .update({ status: "failed", error: error.message.slice(0, 2000) })
      .eq("id", itemId).eq("status", "approved");
    return { status: "failed", error: error.message };
  }
  const result = data as { item_id: string; target_type: string; target_id: string | null };

  // Step C — targeted revalidation (post-commit; failures are recoverable)
  const { data: item } = await client.from("session_content_items")
    .select("content_type,payload").eq("id", itemId).single();
  const paths = pathsForPublishedItem(item!.content_type, item!.payload as Record<string, unknown>);
  const revalidated: string[] = [];
  const revalidationFailures: string[] = [];
  for (const path of paths) {
    try {
      revalidate(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`revalidation failed for ${path} (recoverable; hourly ISR is the backstop)`, err);
      revalidationFailures.push(path);
    }
  }

  return {
    status: "published",
    targetType: result.target_type,
    targetId: result.target_id,
    revalidated,
    revalidationFailures,
  };
}
```

- [ ] **Step 7: Run the tests** — `npm test -- publishRevalidation && npm run test:integration -- publish-item` → all PASS; `npx tsc --noEmit` clean.

- [ ] **Step 8: Commit**

```bash
git add lib/contentEngine/publishRevalidation.ts lib/contentEngine/publishItem.ts tests/unit/publishRevalidation.test.ts tests/integration/publish-item.test.ts
git commit -m "feat: three-step publish flow with recoverable targeted revalidation"
```

---

### Task 3: Shared-derivative refs + takedown + publish/takedown routes (spec §7.3, §4.3)

**Files:**
- Create: `lib/contentEngine/derivativeRefs.ts`
- Create: `lib/contentEngine/takedown.ts`
- Create: `app/api/admin/session-content/publish/route.ts`
- Create: `app/api/admin/session-content/takedown/route.ts`
- Create: `tests/integration/takedown.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/integration/takedown.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, createPackage, createItem, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { PUBLIC_DERIVATIVES_BUCKET } from "@/lib/contentEngine/derivatives";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { takedownPublishedItem } from "@/lib/contentEngine/takedown";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
  await service.from("portfolio_categories").upsert({ slug: "grads", name: "grads" }, { onConflict: "slug" });
});

async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 600 + seed * 2, height: 360, channels: 3, background: { r: (seed * 71) % 255, g: 50, b: 140 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  const row = await finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `t${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
  await service.from("session_photos").update({ alt_text: `Alt ${seed}`, analysis_status: "completed" }).eq("id", row.id);
  return row;
}

async function publishItemOfType(sessionId: string, contentType: string, payload: Record<string, unknown>, selected: string) {
  const pkg = await createPackage(sessionId, [selected], undefined, true); // archive prior package per session
  const item = await createItem(pkg, contentType, payload, "approved");
  const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: () => {} });
  expect(outcome.status).toBe("published");
  return item;
}

async function derivativeExists(storagePath: string) {
  const { data } = await service.storage.from(PUBLIC_DERIVATIVES_BUCKET).download(storagePath);
  return data !== null;
}

describe("takedownPublishedItem (spec §7.3 + §4.3 shared-derivative rule)", () => {
  it("journal takedown deletes the post + its image_library rows and the now-unreferenced derivative", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 1);
    const slug = `takedown-journal-${Date.now()}`;
    const item = await publishItemOfType(sessionId, "journal_post", {
      title: "T", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "journal_post");

    const result = await takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} });
    expect(result.removed).toBe(true);

    const { count: posts } = await service.from("blog_posts")
      .select("id", { count: "exact", head: true }).eq("slug", slug);
    expect(posts).toBe(0);
    const { data: photoRow } = await service.from("session_photos")
      .select("public_derivative_url,public_derivative_storage_path").eq("id", photo.id).single();
    expect(photoRow!.public_derivative_url).toBeNull(); // unreferenced derivative removed

    const { data: itemRow } = await service.from("session_content_items")
      .select("status,published_ref").eq("id", item).single();
    expect(itemRow!.status).toBe("published"); // history preserved
    expect(itemRow!.published_ref.taken_down_at).toBeTruthy();
  });

  it("shared derivative survives when another live placement still references the photo", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 2);

    // publish the SAME photo to portfolio AND a school page
    const portfolioItem = await publishItemOfType(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "P", alt_text: "A", description: "", featured: false,
    }, "portfolio_pick");
    await publishItemOfType(sessionId, "school_page_photo", {
      session_photo_id: photo.id, school_slug: "sjsu", alt_override: "", caption: "", sort_order: 0,
    }, "school_page_photo");

    const { data: before } = await service.from("session_photos")
      .select("public_derivative_storage_path").eq("id", photo.id).single();

    // take down only the portfolio placement
    const result = await takedownPublishedItem({ client: service, itemId: portfolioItem, revalidate: () => {} });
    expect(result.removed).toBe(true);
    expect(result.derivativesDeleted).toEqual([]); // school placement still references it

    expect(await derivativeExists(before!.public_derivative_storage_path)).toBe(true);
    const { data: photoRow } = await service.from("session_photos")
      .select("public_derivative_url").eq("id", photo.id).single();
    expect(photoRow!.public_derivative_url).not.toBeNull();
  });

  it("school takedown deactivates (active=false) instead of deleting", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 3);
    const item = await publishItemOfType(sessionId, "school_page_photo", {
      session_photo_id: photo.id, school_slug: "sjsu", alt_override: "", caption: "", sort_order: 0,
    }, "school_page_photo");

    await takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} });
    const { data: rows } = await service.from("school_page_photos")
      .select("active").eq("session_photo_id", photo.id);
    expect(rows!.every((r) => r.active === false)).toBe(true);
    expect(rows!.length).toBeGreaterThan(0); // row preserved, deactivated
  });

  it("testimonial takedown unlinks without touching the testimonial row", async () => {
    const sessionId = await createTestSession();
    const { data: t } = await service.from("testimonials").insert({
      first_name: "Mia", last_name: "R", message: "An absolutely wonderful experience all around!",
      consent_to_marketing: true, status: "approved",
    }).select("id").single();
    const item = await publishItemOfType(sessionId, "testimonial_feature",
      { testimonial_id: t!.id, quote_excerpt: "wonderful" }, "testimonial_feature");

    await takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} });
    const { data: after } = await service.from("testimonials")
      .select("photography_session_id,message").eq("id", t!.id).single();
    expect(after!.photography_session_id).toBeNull();
    expect(after!.message).toContain("wonderful");
  });

  it("refuses items that are not published", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "draft");
    await expect(takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} }))
      .rejects.toThrow(/not published/i);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- takedown` → FAIL.

- [ ] **Step 3: Write the reference counter** (`lib/contentEngine/derivativeRefs.ts`)

```ts
// Shared-derivative protection (spec §4.3): before deleting a derivative,
// count references across ALL supported live tables; delete only when no
// active placement remains. Also powers the orphaned-derivative report (§9.4).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DerivativePhoto {
  id: string;
  public_derivative_url: string | null;
}

export interface ReferenceCounts {
  blogCover: number;
  blogExtra: number;
  portfolio: number;
  schoolActive: number;
  familyGuide: number;
  couplesGuide: number;
  total: number;
}

export async function countLiveReferences(client: SupabaseClient, photo: DerivativePhoto): Promise<ReferenceCounts> {
  const url = photo.public_derivative_url;
  const zero: ReferenceCounts = {
    blogCover: 0, blogExtra: 0, portfolio: 0, schoolActive: 0, familyGuide: 0, couplesGuide: 0, total: 0,
  };
  if (!url) return zero;

  const [blogCover, blogExtra, portfolio, school, family, couples] = await Promise.all([
    client.from("blog_posts").select("id", { count: "exact", head: true }).eq("cover_image_url", url),
    client.from("blog_posts").select("id", { count: "exact", head: true }).contains("extra_image_urls", [url]),
    client.from("portfolio_images").select("id", { count: "exact", head: true }).eq("image_url", url),
    client.from("school_page_photos").select("id", { count: "exact", head: true })
      .eq("session_photo_id", photo.id).eq("active", true),
    client.from("family_location_photos").select("id", { count: "exact", head: true })
      .eq("image_url", url).eq("published", true),
    client.from("couples_location_photos").select("id", { count: "exact", head: true })
      .eq("image_url", url).eq("published", true),
  ]);

  const counts: ReferenceCounts = {
    blogCover: blogCover.count ?? 0,
    blogExtra: blogExtra.count ?? 0,
    portfolio: portfolio.count ?? 0,
    schoolActive: school.count ?? 0,
    familyGuide: family.count ?? 0,
    couplesGuide: couples.count ?? 0,
    total: 0,
  };
  counts.total = counts.blogCover + counts.blogExtra + counts.portfolio
    + counts.schoolActive + counts.familyGuide + counts.couplesGuide;
  return counts;
}
```

- [ ] **Step 4: Write the takedown service** (`lib/contentEngine/takedown.ts`)

```ts
// Takedown of one published item (spec §7.3): removes or deactivates the live
// record, preserves publication history (item stays 'published' with
// published_ref.taken_down_at), deletes derivatives only per the
// shared-derivative rule (§4.3), and revalidates affected routes. Private
// sources are never touched.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_DERIVATIVES_BUCKET, photoIdsFromPayload } from "@/lib/contentEngine/derivatives";
import { countLiveReferences } from "@/lib/contentEngine/derivativeRefs";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";

export class TakedownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TakedownError";
  }
}

export interface TakedownArgs {
  client: SupabaseClient;
  itemId: string;
  revalidate: (path: string) => void;
}

export interface TakedownResult {
  removed: boolean;
  derivativesDeleted: string[];
  revalidated: string[];
}

async function removeLiveRecord(client: SupabaseClient, targetType: string, targetId: string | null) {
  if (!targetId && targetType !== "none") throw new TakedownError("published target id missing");
  switch (targetType) {
    case "blog_post": {
      const id = Number(targetId);
      await client.from("image_library").delete().eq("source_post_id", id);
      await client.from("blog_posts").delete().eq("id", id);
      return;
    }
    case "portfolio_image":
      await client.from("portfolio_images").delete().eq("id", Number(targetId));
      return;
    case "school_page_photo":
      await client.from("school_page_photos").update({ active: false }).eq("id", targetId);
      return;
    case "family_location_photo":
      await client.from("family_location_photos").update({ published: false }).eq("id", Number(targetId));
      return;
    case "couples_location_photo":
      await client.from("couples_location_photos").update({ published: false }).eq("id", Number(targetId));
      return;
    case "testimonial":
      await client.from("testimonials").update({ photography_session_id: null }).eq("id", targetId);
      return;
    case "none":
      return; // nothing live to remove
    default:
      throw new TakedownError(`unsupported published target type: ${targetType}`);
  }
}

export async function takedownPublishedItem(args: TakedownArgs): Promise<TakedownResult> {
  const { client, itemId, revalidate } = args;

  const { data: item, error } = await client.from("session_content_items")
    .select("id,content_type,status,payload,published_target_type,published_target_id,published_ref")
    .eq("id", itemId).maybeSingle();
  if (error || !item) throw new TakedownError(`content item not found: ${error?.message ?? itemId}`);
  if (item.status !== "published") throw new TakedownError(`item is not published (status=${item.status})`);
  if ((item.published_ref as Record<string, unknown> | null)?.taken_down_at) {
    throw new TakedownError("item is already taken down");
  }

  await removeLiveRecord(client, item.published_target_type as string, item.published_target_id as string | null);

  // shared-derivative rule (§4.3): delete only when zero live references remain
  const photoIds = photoIdsFromPayload(item.content_type, item.payload as Record<string, unknown>);
  const derivativesDeleted: string[] = [];
  if (photoIds.length > 0) {
    const { data: photos } = await client.from("session_photos")
      .select("id,public_derivative_url,public_derivative_storage_path").in("id", photoIds);
    for (const photo of photos ?? []) {
      if (!photo.public_derivative_url) continue;
      const refs = await countLiveReferences(client, photo);
      if (refs.total === 0) {
        const { error: rmErr } = await client.storage.from(PUBLIC_DERIVATIVES_BUCKET)
          .remove([photo.public_derivative_storage_path as string]);
        if (rmErr) console.error(`derivative removal failed for ${photo.id}:`, rmErr.message);
        await client.from("session_photos").update({
          public_derivative_url: null,
          public_derivative_storage_path: null,
          public_derivative_content_hash: null,
          public_derivative_created_at: null,
        }).eq("id", photo.id);
        derivativesDeleted.push(photo.id);
      }
    }
  }

  // preserve history: stays 'published', marked taken down
  const ref = { ...((item.published_ref as Record<string, unknown>) ?? {}), taken_down_at: new Date().toISOString() };
  await client.from("session_content_items").update({ published_ref: ref }).eq("id", itemId);

  const paths = pathsForPublishedItem(item.content_type, item.payload as Record<string, unknown>);
  const revalidated: string[] = [];
  for (const path of paths) {
    try {
      revalidate(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`takedown revalidation failed for ${path}`, err);
    }
  }

  return { removed: true, derivativesDeleted, revalidated };
}
```

- [ ] **Step 5: Write the publish route** (`app/api/admin/session-content/publish/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { itemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });

  try {
    const outcome = await publishApprovedItem({
      client: createSupabaseAdminClient(),
      itemId,
      revalidate: (path) => revalidatePath(path),
    });
    if (outcome.status === "blocked") return NextResponse.json({ error: outcome.reason }, { status: 409 });
    if (outcome.status === "failed") return NextResponse.json({ error: outcome.error }, { status: 422 });
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("publish failed unexpectedly", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write the takedown route** (`app/api/admin/session-content/takedown/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { takedownPublishedItem, TakedownError } from "@/lib/contentEngine/takedown";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { itemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });

  try {
    const result = await takedownPublishedItem({
      client: createSupabaseAdminClient(),
      itemId,
      revalidate: (path) => revalidatePath(path),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TakedownError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("takedown failed unexpectedly", err);
    return NextResponse.json({ error: "takedown failed" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Run the tests** — `npm run test:integration -- takedown` → all 5 PASS; full `npm run test:integration` green; `npx tsc --noEmit` clean; `npx eslint app/api/admin/session-content lib/contentEngine` clean.

- [ ] **Step 8: Commit**

```bash
git add lib/contentEngine/derivativeRefs.ts lib/contentEngine/takedown.ts app/api/admin/session-content/publish/route.ts app/api/admin/session-content/takedown/route.ts tests/integration/takedown.test.ts
git commit -m "feat: takedown with shared-derivative rule plus publish and takedown routes"
```

---

### Task 4: Items API — autosave with optimistic concurrency + status transitions (spec §7.4)

**Files:**
- Create: `app/api/admin/session-content/items/[id]/route.ts`
- Create: `app/api/admin/session-content/items/[id]/status/route.ts`
- Create: `tests/integration/items-api.test.ts`

The autosave/status logic lives in the route handlers (thin, no service indirection needed) but the tests exercise the same DB semantics through direct queries plus tiny local helpers replicating the route's core statements — EXCEPT the two pieces with real logic, which live in the routes and are tested through exported pure helpers. To keep this testable without HTTP, extract the two state machines into `lib/contentEngine/itemTransitions.ts`.

- Also Create: `lib/contentEngine/itemTransitions.ts`

- [ ] **Step 1: Write the failing test** (`tests/integration/items-api.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem } from "./helpers";
import { applyAutosave, applyStatusAction } from "@/lib/contentEngine/itemTransitions";

beforeAll(() => resetDb());

const LINKS = { links: [{ url: "/pricing", label: "Pricing", reason: "r" }] };
const LINKS2 = { links: [{ url: "/grads/sjsu", label: "SJSU", reason: "r2" }] };

describe("applyAutosave (payload_revision optimistic concurrency, spec §7.4)", () => {
  it("saves with the matching revision and bumps it", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "draft");

    const result = await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    expect(result.outcome).toBe("saved");
    if (result.outcome !== "saved") throw new Error("unreachable");
    expect(result.payloadRevision).toBe(2);

    const { data: row } = await service.from("session_content_items")
      .select("payload,payload_revision").eq("id", item).single();
    expect(row!.payload_revision).toBe(2);
    expect(row!.payload.links[0].url).toBe("/grads/sjsu");
  });

  it("a stale revision conflicts (409 semantics) and returns the server copy", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "draft");

    await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    const stale = await applyAutosave({ client: service, itemId: item, payload: LINKS, expectedRevision: 1 });
    expect(stale.outcome).toBe("conflict");
    if (stale.outcome !== "conflict") throw new Error("unreachable");
    expect(stale.server.payload_revision).toBe(2);
    expect(stale.server.payload.links[0].url).toBe("/grads/sjsu");
  });

  it("rejects an invalid payload (Zod, closed lists) without writing", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "draft");

    const bad = await applyAutosave({
      client: service, itemId: item,
      payload: { links: [{ url: "/nope", label: "x", reason: "y" }] }, expectedRevision: 1,
    });
    expect(bad.outcome).toBe("invalid");
    const { data: row } = await service.from("session_content_items")
      .select("payload_revision").eq("id", item).single();
    expect(row!.payload_revision).toBe(1);
  });

  it("editing an APPROVED item reverts it to draft (re-review required)", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "approved");

    const result = await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    expect(result.outcome).toBe("saved");
    const { data: row } = await service.from("session_content_items")
      .select("status,approved_at").eq("id", item).single();
    expect(row!.status).toBe("draft");
    expect(row!.approved_at).toBeNull();
  });

  it("refuses to edit published or publishing items", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "approved");
    await service.from("session_content_items")
      .update({ status: "published", published_target_type: "none", published_at: new Date().toISOString() })
      .eq("id", item);
    const result = await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    expect(result.outcome).toBe("not_editable");
  });
});

describe("applyStatusAction (approve / reject / unreject)", () => {
  async function freshItem(status: "draft" | "approved" = "draft") {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    return createItem(pkg, "internal_link_suggestion", LINKS, status);
  }

  it("approves a draft (stamps approved_at/by) and a failed item (clears error)", async () => {
    const item = await freshItem("draft");
    const ok = await applyStatusAction({ client: service, itemId: item, action: "approve" });
    expect(ok.outcome).toBe("done");
    const { data: row } = await service.from("session_content_items")
      .select("status,approved_at,approved_by").eq("id", item).single();
    expect(row!.status).toBe("approved");
    expect(row!.approved_at).not.toBeNull();
    expect(row!.approved_by).toBe("admin");

    const failed = await freshItem("draft");
    await service.from("session_content_items").update({ status: "failed", error: "boom" }).eq("id", failed);
    await applyStatusAction({ client: service, itemId: failed, action: "approve" });
    const { data: row2 } = await service.from("session_content_items")
      .select("status,error").eq("id", failed).single();
    expect(row2!.status).toBe("approved");
    expect(row2!.error).toBeNull();
  });

  it("rejects with an optional reason; unreject returns to draft", async () => {
    const item = await freshItem("approved");
    await applyStatusAction({ client: service, itemId: item, action: "reject", reason: "off-brand" });
    const { data: row } = await service.from("session_content_items")
      .select("status,rejected_at,rejection_reason,approved_at").eq("id", item).single();
    expect(row!.status).toBe("rejected");
    expect(row!.rejection_reason).toBe("off-brand");
    expect(row!.approved_at).toBeNull();

    await applyStatusAction({ client: service, itemId: item, action: "unreject" });
    const { data: row2 } = await service.from("session_content_items")
      .select("status,rejected_at,rejection_reason").eq("id", item).single();
    expect(row2!.status).toBe("draft");
    expect(row2!.rejected_at).toBeNull();
  });

  it("forbids transitions on published/publishing items and unknown actions", async () => {
    const item = await freshItem("approved");
    await service.from("session_content_items")
      .update({ status: "published", published_target_type: "none", published_at: new Date().toISOString() })
      .eq("id", item);
    const blocked = await applyStatusAction({ client: service, itemId: item, action: "reject" });
    expect(blocked.outcome).toBe("forbidden");

    const item2 = await freshItem("draft");
    const unknown = await applyStatusAction({ client: service, itemId: item2, action: "explode" as never });
    expect(unknown.outcome).toBe("forbidden");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- items-api` → FAIL.

- [ ] **Step 3: Write the transitions module** (`lib/contentEngine/itemTransitions.ts`)

```ts
// Item editing + review-state machines (spec §7.4). Autosave uses
// payload_revision optimistic concurrency: a stale revision returns the server
// copy for the editor's comparison prompt. Editing an approved item reverts it
// to draft — approval reviews specific content, so changed content needs
// re-review. Published/publishing items are immutable here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePayload } from "@/lib/contentEngine/payloads";

const EDITABLE_STATUSES = ["draft", "approved", "failed"] as const;

export interface AutosaveArgs {
  client: SupabaseClient;
  itemId: string;
  payload: unknown;
  expectedRevision: number;
}

export type AutosaveResult =
  | { outcome: "saved"; payloadRevision: number; statusReset: boolean }
  | { outcome: "conflict"; server: { payload: Record<string, unknown>; payload_revision: number; status: string } }
  | { outcome: "invalid"; message: string }
  | { outcome: "not_found" }
  | { outcome: "not_editable"; status: string };

export async function applyAutosave(args: AutosaveArgs): Promise<AutosaveResult> {
  const { client, itemId, payload, expectedRevision } = args;

  const { data: item } = await client.from("session_content_items")
    .select("id,content_type,status,payload,payload_revision").eq("id", itemId).maybeSingle();
  if (!item) return { outcome: "not_found" };
  if (!(EDITABLE_STATUSES as readonly string[]).includes(item.status)) {
    return { outcome: "not_editable", status: item.status };
  }

  const validated = validatePayload(item.content_type, payload);
  if (!validated.success) {
    return { outcome: "invalid", message: validated.error.message };
  }

  const statusReset = item.status === "approved";
  const { data: updated, error } = await client.from("session_content_items")
    .update({
      payload: validated.data,
      payload_revision: expectedRevision + 1,
      ...(statusReset ? { status: "draft", approved_at: null, approved_by: null } : {}),
    })
    .eq("id", itemId)
    .eq("payload_revision", expectedRevision)
    .select("payload_revision");
  if (error) throw new Error(`autosave failed: ${error.message}`);

  if (!updated || updated.length === 0) {
    const { data: server } = await client.from("session_content_items")
      .select("payload,payload_revision,status").eq("id", itemId).single();
    return { outcome: "conflict", server: server as AutosaveResult extends never ? never : { payload: Record<string, unknown>; payload_revision: number; status: string } };
  }
  return { outcome: "saved", payloadRevision: updated[0].payload_revision as number, statusReset };
}

export type StatusAction = "approve" | "reject" | "unreject";

export interface StatusActionArgs {
  client: SupabaseClient;
  itemId: string;
  action: StatusAction;
  reason?: string | null;
}

export type StatusActionResult =
  | { outcome: "done"; status: string }
  | { outcome: "forbidden"; message: string }
  | { outcome: "not_found" };

const ALLOWED_FROM: Record<StatusAction, string[]> = {
  approve: ["draft", "failed"],
  reject: ["draft", "approved", "failed"],
  unreject: ["rejected"],
};

export async function applyStatusAction(args: StatusActionArgs): Promise<StatusActionResult> {
  const { client, itemId, action, reason } = args;
  const allowed = ALLOWED_FROM[action];
  if (!allowed) return { outcome: "forbidden", message: `unknown action ${String(action)}` };

  const { data: item } = await client.from("session_content_items")
    .select("id,status").eq("id", itemId).maybeSingle();
  if (!item) return { outcome: "not_found" };
  if (!allowed.includes(item.status)) {
    return { outcome: "forbidden", message: `cannot ${action} from status ${item.status}` };
  }

  const now = new Date().toISOString();
  const patch =
    action === "approve"
      ? { status: "approved", approved_at: now, approved_by: "admin", error: null,
          rejected_at: null, rejection_reason: null }
      : action === "reject"
        ? { status: "rejected", rejected_at: now, rejection_reason: reason?.slice(0, 1000) ?? null,
            approved_at: null, approved_by: null }
        : { status: "draft", rejected_at: null, rejection_reason: null };

  const { error } = await client.from("session_content_items")
    .update(patch).eq("id", itemId).eq("status", item.status);
  if (error) throw new Error(`status action failed: ${error.message}`);
  return { outcome: "done", status: patch.status };
}
```

NOTE: if the `conflict` branch's inline conditional type annotation fights tsc, simplify it to a named interface — behavior is what matters: `server` carries `payload`, `payload_revision`, `status`.

- [ ] **Step 4: Write the autosave route** (`app/api/admin/session-content/items/[id]/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applyAutosave } from "@/lib/contentEngine/itemTransitions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "item id must be a uuid" }, { status: 400 });

  let body: { payload?: unknown; payloadRevision?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const expectedRevision = typeof body.payloadRevision === "number" ? body.payloadRevision : -1;
  if (expectedRevision < 1) {
    return NextResponse.json({ error: "payloadRevision must be a positive integer" }, { status: 400 });
  }

  const result = await applyAutosave({
    client: createSupabaseAdminClient(),
    itemId: id.toLowerCase(),
    payload: body.payload,
    expectedRevision,
  });
  switch (result.outcome) {
    case "saved": return NextResponse.json(result);
    case "conflict": return NextResponse.json(result, { status: 409 });
    case "invalid": return NextResponse.json({ error: result.message }, { status: 422 });
    case "not_editable": return NextResponse.json({ error: `item is ${result.status}` }, { status: 409 });
    case "not_found": return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
}
```

- [ ] **Step 5: Write the status route** (`app/api/admin/session-content/items/[id]/status/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applyStatusAction, type StatusAction } from "@/lib/contentEngine/itemTransitions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: StatusAction[] = ["approve", "reject", "unreject"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "item id must be a uuid" }, { status: 400 });

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? (body.action as StatusAction) : ("" as StatusAction);
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
  }

  const result = await applyStatusAction({
    client: createSupabaseAdminClient(),
    itemId: id.toLowerCase(),
    action,
    reason: typeof body.reason === "string" ? body.reason : null,
  });
  switch (result.outcome) {
    case "done": return NextResponse.json(result);
    case "forbidden": return NextResponse.json({ error: result.message }, { status: 409 });
    case "not_found": return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
}
```

- [ ] **Step 6: Run the tests** — `npm run test:integration -- items-api` → all PASS; `npx tsc --noEmit` + scoped eslint clean.

- [ ] **Step 7: Commit**

```bash
git add lib/contentEngine/itemTransitions.ts app/api/admin/session-content/items tests/integration/items-api.test.ts
git commit -m "feat: item autosave with optimistic concurrency and review transitions"
```

---

### Task 5: Prefill + session state assembly + sessions API (spec §7.1, §7.2, §6)

**Files:**
- Create: `lib/contentEngine/prefill.ts`
- Create: `lib/contentEngine/sessionState.ts`
- Create: `app/api/admin/session-content/sessions/route.ts`
- Create: `app/api/admin/session-content/sessions/[id]/route.ts`
- Create: `tests/unit/prefill.test.ts`
- Create: `tests/integration/sessions-api.test.ts`

- [ ] **Step 1: Write the failing unit test** (`tests/unit/prefill.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { sessionTypeToServiceType, firstNameOf } from "@/lib/contentEngine/prefill";

describe("prefill mapping (spec §7.2)", () => {
  it("maps free-text session types onto the taxonomy", () => {
    expect(sessionTypeToServiceType("Graduation Session")).toBe("grads");
    expect(sessionTypeToServiceType("grad photos")).toBe("grads");
    expect(sessionTypeToServiceType("Couples Golden Hour")).toBe("couples");
    expect(sessionTypeToServiceType("engagement")).toBe("couples");
    expect(sessionTypeToServiceType("Family mini")).toBe("families");
    expect(sessionTypeToServiceType("Maternity")).toBe("maternity");
    expect(sessionTypeToServiceType("Senior portraits")).toBe("portraits");
    expect(sessionTypeToServiceType("Corporate event")).toBe("events");
    expect(sessionTypeToServiceType("something else")).toBe("other");
    expect(sessionTypeToServiceType(null)).toBe("other");
  });

  it("extracts a public-safe first name", () => {
    expect(firstNameOf("Mia Rodriguez")).toBe("Mia");
    expect(firstNameOf("  leo  ")).toBe("Leo");
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf("")).toBeNull();
  });
});
```

- [ ] **Step 2: Write the prefill module** (`lib/contentEngine/prefill.ts`)

```ts
// Prefill helpers for creating a photography_session from a client session
// (spec §7.2). public_display_name defaults to FIRST NAME ONLY; the internal
// name stays internal. service_type mapping is taxonomy-safe (never invalid).
import type { ServiceType } from "@/lib/contentEngine/taxonomy";

const TYPE_PATTERNS: [RegExp, ServiceType][] = [
  [/grad/i, "grads"],
  [/couple|engagement/i, "couples"],
  [/family|families/i, "families"],
  [/maternity/i, "maternity"],
  [/portrait|senior/i, "portraits"],
  [/event/i, "events"],
];

export function sessionTypeToServiceType(sessionType: string | null | undefined): ServiceType {
  if (!sessionType) return "other";
  for (const [pattern, service] of TYPE_PATTERNS) {
    if (pattern.test(sessionType)) return service;
  }
  return "other";
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0] ?? "";
  if (!first) return null;
  return first[0].toUpperCase() + first.slice(1);
}
```

- [ ] **Step 3: Write the state assembler** (`lib/contentEngine/sessionState.ts`)

```ts
// Loads the rows deriveSessionEngineState needs (spec §6 consumer) and derives
// the state for one or many sessions. ONLY active-package items are passed in.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveSessionEngineState, type SessionEngineState,
  type PhotoState, type PackageState, type ItemState,
} from "@/lib/contentEngine/state";

export interface SessionStateBundle {
  state: SessionEngineState;
  photoCount: number;
  itemCounts: Record<string, number>;
  activePackageId: string | null;
}

export async function assembleSessionStates(
  client: SupabaseClient, sessionIds: string[], now = new Date(),
): Promise<Map<string, SessionStateBundle>> {
  const result = new Map<string, SessionStateBundle>();
  if (sessionIds.length === 0) return result;

  const [{ data: photos }, { data: packages }] = await Promise.all([
    client.from("session_photos")
      .select("photography_session_id,excluded,analysis_status,analysis_lease_expires_at")
      .in("photography_session_id", sessionIds),
    client.from("session_content_packages")
      .select("id,photography_session_id,status")
      .in("photography_session_id", sessionIds)
      .is("archived_at", null),
  ]);

  const pkgIds = (packages ?? []).map((p) => p.id as string);
  const { data: items } = pkgIds.length
    ? await client.from("session_content_items")
        .select("package_id,status,publishing_started_at").in("package_id", pkgIds)
    : { data: [] as { package_id: string; status: string; publishing_started_at: string | null }[] };

  for (const sessionId of sessionIds) {
    const sessionPhotos = (photos ?? []).filter((p) => p.photography_session_id === sessionId);
    const activePackage = (packages ?? []).find((p) => p.photography_session_id === sessionId) ?? null;
    const activeItems = activePackage
      ? (items ?? []).filter((i) => i.package_id === activePackage.id)
      : [];

    const state = deriveSessionEngineState({
      photos: sessionPhotos.map((p): PhotoState => ({
        excluded: p.excluded as boolean,
        analysis_status: p.analysis_status as PhotoState["analysis_status"],
        analysis_lease_expires_at: p.analysis_lease_expires_at as string | null,
      })),
      activePackage: activePackage ? ({ status: activePackage.status } as PackageState) : null,
      activeItems: activeItems.map((i): ItemState => ({
        status: i.status as ItemState["status"],
        publishing_started_at: i.publishing_started_at as string | null,
      })),
      now,
    });

    const itemCounts: Record<string, number> = {};
    for (const i of activeItems) itemCounts[i.status] = (itemCounts[i.status] ?? 0) + 1;
    result.set(sessionId, {
      state, photoCount: sessionPhotos.length, itemCounts,
      activePackageId: (activePackage?.id as string | undefined) ?? null,
    });
  }
  return result;
}
```

- [ ] **Step 4: Write the failing integration test** (`tests/integration/sessions-api.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem } from "./helpers";
import { assembleSessionStates } from "@/lib/contentEngine/sessionState";
import { createPhotographySession, CreateSessionConflictError } from "@/lib/contentEngine/createSession";

beforeAll(() => resetDb());

describe("assembleSessionStates (spec §6 consumer)", () => {
  it("derives per-session state from real rows", async () => {
    const empty = await createTestSession();
    const analyzed = await createTestSession();
    await createTestPhoto(analyzed); // helper default: analysis_status completed
    const reviewed = await createTestSession();
    const pkg = await createPackage(reviewed, ["internal_link_suggestion"]);
    await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await createTestPhoto(reviewed);

    const states = await assembleSessionStates(service, [empty, analyzed, reviewed]);
    expect(states.get(empty)!.state).toBe("empty");
    expect(states.get(analyzed)!.state).toBe("analyzed");
    expect(states.get(reviewed)!.state).toBe("reviewed");
    expect(states.get(reviewed)!.itemCounts.approved).toBe(1);
    expect(states.get(reviewed)!.activePackageId).toBe(pkg);
  });
});

describe("createPhotographySession (spec §7.1, §7.2)", () => {
  it("creates a blank session with a valid service type", async () => {
    const created = await createPhotographySession({ client: service, input: { serviceType: "grads" } });
    expect(created.sessionId).toBeTruthy();
    const { data: row } = await service.from("photography_sessions")
      .select("service_type,marketing_permission,ai_processing_allowed").eq("id", created.sessionId).single();
    expect(row!.service_type).toBe("grads");
    expect(row!.marketing_permission).toBe(false); // never defaulted on
    expect(row!.ai_processing_allowed).toBe(false); // blank sessions need explicit confirmation
  });

  it("rejects a blank session with an invalid service type", async () => {
    await expect(createPhotographySession({ client: service, input: { serviceType: "weddings" } }))
      .rejects.toThrow(/service type/i);
  });

  it("prefills from a client session and auto-enables AI processing with basis", async () => {
    const { data: cs } = await service.from("client_sessions").insert({
      client_email: `pre-${Date.now()}@example.com`, client_name: "Mia Rodriguez",
      session_type: "Graduation Session", session_date: "2026-05-01T18:00:00Z",
      location: "SJSU Tower Lawn", current_status: "delivered",
    }).select("id").single();

    const created = await createPhotographySession({
      client: service, input: { clientSessionId: cs!.id },
    });
    const { data: row } = await service.from("photography_sessions").select("*").eq("id", created.sessionId).single();
    expect(row!.client_session_id).toBe(cs!.id);
    expect(row!.internal_client_name).toBe("Mia Rodriguez");
    expect(row!.public_display_name).toBe("Mia"); // first name only (spec §7.2)
    expect(row!.service_type).toBe("grads");
    expect(row!.primary_location).toBe("SJSU Tower Lawn");
    expect(row!.session_date).toBe("2026-05-01");
    expect(row!.ai_processing_allowed).toBe(true); // covered by contract/privacy policy (spec §3.1)
    expect(row!.ai_processing_basis).toBe("contract");
    expect(row!.ai_processing_confirmed_at).not.toBeNull();
    expect(row!.marketing_permission).toBe(false); // publication permission is NEVER auto-enabled
  });

  it("a second create for the same client session conflicts with the existing id", async () => {
    const { data: cs } = await service.from("client_sessions").insert({
      client_email: `dup-${Date.now()}@example.com`, client_name: "Leo M",
      session_type: "Family mini", current_status: "delivered",
    }).select("id").single();
    const first = await createPhotographySession({ client: service, input: { clientSessionId: cs!.id } });

    await expect(createPhotographySession({ client: service, input: { clientSessionId: cs!.id } }))
      .rejects.toMatchObject({ existingSessionId: first.sessionId });
  });
});

describe("session facts PATCH semantics (taxonomy-validated)", () => {
  it("accepts valid facts and rejects invalid slugs at the API boundary helper", async () => {
    const sessionId = await createTestSession();
    const { updateSessionFacts } = await import("@/lib/contentEngine/createSession");

    const ok = await updateSessionFacts({
      client: service, sessionId,
      facts: { school_slug: "uc-berkeley", lighting_condition: "golden_hour", primary_location: "Sather Gate" },
    });
    expect(ok.updated).toBe(true);

    await expect(updateSessionFacts({
      client: service, sessionId, facts: { school_slug: "uc-berkley" },
    })).rejects.toThrow(/school/i);
    await expect(updateSessionFacts({
      client: service, sessionId, facts: { service_type: "weddings" },
    })).rejects.toThrow(/service type/i);
  });
});
```

- [ ] **Step 5: Run to verify failure** — `npm run test:integration -- sessions-api` → FAIL (createSession missing).

- [ ] **Step 6: Write the session service** (`lib/contentEngine/createSession.ts` — add to the Files list of this task)

```ts
// Session creation + facts updates (spec §7.1, §7.2). Creation from a client
// session prefills facts, sets public_display_name to FIRST NAME ONLY, and
// auto-enables ai_processing (basis 'contract', spec §3.1) — marketing
// permission is NEVER auto-enabled. The partial unique index on
// client_session_id makes duplicates impossible; we surface the existing id.
// Facts updates reject any value outside the canonical taxonomy (spec §8.5).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isServiceType, isSchoolSlug, isLightingCondition,
} from "@/lib/contentEngine/taxonomy";
import { sessionTypeToServiceType, firstNameOf } from "@/lib/contentEngine/prefill";

export const AI_PROCESSING_POLICY_VERSION = "2026-06-06"; // matches testimonials consent_version era

export class CreateSessionConflictError extends Error {
  readonly existingSessionId: string;
  constructor(existingSessionId: string) {
    super("a photography session already exists for this client session");
    this.name = "CreateSessionConflictError";
    this.existingSessionId = existingSessionId;
  }
}

export interface CreateSessionArgs {
  client: SupabaseClient;
  input: { clientSessionId?: string; serviceType?: string };
}

export async function createPhotographySession(args: CreateSessionArgs): Promise<{ sessionId: string }> {
  const { client, input } = args;

  if (input.clientSessionId) {
    const { data: cs, error } = await client.from("client_sessions")
      .select("id,client_name,session_type,session_date,location").eq("id", input.clientSessionId).maybeSingle();
    if (error || !cs) throw new Error(`client session not found: ${error?.message ?? input.clientSessionId}`);

    const { data, error: insErr } = await client.from("photography_sessions").insert({
      client_session_id: cs.id,
      internal_client_name: cs.client_name,
      public_display_name: firstNameOf(cs.client_name),
      service_type: sessionTypeToServiceType(cs.session_type),
      session_date: cs.session_date ? (cs.session_date as string).slice(0, 10) : null,
      primary_location: cs.location,
      ai_processing_allowed: true,           // covered by contract/privacy policy (spec §3.1)
      ai_processing_basis: "contract",
      ai_processing_policy_version: AI_PROCESSING_POLICY_VERSION,
      ai_processing_confirmed_at: new Date().toISOString(),
    }).select("id").single();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: existing } = await client.from("photography_sessions")
          .select("id").eq("client_session_id", cs.id).single();
        throw new CreateSessionConflictError(existing!.id as string);
      }
      throw new Error(`could not create photography session: ${insErr.message}`);
    }
    return { sessionId: data.id as string };
  }

  if (!input.serviceType || !isServiceType(input.serviceType)) {
    throw new Error(`invalid service type: ${input.serviceType ?? "(missing)"}`);
  }
  const { data, error } = await client.from("photography_sessions")
    .insert({ service_type: input.serviceType }).select("id").single();
  if (error) throw new Error(`could not create photography session: ${error.message}`);
  return { sessionId: data.id as string };
}

// Whitelisted, taxonomy-validated facts patch (spec §7.4 Section 1 + §8.5).
const TEXT_FACTS = [
  "internal_client_name", "public_display_name", "primary_location",
  "degree", "internal_notes", "public_session_summary",
] as const;

export interface UpdateFactsArgs {
  client: SupabaseClient;
  sessionId: string;
  facts: Record<string, unknown>;
}

export async function updateSessionFacts(args: UpdateFactsArgs): Promise<{ updated: boolean }> {
  const { client, sessionId, facts } = args;
  const patch: Record<string, unknown> = {};

  if ("service_type" in facts) {
    if (!isServiceType(facts.service_type)) throw new Error(`invalid service type: ${String(facts.service_type)}`);
    patch.service_type = facts.service_type;
  }
  if ("school_slug" in facts) {
    if (facts.school_slug !== null && !isSchoolSlug(facts.school_slug)) {
      throw new Error(`invalid school slug: ${String(facts.school_slug)}`);
    }
    patch.school_slug = facts.school_slug;
  }
  if ("lighting_condition" in facts) {
    if (facts.lighting_condition !== null && !isLightingCondition(facts.lighting_condition)) {
      throw new Error(`invalid lighting condition: ${String(facts.lighting_condition)}`);
    }
    patch.lighting_condition = facts.lighting_condition;
  }
  for (const key of TEXT_FACTS) {
    if (key in facts) {
      const v = facts[key];
      patch[key] = v === null ? null : typeof v === "string" ? v.slice(0, 2000) : String(v).slice(0, 2000);
    }
  }
  for (const key of ["session_date", "start_time"]) {
    if (key in facts) patch[key] = facts[key];
  }
  for (const key of ["graduation_year", "outfit_count", "group_size"]) {
    if (key in facts) {
      const v = facts[key];
      if (v !== null && (typeof v !== "number" || !Number.isInteger(v))) {
        throw new Error(`${key} must be an integer or null`);
      }
      patch[key] = v;
    }
  }
  if ("secondary_locations" in facts) {
    if (!Array.isArray(facts.secondary_locations)) throw new Error("secondary_locations must be an array");
    patch.secondary_locations = (facts.secondary_locations as unknown[]).map((s) => String(s).slice(0, 300));
  }
  if (Object.keys(patch).length === 0) return { updated: false };

  const { error } = await client.from("photography_sessions").update(patch).eq("id", sessionId);
  if (error) throw new Error(`facts update failed: ${error.message}`);
  return { updated: true };
}
```

- [ ] **Step 7: Write the list/create route** (`app/api/admin/session-content/sessions/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { assembleSessionStates } from "@/lib/contentEngine/sessionState";
import {
  createPhotographySession, CreateSessionConflictError,
} from "@/lib/contentEngine/createSession";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const admin = createSupabaseAdminClient();
  const { data: sessions, error } = await admin.from("photography_sessions")
    .select("id,public_display_name,internal_client_name,service_type,school_slug,session_date,marketing_permission,ai_processing_allowed,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("session list failed", error);
    return NextResponse.json({ error: "could not list sessions" }, { status: 500 });
  }

  const states = await assembleSessionStates(admin, (sessions ?? []).map((s) => s.id as string));
  return NextResponse.json({
    sessions: (sessions ?? []).map((s) => ({ ...s, ...states.get(s.id as string) })),
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { clientSessionId?: unknown; serviceType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const clientSessionId = typeof body.clientSessionId === "string" ? body.clientSessionId.toLowerCase() : undefined;
  if (clientSessionId && !isUuid(clientSessionId)) {
    return NextResponse.json({ error: "clientSessionId must be a uuid" }, { status: 400 });
  }

  try {
    const created = await createPhotographySession({
      client: createSupabaseAdminClient(),
      input: {
        clientSessionId,
        serviceType: typeof body.serviceType === "string" ? body.serviceType : undefined,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof CreateSessionConflictError) {
      return NextResponse.json(
        { error: err.message, existingSessionId: err.existingSessionId }, { status: 409 },
      );
    }
    const message = err instanceof Error ? err.message : "create failed";
    return NextResponse.json({ error: message }, { status: /invalid|not found/i.test(message) ? 400 : 500 });
  }
}
```

- [ ] **Step 8: Write the get/patch route** (`app/api/admin/session-content/sessions/[id]/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { assembleSessionStates } from "@/lib/contentEngine/sessionState";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });
  const sessionId = id.toLowerCase();

  const admin = createSupabaseAdminClient();
  const { data: session, error } = await admin.from("photography_sessions")
    .select("*").eq("id", sessionId).maybeSingle();
  if (error) {
    console.error("session fetch failed", error);
    return NextResponse.json({ error: "could not load session" }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const [{ data: activePackage }, states] = await Promise.all([
    admin.from("session_content_packages")
      .select("*").eq("photography_session_id", sessionId).is("archived_at", null).maybeSingle(),
    assembleSessionStates(admin, [sessionId]),
  ]);
  const { data: items } = activePackage
    ? await admin.from("session_content_items").select("*").eq("package_id", activePackage.id)
        .order("created_at")
    : { data: [] };
  // publication history spans ALL packages of this session (spec §7.4 Section 5)
  const { data: pkgIds } = await admin.from("session_content_packages")
    .select("id").eq("photography_session_id", sessionId);
  const { data: published } = (pkgIds ?? []).length
    ? await admin.from("session_content_items")
        .select("id,content_type,published_target_type,published_target_id,published_at,published_ref,payload")
        .in("package_id", (pkgIds ?? []).map((p) => p.id))
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({
    session,
    activePackage: activePackage ?? null,
    items: items ?? [],
    published: published ?? [],
    ...states.get(sessionId),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await updateSessionFacts({
      client: createSupabaseAdminClient(), sessionId: id.toLowerCase(), facts: body,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "facts update failed";
    return NextResponse.json({ error: message }, { status: /invalid|must be/i.test(message) ? 422 : 500 });
  }
}
```

- [ ] **Step 9: Run the tests** — `npm test -- prefill && npm run test:integration -- sessions-api` → all PASS; `npx tsc --noEmit` + scoped eslint clean.

- [ ] **Step 10: Commit**

```bash
git add lib/contentEngine/prefill.ts lib/contentEngine/sessionState.ts lib/contentEngine/createSession.ts app/api/admin/session-content/sessions tests/unit/prefill.test.ts tests/integration/sessions-api.test.ts
git commit -m "feat: session creation with prefill, taxonomy-validated facts, and state assembly"
```

---

### Task 6: Permissions route with revocation acknowledgement (spec §7.3, §3.1)

**Files:**
- Create: `lib/contentEngine/permissions.ts`
- Create: `app/api/admin/session-content/sessions/[id]/permissions/route.ts`
- Modify: `tests/integration/sessions-api.test.ts` (append a describe block)

- [ ] **Step 1: Append the failing tests** to `tests/integration/sessions-api.test.ts`:

```ts
describe("updatePermissions (spec §7.3, §3.1)", () => {
  it("enables marketing permission with source + stamp; enables AI with basis + stamp", async () => {
    const { updatePermissions } = await import("@/lib/contentEngine/permissions");
    const sessionId = await createTestSession({ marketing_permission: false, ai_processing_allowed: false });

    const result = await updatePermissions({
      client: service, sessionId,
      changes: { marketingPermission: true, marketingPermissionSource: "manual_confirmation",
                 aiProcessingAllowed: true, aiProcessingBasis: "manual_confirmation" },
    });
    expect(result.outcome).toBe("updated");

    const { data: row } = await service.from("photography_sessions").select("*").eq("id", sessionId).single();
    expect(row!.marketing_permission).toBe(true);
    expect(row!.marketing_permission_source).toBe("manual_confirmation");
    expect(row!.marketing_permission_confirmed_at).not.toBeNull();
    expect(row!.marketing_permission_revoked_at).toBeNull();
    expect(row!.ai_processing_allowed).toBe(true);
    expect(row!.ai_processing_basis).toBe("manual_confirmation");
    expect(row!.ai_processing_confirmed_at).not.toBeNull();
  });

  it("revoking marketing permission with published content requires acknowledgement", async () => {
    const { updatePermissions } = await import("@/lib/contentEngine/permissions");
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await service.from("session_content_items").update({
      status: "published", published_target_type: "none", published_at: new Date().toISOString(),
    }).eq("id", item);

    const blocked = await updatePermissions({
      client: service, sessionId, changes: { marketingPermission: false },
    });
    expect(blocked.outcome).toBe("requires_acknowledgement");
    if (blocked.outcome !== "requires_acknowledgement") throw new Error("unreachable");
    expect(blocked.publishedCounts.internal_link_suggestion).toBe(1);
    const { data: still } = await service.from("photography_sessions")
      .select("marketing_permission").eq("id", sessionId).single();
    expect(still!.marketing_permission).toBe(true); // untouched

    const revoked = await updatePermissions({
      client: service, sessionId, changes: { marketingPermission: false }, acknowledgePublished: true,
    });
    expect(revoked.outcome).toBe("updated");
    const { data: after } = await service.from("photography_sessions")
      .select("marketing_permission,marketing_permission_revoked_at").eq("id", sessionId).single();
    expect(after!.marketing_permission).toBe(false);
    expect(after!.marketing_permission_revoked_at).not.toBeNull();
  });

  it("rejects sources/bases outside the check-constraint sets", async () => {
    const { updatePermissions } = await import("@/lib/contentEngine/permissions");
    const sessionId = await createTestSession();
    await expect(updatePermissions({
      client: service, sessionId,
      changes: { marketingPermission: true, marketingPermissionSource: "vibes" },
    })).rejects.toThrow(/source/i);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- sessions-api` → new block FAILS.

- [ ] **Step 3: Write the module** (`lib/contentEngine/permissions.ts`)

```ts
// Permission updates (spec §3.1, §7.3). Two SEPARATE controls, never
// conflated: marketing_permission gates publication; ai_processing_allowed
// gates analysis/generation. Revoking marketing permission while published
// content exists requires explicit acknowledgement (the UI's blocking modal);
// the actual takedown is a separate per-item act (takedown.ts).
import type { SupabaseClient } from "@supabase/supabase-js";

const MARKETING_SOURCES = [
  "contract", "email", "testimonial_form", "manual_confirmation", "portfolio_collaboration",
] as const;
const AI_BASES = [
  "contract", "privacy_policy", "portfolio_collaboration", "manual_confirmation", "internal_business_policy",
] as const;

export interface PermissionChanges {
  marketingPermission?: boolean;
  marketingPermissionSource?: string;
  aiProcessingAllowed?: boolean;
  aiProcessingBasis?: string;
}

export interface UpdatePermissionsArgs {
  client: SupabaseClient;
  sessionId: string;
  changes: PermissionChanges;
  acknowledgePublished?: boolean;
}

export type UpdatePermissionsResult =
  | { outcome: "updated" }
  | { outcome: "requires_acknowledgement"; publishedCounts: Record<string, number> }
  | { outcome: "not_found" };

async function publishedCountsFor(client: SupabaseClient, sessionId: string): Promise<Record<string, number>> {
  const { data: pkgs } = await client.from("session_content_packages")
    .select("id").eq("photography_session_id", sessionId);
  if (!pkgs?.length) return {};
  const { data: items } = await client.from("session_content_items")
    .select("content_type,published_ref").in("package_id", pkgs.map((p) => p.id))
    .eq("status", "published");
  const counts: Record<string, number> = {};
  for (const i of items ?? []) {
    if ((i.published_ref as Record<string, unknown> | null)?.taken_down_at) continue; // already taken down
    counts[i.content_type] = (counts[i.content_type] ?? 0) + 1;
  }
  return counts;
}

export async function updatePermissions(args: UpdatePermissionsArgs): Promise<UpdatePermissionsResult> {
  const { client, sessionId, changes, acknowledgePublished } = args;

  const { data: session } = await client.from("photography_sessions")
    .select("id,marketing_permission").eq("id", sessionId).maybeSingle();
  if (!session) return { outcome: "not_found" };

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (changes.marketingPermission === true) {
    if (!changes.marketingPermissionSource
        || !(MARKETING_SOURCES as readonly string[]).includes(changes.marketingPermissionSource)) {
      throw new Error(`marketing permission source must be one of ${MARKETING_SOURCES.join(", ")}`);
    }
    patch.marketing_permission = true;
    patch.marketing_permission_source = changes.marketingPermissionSource;
    patch.marketing_permission_confirmed_at = now;
    patch.marketing_permission_revoked_at = null;
  } else if (changes.marketingPermission === false && session.marketing_permission) {
    const publishedCounts = await publishedCountsFor(client, sessionId);
    if (Object.keys(publishedCounts).length > 0 && !acknowledgePublished) {
      return { outcome: "requires_acknowledgement", publishedCounts };
    }
    patch.marketing_permission = false;
    patch.marketing_permission_revoked_at = now;
  }

  if (changes.aiProcessingAllowed === true) {
    if (!changes.aiProcessingBasis
        || !(AI_BASES as readonly string[]).includes(changes.aiProcessingBasis)) {
      throw new Error(`ai processing basis must be one of ${AI_BASES.join(", ")}`);
    }
    patch.ai_processing_allowed = true;
    patch.ai_processing_basis = changes.aiProcessingBasis;
    patch.ai_processing_confirmed_at = now;
  } else if (changes.aiProcessingAllowed === false) {
    patch.ai_processing_allowed = false;
  }

  if (Object.keys(patch).length === 0) return { outcome: "updated" };
  const { error } = await client.from("photography_sessions").update(patch).eq("id", sessionId);
  if (error) throw new Error(`permission update failed: ${error.message}`);
  return { outcome: "updated" };
}
```

- [ ] **Step 4: Write the route** (`app/api/admin/session-content/sessions/[id]/permissions/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { updatePermissions } from "@/lib/contentEngine/permissions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await updatePermissions({
      client: createSupabaseAdminClient(),
      sessionId: id.toLowerCase(),
      changes: {
        marketingPermission: typeof body.marketingPermission === "boolean" ? body.marketingPermission : undefined,
        marketingPermissionSource: typeof body.marketingPermissionSource === "string" ? body.marketingPermissionSource : undefined,
        aiProcessingAllowed: typeof body.aiProcessingAllowed === "boolean" ? body.aiProcessingAllowed : undefined,
        aiProcessingBasis: typeof body.aiProcessingBasis === "string" ? body.aiProcessingBasis : undefined,
      },
      acknowledgePublished: body.acknowledgePublished === true,
    });
    if (result.outcome === "requires_acknowledgement") return NextResponse.json(result, { status: 409 });
    if (result.outcome === "not_found") return NextResponse.json({ error: "session not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "permission update failed";
    return NextResponse.json({ error: message }, { status: /must be one of/i.test(message) ? 422 : 500 });
  }
}
```

- [ ] **Step 5: Run the tests** — `npm run test:integration -- sessions-api` → all PASS (incl. new block); `npx tsc --noEmit` + scoped eslint clean.

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/permissions.ts app/api/admin/session-content/sessions tests/integration/sessions-api.test.ts
git commit -m "feat: permission updates with revocation acknowledgement gate"
```

---

### Task 7: Photos listing + editing routes (spec §7.4 Section 2)

**Files:**
- Create: `app/api/admin/session-content/photos/route.ts`
- Create: `app/api/admin/session-content/photos/[id]/route.ts`

These are thin routes over already-tested primitives (signed URLs are a Supabase API call; the PATCH is a whitelisted update). No new integration tests — covered by the Plan-4B manual checklist; the field whitelist mirrors `updateSessionFacts`' tested pattern.

- [ ] **Step 1: Write the list route** (`app/api/admin/session-content/photos/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { ORIGINALS_BUCKET, isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THUMBNAIL_TTL_SECONDS = 3600; // 1h signed reads (spec §4.1)

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: photos, error } = await admin.from("session_photos")
    .select("id,storage_path,original_filename,width,height,sort_order,excluded,analysis_status,analysis_error,analysis_lease_expires_at,analysis_attempt,alt_text,title,description,tags,quality_score,suggested_category,destination_recommendations,public_derivative_url,created_at")
    .eq("photography_session_id", sessionId)
    .order("sort_order").order("created_at");
  if (error) {
    console.error("photo list failed", error);
    return NextResponse.json({ error: "could not list photos" }, { status: 500 });
  }

  const withThumbs = await Promise.all((photos ?? []).map(async (p) => {
    const { data } = await admin.storage.from(ORIGINALS_BUCKET)
      .createSignedUrl(p.storage_path as string, THUMBNAIL_TTL_SECONDS);
    return { ...p, thumbnailUrl: data?.signedUrl ?? null };
  }));
  return NextResponse.json({ photos: withThumbs });
}
```

- [ ] **Step 2: Write the patch route** (`app/api/admin/session-content/photos/[id]/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "photo id must be a uuid" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("excluded" in body) {
    if (typeof body.excluded !== "boolean") return NextResponse.json({ error: "excluded must be boolean" }, { status: 422 });
    patch.excluded = body.excluded;
  }
  if ("sort_order" in body) {
    if (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0) {
      return NextResponse.json({ error: "sort_order must be a non-negative integer" }, { status: 422 });
    }
    patch.sort_order = body.sort_order;
  }
  for (const key of ["alt_text", "title", "description"] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== "string") {
        return NextResponse.json({ error: `${key} must be a string or null` }, { status: 422 });
      }
      patch[key] = body[key] === null ? null : (body[key] as string).slice(0, 1000);
    }
  }
  if ("tags" in body) {
    if (!Array.isArray(body.tags)) return NextResponse.json({ error: "tags must be an array" }, { status: 422 });
    patch.tags = (body.tags as unknown[]).map((t) => String(t).slice(0, 60)).slice(0, 15);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no editable fields provided" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("session_photos")
    .update(patch).eq("id", id.toLowerCase()).select("id").maybeSingle();
  if (error) {
    console.error("photo patch failed", error);
    return NextResponse.json({ error: "could not update photo" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "photo not found" }, { status: 404 });
  return NextResponse.json({ updated: true });
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint app/api/admin/session-content` clean; `npm test && npm run test:integration` still green.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/session-content/photos/route.ts "app/api/admin/session-content/photos/[id]/route.ts"
git commit -m "feat: photo listing with signed thumbnails and whitelisted photo edits"
```

---

### Task 8: Reconciliation (spec §9.4)

**Files:**
- Create: `lib/contentEngine/reconcile.ts`
- Create: `app/api/admin/session-content/reconcile/route.ts`
- Create: `tests/integration/reconcile.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/integration/reconcile.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem } from "./helpers";
import { buildReconcileReport, linkItemToExistingTarget, markStuckItemFailed } from "@/lib/contentEngine/reconcile";
import { PUBLISHING_LEASE_MS } from "@/lib/contentEngine/state";

beforeAll(() => resetDb());

describe("buildReconcileReport (spec §9.4)", () => {
  it("reports items stuck publishing past the lease", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const stuck = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await service.from("session_content_items").update({
      status: "publishing",
      publishing_started_at: new Date(Date.now() - PUBLISHING_LEASE_MS - 60_000).toISOString(),
    }).eq("id", stuck);
    const live = await createItem(pkg, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "P", reason: "r" }],
    }, "approved");
    await service.from("session_content_items").update({
      status: "publishing", publishing_started_at: new Date().toISOString(),
    }).eq("id", live);

    const report = await buildReconcileReport({ client: service, sessionId });
    expect(report.stuckPublishing.map((s) => s.itemId)).toContain(stuck);
    expect(report.stuckPublishing.map((s) => s.itemId)).not.toContain(live);
  });

  it("detects a failed portfolio item whose target exists by content hash (auto-confirmable)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId); // helper provides derivative + hash
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "interrupted" }).eq("id", item);
    const { data: existing } = await service.from("portfolio_images").insert({
      title: "Existing", alt: "Existing", image_url: photo.public_derivative_url!,
      category_slug: "grads", featured: false, sort_order: 1, content_hash: photo.content_hash,
    }).select("id").single();

    const report = await buildReconcileReport({ client: service, sessionId });
    const match = report.failedWithExistingTarget.find((m) => m.itemId === item);
    expect(match).toBeTruthy();
    expect(match!.targetType).toBe("portfolio_image");
    expect(match!.targetId).toBe(String(existing!.id));
    expect(match!.autoConfirmable).toBe(true); // hash proof
  });

  it("detects a failed journal item by slug match (manual confirmation required)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `reconcile-slug-${Date.now()}`;
    await service.from("blog_posts").insert({
      title: "Existing", body: "x", slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    });
    const item = await createItem(pkg, "journal_post", {
      title: "T", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "interrupted" }).eq("id", item);

    const report = await buildReconcileReport({ client: service, sessionId });
    const match = report.failedWithExistingTarget.find((m) => m.itemId === item);
    expect(match!.targetType).toBe("blog_post");
    expect(match!.autoConfirmable).toBe(false); // slug alone is not proof of provenance (spec §9.2)
  });

  it("reports orphaned derivatives (derivative present, zero live references)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId); // derivative URL set, nothing live references it
    const report = await buildReconcileReport({ client: service, sessionId });
    expect(report.orphanedDerivatives.map((o) => o.photoId)).toContain(photo.id);
  });
});

describe("reconcile actions", () => {
  it("links a failed item to its existing target with proof re-verified", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "x" }).eq("id", item);
    const { data: target } = await service.from("portfolio_images").insert({
      title: "E", alt: "E", image_url: photo.public_derivative_url!,
      category_slug: "grads", featured: false, sort_order: 2, content_hash: photo.content_hash,
    }).select("id").single();

    const result = await linkItemToExistingTarget({
      client: service, itemId: item, targetType: "portfolio_image", targetId: String(target!.id),
    });
    expect(result.linked).toBe(true);
    const { data: row } = await service.from("session_content_items")
      .select("status,published_target_type,published_target_id,published_at,error").eq("id", item).single();
    expect(row!.status).toBe("published");
    expect(row!.published_target_type).toBe("portfolio_image");
    expect(row!.published_target_id).toBe(String(target!.id));
    expect(row!.error).toBeNull();
  });

  it("refuses to link a blog slug match without confirm, accepts with confirm", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `link-slug-${Date.now()}`;
    const { data: post } = await service.from("blog_posts").insert({
      title: "E", body: "x", slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    }).select("id").single();
    const item = await createItem(pkg, "journal_post", {
      title: "T", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "x" }).eq("id", item);

    await expect(linkItemToExistingTarget({
      client: service, itemId: item, targetType: "blog_post", targetId: String(post!.id),
    })).rejects.toThrow(/confirm/i);

    const result = await linkItemToExistingTarget({
      client: service, itemId: item, targetType: "blog_post", targetId: String(post!.id), confirm: true,
    });
    expect(result.linked).toBe(true);
  });

  it("marks a stuck publishing item failed (resume path)", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await service.from("session_content_items").update({
      status: "publishing",
      publishing_started_at: new Date(Date.now() - PUBLISHING_LEASE_MS - 60_000).toISOString(),
    }).eq("id", item);

    const result = await markStuckItemFailed({ client: service, itemId: item });
    expect(result.marked).toBe(true);
    const { data: row } = await service.from("session_content_items")
      .select("status,error").eq("id", item).single();
    expect(row!.status).toBe("failed");
    expect(row!.error).toMatch(/interrupted/i);

    // a LIVE publishing item is protected
    const live = await createItem(pkg, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "P", reason: "r" }],
    }, "approved");
    await service.from("session_content_items").update({
      status: "publishing", publishing_started_at: new Date().toISOString(),
    }).eq("id", live);
    await expect(markStuckItemFailed({ client: service, itemId: live })).rejects.toThrow(/still within|live/i);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- reconcile` → FAIL.

- [ ] **Step 3: Write the module** (`lib/contentEngine/reconcile.ts`)

```ts
// Reconciliation (spec §9.4): surface items stuck publishing past the lease,
// failed items whose intended target detectably exists (hash/constraint proofs
// auto-confirmable; slug matches need manual confirmation — an existing post
// is never assumed ours), and orphaned derivatives. Link actions RE-VERIFY the
// proof server-side before claiming a target.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHING_LEASE_MS } from "@/lib/contentEngine/state";
import { countLiveReferences } from "@/lib/contentEngine/derivativeRefs";

export interface StuckItem { itemId: string; contentType: string; publishingStartedAt: string }
export interface TargetMatch {
  itemId: string; contentType: string;
  targetType: "portfolio_image" | "school_page_photo" | "blog_post";
  targetId: string; autoConfirmable: boolean; proof: string;
}
export interface OrphanedDerivative { photoId: string; url: string }

export interface ReconcileReport {
  stuckPublishing: StuckItem[];
  failedWithExistingTarget: TargetMatch[];
  orphanedDerivatives: OrphanedDerivative[];
}

interface ItemRow {
  id: string; content_type: string; status: string;
  payload: Record<string, unknown>; publishing_started_at: string | null;
}

async function sessionItems(client: SupabaseClient, sessionId: string): Promise<ItemRow[]> {
  const { data: pkgs } = await client.from("session_content_packages")
    .select("id").eq("photography_session_id", sessionId);
  if (!pkgs?.length) return [];
  const { data } = await client.from("session_content_items")
    .select("id,content_type,status,payload,publishing_started_at")
    .in("package_id", pkgs.map((p) => p.id));
  return (data ?? []) as ItemRow[];
}

function isStuck(item: ItemRow, now: number): boolean {
  if (item.status !== "publishing" || !item.publishing_started_at) return false;
  return new Date(item.publishing_started_at).getTime() + PUBLISHING_LEASE_MS <= now;
}

async function findTargetFor(client: SupabaseClient, item: ItemRow): Promise<TargetMatch | null> {
  const payload = item.payload;
  if (item.content_type === "portfolio_pick" && typeof payload.session_photo_id === "string") {
    const { data: photo } = await client.from("session_photos")
      .select("content_hash").eq("id", payload.session_photo_id).maybeSingle();
    if (!photo) return null;
    const { data: hit } = await client.from("portfolio_images")
      .select("id").eq("content_hash", photo.content_hash).maybeSingle();
    if (!hit) return null;
    return { itemId: item.id, contentType: item.content_type, targetType: "portfolio_image",
             targetId: String(hit.id), autoConfirmable: true, proof: "content_hash" };
  }
  if (item.content_type === "school_page_photo" && typeof payload.session_photo_id === "string") {
    const { data: hit } = await client.from("school_page_photos")
      .select("id").eq("school_slug", payload.school_slug as string)
      .eq("session_photo_id", payload.session_photo_id).maybeSingle();
    if (!hit) return null;
    return { itemId: item.id, contentType: item.content_type, targetType: "school_page_photo",
             targetId: String(hit.id), autoConfirmable: true, proof: "unique_constraint" };
  }
  if (item.content_type === "journal_post" && typeof payload.slug === "string") {
    const { data: hit } = await client.from("blog_posts")
      .select("id").eq("slug", payload.slug).maybeSingle();
    if (!hit) return null;
    return { itemId: item.id, contentType: item.content_type, targetType: "blog_post",
             targetId: String(hit.id), autoConfirmable: false, proof: "slug_match" };
  }
  return null;
}

export async function buildReconcileReport(
  args: { client: SupabaseClient; sessionId: string },
): Promise<ReconcileReport> {
  const { client, sessionId } = args;
  const items = await sessionItems(client, sessionId);
  const now = Date.now();

  const stuckPublishing: StuckItem[] = items.filter((i) => isStuck(i, now)).map((i) => ({
    itemId: i.id, contentType: i.content_type, publishingStartedAt: i.publishing_started_at as string,
  }));

  const failedWithExistingTarget: TargetMatch[] = [];
  for (const item of items.filter((i) => i.status === "failed")) {
    const match = await findTargetFor(client, item);
    if (match) failedWithExistingTarget.push(match);
  }

  const { data: photos } = await client.from("session_photos")
    .select("id,public_derivative_url").eq("photography_session_id", sessionId)
    .not("public_derivative_url", "is", null);
  const orphanedDerivatives: OrphanedDerivative[] = [];
  for (const photo of photos ?? []) {
    const refs = await countLiveReferences(client, photo as { id: string; public_derivative_url: string });
    if (refs.total === 0) {
      orphanedDerivatives.push({ photoId: photo.id as string, url: photo.public_derivative_url as string });
    }
  }

  return { stuckPublishing, failedWithExistingTarget, orphanedDerivatives };
}

export async function linkItemToExistingTarget(args: {
  client: SupabaseClient; itemId: string; targetType: string; targetId: string; confirm?: boolean;
}): Promise<{ linked: boolean }> {
  const { client, itemId, targetType, targetId, confirm } = args;

  const { data: item } = await client.from("session_content_items")
    .select("id,content_type,status,payload,publishing_started_at").eq("id", itemId).maybeSingle();
  if (!item) throw new Error("item not found");
  if (item.status !== "failed") throw new Error(`only failed items can be linked (status=${item.status})`);

  const match = await findTargetFor(client, item as ItemRow);
  if (!match || match.targetType !== targetType || match.targetId !== targetId) {
    throw new Error("target proof could not be re-verified");
  }
  if (!match.autoConfirmable && confirm !== true) {
    throw new Error("slug matches require explicit confirm (an existing post is never assumed ours)");
  }

  const { error } = await client.from("session_content_items").update({
    status: "published",
    published_target_type: targetType,
    published_target_id: targetId,
    published_at: new Date().toISOString(),
    published_ref: { reconciled: true, proof: match.proof },
    error: null,
  }).eq("id", itemId).eq("status", "failed");
  if (error) throw new Error(`link failed: ${error.message}`);
  return { linked: true };
}

export async function markStuckItemFailed(args: {
  client: SupabaseClient; itemId: string;
}): Promise<{ marked: boolean }> {
  const { client, itemId } = args;
  const { data: item } = await client.from("session_content_items")
    .select("id,status,publishing_started_at").eq("id", itemId).maybeSingle();
  if (!item) throw new Error("item not found");
  if (!isStuck(item as ItemRow, Date.now())) {
    throw new Error("item is not stuck — it is still within its publishing lease (live)");
  }
  const { error } = await client.from("session_content_items").update({
    status: "failed",
    error: "publishing interrupted (stuck past lease, marked failed via reconciliation)",
    publishing_started_at: null,
  }).eq("id", itemId).eq("status", "publishing");
  if (error) throw new Error(`mark failed: ${error.message}`);
  return { marked: true };
}
```

- [ ] **Step 4: Write the route** (`app/api/admin/session-content/reconcile/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildReconcileReport, linkItemToExistingTarget, markStuckItemFailed,
} from "@/lib/contentEngine/reconcile";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  try {
    const report = await buildReconcileReport({ client: createSupabaseAdminClient(), sessionId });
    return NextResponse.json(report);
  } catch (err) {
    console.error("reconcile report failed", err);
    return NextResponse.json({ error: "could not build reconcile report" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });

  try {
    if (body.action === "link") {
      const result = await linkItemToExistingTarget({
        client: createSupabaseAdminClient(), itemId,
        targetType: typeof body.targetType === "string" ? body.targetType : "",
        targetId: typeof body.targetId === "string" ? body.targetId : "",
        confirm: body.confirm === true,
      });
      return NextResponse.json(result);
    }
    if (body.action === "mark_failed") {
      const result = await markStuckItemFailed({ client: createSupabaseAdminClient(), itemId });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "action must be 'link' or 'mark_failed'" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reconcile action failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
```

- [ ] **Step 5: Run the tests** — `npm run test:integration -- reconcile` → all PASS; `npx tsc --noEmit` + scoped eslint clean.

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/reconcile.ts app/api/admin/session-content/reconcile tests/integration/reconcile.test.ts
git commit -m "feat: reconciliation report with proof-verified target linking"
```

---

### Task 9: Full-suite run + plan wrap-up

- [ ] **Step 1: Clean rebuild and run everything**

Run: `./scripts/content-engine/reset-test-db.sh && npm test && npm run test:integration && npm run test:legacy`
Expected: all VERIFY OKs; every unit + integration test passes from a fresh DB; legacy suite shows only the 3 known pre-existing failures.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/admin/session-content lib/contentEngine tests/unit`
Expected: no errors.

- [ ] **Step 3: Confirm scope hygiene**

Run: `git log --oneline -12 && git status --porcelain && git diff HEAD~8..HEAD --stat -- supabase/migrations`
Confirm: working tree clean; NO migration changes in this plan; nothing pushed.

- [ ] **Step 4: Final commit of any stragglers and stop**

```bash
git add -A && git commit -m "chore: content engine publishers + engine APIs complete (plan 4A of 6)" || echo "nothing to commit"
```

**STOP.** Plan 4B (admin workflow UI) builds the `/admin/content-engine` pages on these APIs: session list with derived-state badges and pickers, the workspace (facts, permissions + revocation modal driving the 409 acknowledgement flow, photos grid with upload/analyze/resume, generation section sequencing link/testimonial before journal, item editors with the 409-conflict autosave protocol, sticky publish bar, publication history with Revalidate/takedown). Production apply remains the Plan-6 gate.

---

## Self-Review Notes

- **Spec coverage:** §4.3/§9.1 Step A (validated-payload photo ids, ownership, EXIF-orient, ≤2400px, metadata stripped, content-addressed upsert, reuse-on-retry, recorded on session_photos) → Task 1; §9.1 Step B wiring + guard-vs-failure semantics + §9.1 Step C targeted map with recoverable failures → Task 2; §7.3 revocation/takedown (preserve history, deactivate vs delete per table, shared-derivative rule §4.3, revalidate, revoked_at stamp) → Tasks 3+6; §7.4 autosave `payload_revision` 409 protocol + approve/reject/un-reject → Task 4; §7.1/§7.2 creation+prefill (first-name-only display name, taxonomy-safe service type, auto ai-processing with basis for covered sessions, DB-enforced one-per-client-session conflict surfacing the existing id) + §8.5 taxonomy-validated facts + §6 state assembly for list badges → Task 5; §3.1 permission semantics (two separate controls; sources/bases constrained) → Task 6; §7.4 Section 2 photo listing (1h signed thumbnails §4.1) + exclude/sort/metadata edits → Task 7; §9.4 reconciliation (stuck publishing, hash/constraint auto-confirm vs slug manual confirm, orphaned derivatives) → Task 8.
- **Deliberately deferred:** all UI (Plan 4B); §4.4 retention review/abandoned-upload sweep (§15 deferred tooling); `content_events` view counts in publication history (Plan 6); archived-package browsing API (the existing tables serve it; UI reads via createPackage copy flow — revisit in 4B if a dedicated endpoint is needed); takedown of guide rows uses `published=false` (deactivate) since both guide tables have a `published` flag.
- **Type consistency:** `DerivativeError.kind` values consumed by `publishItem` match Task 1's union; `pathsForPublishedItem` signature shared by publish + takedown; `countLiveReferences` consumed by takedown + reconcile with the same `DerivativePhoto` shape; `PUBLISHING_LEASE_MS` imported from Plan 2's `state.ts`; `applyAutosave`/`applyStatusAction` result unions match the routes' switch arms; `createPhotographySession`/`updateSessionFacts`/`updatePermissions` argument shapes match their routes.
- **No placeholders:** every code step is complete; every run step has an exact command and expected outcome.



