# Content Engine Admin Workflow UI (Plan 4B of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/content-engine` workflow UI (spec §7): session list with derived-state badges and create pickers, and the single-scroll workspace — facts, permissions with the revocation modal, photo upload/analysis, generation with dependency-ordered sequencing, item review with server-backed autosave, the sticky publish bar, publication history with takedown, and the reconciliation banner.

**Architecture:** Mirrors `/admin/sessions`: a thin server page shell renders one `"use client"` dashboard/workspace component. All data flows through a typed fetch client (`engineApi.ts`) over the Plan-4A routes (cookie auth — `credentials` are sent automatically; `checkAuth()` is the UI-only gate). Pure logic (state badges/actionability sort, the autosave decision core) is extracted into unit-tested modules; components stay under 400 lines by splitting the workspace into one file per section.

**Tech Stack:** Next.js 16 App Router client components, React 19, `C` from `@/lib/colors` (no hardcoded hex), Vitest for the pure modules. No new dependencies.

**Plan series:** 1-3 + 4A DONE → **4B Admin workflow UI (this plan)** → 5 Public-page integrations → 6 Analytics + deployment verification.

**Spec is law** (`docs/superpowers/specs/2026-06-10-session-content-engine-design.md` §7): deviations stop and flag.

**Server contracts the UI consumes (from Plan 4A's final review — treat as fixed):**
- Autosave: `PATCH /api/admin/session-content/items/[id]` body `{payload, payloadRevision}` → 200 `{outcome:"saved", payloadRevision}`; 409 `{outcome:"conflict", server:{payload,payload_revision,status}}`; 409 `{error}` (not editable); 422 invalid.
- Status: `POST .../items/[id]/status` `{action: approve|reject|unreject, reason?}`.
- Publish: `POST .../publish` `{itemId}` → 200 `{status:"published", revalidationFailures:[]}` (show Revalidate affordance when non-empty); 409 blocked; 422 failed (item becomes `failed`; retry = re-approve → publish).
- Permissions: `PATCH .../sessions/[id]/permissions` → 409 `{outcome:"requires_acknowledgement", publishedCounts}` → resend with `acknowledgePublished:true` (acknowledgement disables future publishing only; takedown is per-item).
- Generation MUST be sequenced: `internal_link_suggestion` and `testimonial_feature` BEFORE `journal_post` (order below).
- Reconcile: `GET .../reconcile?sessionId=` ; `POST` `{action:"link"|"mark_failed", ...}`; no resume endpoint (mark_failed → re-approve → re-publish).
- Photo thumbnails (`GET .../photos?sessionId=`) are 1-hour signed URLs — refetch on demand, don't cache past a session.
- Sessions: `GET/POST .../sessions`, `GET/PATCH .../sessions/[id]`; create returns 409 `{existingSessionId}` for an already-linked client session (UI opens the existing workspace, spec §7.1).

**Standing constraints:** Nothing applied to production. The user has a PARALLEL payments feature in the working tree (`app/admin/payments/`, `lib/revenue/`, etc.) — NEVER `git add -A`; stage files explicitly. Files <400 lines; colors via `C`; toasts via the local `showToast` pattern (each component keeps a small `notice` state — the admin monolith's `showToast` is not importable).

**Generation order constant (used everywhere):**
```
GENERATION_ORDER = ["internal_link_suggestion", "testimonial_feature", "portfolio_pick",
                    "school_page_photo", "guide_photo", "journal_post"]  // journal LAST
```

---

## File Structure

```
app/api/admin/session-content/generate/skip/route.ts  — NEW server gap: Skip failed type (spec §8.2)
app/admin/content-engine/
  page.tsx               — thin shell (metadata + dashboard)
  engineTypes.ts         — DTO types shared by all components
  engineApi.ts           — typed fetch client over the Plan-4A routes
  stateBadge.ts          — badge colors/labels + actionability sort (pure)
  EngineDashboard.tsx    — "use client": session list, filters, create pickers (spec §7.1)
  [id]/
    page.tsx             — thin shell (await params → workspace)
    Workspace.tsx        — orchestrator: load, sticky header, sections, refresh (spec §7.4)
    autosaveCore.ts      — pure autosave state machine (spec §7.4 Autosave)
    useAutosave.ts       — debounced hook over autosaveCore + localStorage fallback
    FactsSection.tsx     — Section 1 (spec §7.4)
    PermissionsBar.tsx   — header permissions + revocation modal (spec §7.3)
    PhotosSection.tsx    — Section 2: upload → analyze loop (spec §7.4)
    GenerationSection.tsx — Section 3: package, per-type progress, sequencer (spec §7.4)
    ItemsSection.tsx     — Section 4: item cards + status actions (spec §7.4)
    editorsJournal.tsx   — journal editor fields
    editorsSimple.tsx    — portfolio / school / guide / testimonial / links editors
    ActionBar.tsx        — sticky bottom bar: approve-all, publish-approved (spec §7.4)
    PublicationHistory.tsx — Section 5 + takedown + revalidate (spec §7.4)
    ReconcileBanner.tsx  — §9.4 banner with link / mark_failed actions
lib/navConfig or admin nav — NOT touched (route reachable by URL; nav entry is a one-line
                             follow-up the user can place where they prefer)
tests/unit/stateBadge.test.ts · tests/unit/autosaveCore.test.ts
tests/integration/generate-skip.test.ts
docs/superpowers/2026-06-11-content-engine-manual-checklist.md — §13.4 + route-level checks
```

---

### Task 1: Server gap — Skip-failed-type route (spec §8.2 "Skip failed content type")

**Files:**
- Create: `app/api/admin/session-content/generate/skip/route.ts`
- Create: `tests/integration/generate-skip.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/integration/generate-skip.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage } from "./helpers";
import { skipFailedType } from "@/lib/contentEngine/skipType";

beforeAll(() => resetDb());

describe("skipFailedType (spec §8.2)", () => {
  it("marks a failed type skipped so the package can reach ready", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);
    // claim + fail journal; complete portfolio
    await service.rpc("claim_generation_type", { p_package_id: pkg, p_content_type: "journal_post", p_lease_seconds: 180 });
    await service.rpc("record_generation_result", { p_package_id: pkg, p_content_type: "journal_post", p_outcome: "failed", p_error: "model error", p_usage: null });
    await service.rpc("claim_generation_type", { p_package_id: pkg, p_content_type: "portfolio_pick", p_lease_seconds: 180 });
    await service.rpc("record_generation_result", { p_package_id: pkg, p_content_type: "portfolio_pick", p_outcome: "completed", p_error: null, p_usage: null });

    const result = await skipFailedType({ client: service, packageId: pkg, contentType: "journal_post" });
    expect(result.packageStatus).toBe("ready");

    const { data } = await service.from("session_content_packages")
      .select("status,generation_settings").eq("id", pkg).single();
    expect(data!.status).toBe("ready");
    expect(data!.generation_settings.progress.journal_post.status).toBe("skipped");
  });

  it("refuses to skip a type that is not failed", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    await expect(skipFailedType({ client: service, packageId: pkg, contentType: "journal_post" }))
      .rejects.toThrow(/cannot be skipped/i);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- generate-skip` → FAIL (module missing).

- [ ] **Step 3: Write the service** (`lib/contentEngine/skipType.ts` — add to Files)

```ts
// "Skip failed content type" (spec §8.2): marks a FAILED type 'skipped' via the
// record RPC (which allows skipped-from-failed) so the package can reach ready.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function skipFailedType(args: {
  client: SupabaseClient; packageId: string; contentType: string;
}): Promise<{ packageStatus: string }> {
  const { data, error } = await args.client.rpc("record_generation_result", {
    p_package_id: args.packageId,
    p_content_type: args.contentType,
    p_outcome: "skipped",
    p_error: null,
    p_usage: null,
  });
  if (error) throw new Error(error.message);
  return { packageStatus: data as string };
}
```

- [ ] **Step 4: Write the route** (`app/api/admin/session-content/generate/skip/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { skipFailedType } from "@/lib/contentEngine/skipType";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { GENERATABLE_CONTENT_TYPES } from "@/lib/contentEngine/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { packageId?: unknown; contentType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const packageId = typeof body.packageId === "string" ? body.packageId.toLowerCase() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  if (!isUuid(packageId)) return NextResponse.json({ error: "packageId must be a uuid" }, { status: 400 });
  if (!(GENERATABLE_CONTENT_TYPES as string[]).includes(contentType)) {
    return NextResponse.json({ error: "unknown content type" }, { status: 400 });
  }

  try {
    const result = await skipFailedType({ client: createSupabaseAdminClient(), packageId, contentType });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "skip failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
```

- [ ] **Step 5: Run** — `npm run test:integration -- generate-skip` → 2/2 PASS; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/skipType.ts app/api/admin/session-content/generate/skip/route.ts tests/integration/generate-skip.test.ts
git commit -m "feat: skip-failed-type route so packages can reach ready"
```

---

### Task 2: Types, API client, and state badges (pure layer)

**Files:**
- Create: `app/admin/content-engine/engineTypes.ts`
- Create: `app/admin/content-engine/engineApi.ts`
- Create: `app/admin/content-engine/stateBadge.ts`
- Create: `tests/unit/stateBadge.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/stateBadge.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { STATE_BADGES, actionabilityRank, sortByActionability } from "@/app/admin/content-engine/stateBadge";

describe("state badges (spec §7.1)", () => {
  it("has a badge for all ten derived states", () => {
    for (const s of ["failed", "publishing", "partially_published", "published", "reviewed",
                     "generated", "analyzing", "analyzed", "uploaded", "empty"]) {
      expect(STATE_BADGES[s as keyof typeof STATE_BADGES].label.length).toBeGreaterThan(0);
    }
  });

  it("default sort is by actionability: failed first, done last (spec §7.1)", () => {
    expect(actionabilityRank("failed")).toBeLessThan(actionabilityRank("reviewed"));
    expect(actionabilityRank("reviewed")).toBeLessThan(actionabilityRank("generated"));
    expect(actionabilityRank("generated")).toBeLessThan(actionabilityRank("analyzing"));
    expect(actionabilityRank("uploaded")).toBeLessThan(actionabilityRank("published"));

    const rows = [
      { id: "a", state: "published" }, { id: "b", state: "failed" }, { id: "c", state: "generated" },
    ] as { id: string; state: keyof typeof STATE_BADGES }[];
    expect(sortByActionability(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- stateBadge` → FAIL.

- [ ] **Step 3: Write the types** (`app/admin/content-engine/engineTypes.ts`)

```ts
// DTO types for the engine admin UI — shapes mirror the Plan-4A route payloads.
import type { SessionEngineState } from "@/lib/contentEngine/state";

export type { SessionEngineState };

export interface EngineSessionRow {
  id: string;
  public_display_name: string | null;
  internal_client_name: string | null;
  service_type: string;
  school_slug: string | null;
  session_date: string | null;
  marketing_permission: boolean;
  ai_processing_allowed: boolean;
  created_at: string;
  state: SessionEngineState;
  photoCount: number;
  itemCounts: Record<string, number>;
  activePackageId: string | null;
}

export interface EnginePhoto {
  id: string;
  storage_path: string;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  excluded: boolean;
  analysis_status: "pending" | "processing" | "completed" | "failed" | "skipped";
  analysis_error: string | null;
  analysis_lease_expires_at: string | null;
  analysis_attempt: number;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  quality_score: number | null;
  suggested_category: string | null;
  destination_recommendations: Record<string, boolean> | null;
  public_derivative_url: string | null;
  thumbnailUrl: string | null;
  created_at: string;
}

export interface EngineItem {
  id: string;
  package_id: string;
  content_type: string;
  status: "draft" | "approved" | "rejected" | "publishing" | "published" | "failed";
  payload: Record<string, unknown>;
  payload_revision: number;
  generation_model: string | null;
  prompt_version: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  published_target_type: string | null;
  published_target_id: string | null;
  published_ref: Record<string, unknown> | null;
  published_at: string | null;
  error: string | null;
  created_at: string;
}

export interface EnginePackage {
  id: string;
  generation_number: number;
  status: "generating" | "ready" | "needs_attention" | "failed" | "archived";
  model_name: string;
  prompt_version: string;
  generation_settings: {
    selected_types?: string[];
    progress?: Record<string, {
      status: "pending" | "processing" | "completed" | "failed" | "skipped";
      attempt: number;
      error: string | null;
      usage: { model: string; input_tokens: number; output_tokens: number } | null;
    }>;
  };
  created_at: string;
}

export interface WorkspaceData {
  session: Record<string, unknown> & {
    id: string;
    public_display_name: string | null;
    service_type: string;
    school_slug: string | null;
    marketing_permission: boolean;
    ai_processing_allowed: boolean;
  };
  activePackage: EnginePackage | null;
  items: EngineItem[];
  published: EngineItem[];
  state: SessionEngineState;
  photoCount: number;
  itemCounts: Record<string, number>;
  activePackageId: string | null;
}

export interface ReconcileReport {
  stuckPublishing: { itemId: string; contentType: string; publishingStartedAt: string }[];
  failedWithExistingTarget: {
    itemId: string; contentType: string; targetType: string; targetId: string;
    autoConfirmable: boolean; proof: string;
  }[];
  orphanedDerivatives: { photoId: string; url: string }[];
}

export const GENERATION_ORDER = [
  "internal_link_suggestion", "testimonial_feature", "portfolio_pick",
  "school_page_photo", "guide_photo", "journal_post",
] as const;

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  journal_post: "Journal post",
  portfolio_pick: "Portfolio pick",
  school_page_photo: "School page photo",
  guide_photo: "Guide photo",
  testimonial_feature: "Testimonial",
  internal_link_suggestion: "Internal links",
};
```

- [ ] **Step 4: Write the API client** (`app/admin/content-engine/engineApi.ts`)

```ts
// Typed fetch client over the Plan-4A engine routes. Cookie auth rides along
// automatically (same-origin). Every helper throws EngineApiError with the
// server's message and status so callers can branch on status (409 protocols).
import type {
  EngineSessionRow, EnginePhoto, WorkspaceData, ReconcileReport,
} from "./engineTypes";

export class EngineApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : `request failed (${status})`);
    this.name = "EngineApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new EngineApiError(res.status, body);
  return body as T;
}

export const engineApi = {
  listSessions: () =>
    request<{ sessions: EngineSessionRow[] }>("/api/admin/session-content/sessions"),
  createSession: (input: { clientSessionId?: string; serviceType?: string }) =>
    request<{ sessionId: string }>("/api/admin/session-content/sessions", {
      method: "POST", body: JSON.stringify(input),
    }),
  getWorkspace: (sessionId: string) =>
    request<WorkspaceData>(`/api/admin/session-content/sessions/${sessionId}`),
  patchFacts: (sessionId: string, facts: Record<string, unknown>) =>
    request<{ updated: boolean }>(`/api/admin/session-content/sessions/${sessionId}`, {
      method: "PATCH", body: JSON.stringify(facts),
    }),
  patchPermissions: (sessionId: string, body: Record<string, unknown>) =>
    request<{ outcome: string }>(`/api/admin/session-content/sessions/${sessionId}/permissions`, {
      method: "PATCH", body: JSON.stringify(body),
    }),
  listPhotos: (sessionId: string) =>
    request<{ photos: EnginePhoto[] }>(`/api/admin/session-content/photos?sessionId=${sessionId}`),
  patchPhoto: (photoId: string, patch: Record<string, unknown>) =>
    request<{ updated: boolean }>(`/api/admin/session-content/photos/${photoId}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),
  signUpload: (sessionId: string, file: { mime: string; sizeBytes: number }) =>
    request<{ bucket: string; path: string; token: string; signedUrl: string }>(
      "/api/admin/session-content/photos/sign",
      { method: "POST", body: JSON.stringify({ sessionId, mime: file.mime, sizeBytes: file.sizeBytes }) },
    ),
  finalizeUpload: (sessionId: string, storagePath: string, declared: {
    filename: string; mime: string; sizeBytes: number; contentHash?: string;
  }) =>
    request<{ photo: { id: string } }>("/api/admin/session-content/photos/finalize", {
      method: "POST",
      body: JSON.stringify({ sessionId, storagePath, ...declared }),
    }),
  analyzeBatch: (sessionId: string) =>
    request<{ claimed: number; completed: number; failed: number; remaining: number }>(
      "/api/admin/session-content/photos/analyze",
      { method: "POST", body: JSON.stringify({ sessionId }) },
    ),
  createPackage: (sessionId: string, selectedTypes: string[], opts?: {
    archiveCurrent?: boolean; copyItems?: { item_id: string; preserve_approval: boolean }[];
  }) =>
    request<{ packageId: string }>("/api/admin/session-content/packages", {
      method: "POST",
      body: JSON.stringify({
        sessionId, selectedTypes,
        archiveCurrent: opts?.archiveCurrent ?? false,
        copyItems: opts?.copyItems ?? [],
      }),
    }),
  generateType: (packageId: string, contentType: string) =>
    request<{ outcome: string; itemIds: string[]; packageStatus: string; error?: string }>(
      "/api/admin/session-content/generate",
      { method: "POST", body: JSON.stringify({ packageId, contentType }) },
    ),
  skipType: (packageId: string, contentType: string) =>
    request<{ packageStatus: string }>("/api/admin/session-content/generate/skip", {
      method: "POST", body: JSON.stringify({ packageId, contentType }),
    }),
  autosaveItem: (itemId: string, payload: Record<string, unknown>, payloadRevision: number) =>
    request<{ outcome: "saved"; payloadRevision: number }>(
      `/api/admin/session-content/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify({ payload, payloadRevision }) },
    ),
  itemStatus: (itemId: string, action: "approve" | "reject" | "unreject", reason?: string) =>
    request<{ outcome: string; status: string }>(`/api/admin/session-content/items/${itemId}/status`, {
      method: "POST", body: JSON.stringify({ action, reason }),
    }),
  publish: (itemId: string) =>
    request<{ status: "published"; targetType: string; targetId: string | null;
              revalidated: string[]; revalidationFailures: string[] }>(
      "/api/admin/session-content/publish",
      { method: "POST", body: JSON.stringify({ itemId }) },
    ),
  takedown: (itemId: string) =>
    request<{ removed: boolean; derivativesDeleted: string[] }>("/api/admin/session-content/takedown", {
      method: "POST", body: JSON.stringify({ itemId }),
    }),
  reconcile: (sessionId: string) =>
    request<ReconcileReport>(`/api/admin/session-content/reconcile?sessionId=${sessionId}`),
  reconcileAction: (body: Record<string, unknown>) =>
    request<{ linked?: boolean; marked?: boolean }>("/api/admin/session-content/reconcile", {
      method: "POST", body: JSON.stringify(body),
    }),
  revalidateAll: () => request<{ revalidated: boolean }>("/api/admin/revalidate", { method: "POST" }),
};
```

- [ ] **Step 5: Write the badge module** (`app/admin/content-engine/stateBadge.ts`)

```ts
// Derived-state badges + the spec §7.1 actionability sort:
// failed/interrupted → approved-waiting → drafts-for-review → in-progress →
// uploaded-not-analyzed → done.
import { C } from "@/lib/colors";
import type { SessionEngineState } from "@/lib/contentEngine/state";

export const STATE_BADGES: Record<SessionEngineState, { label: string; color: string; bg: string }> = {
  failed:              { label: "Failed",            color: C.danger,   bg: C.dangerBg ?? "#fdecea" },
  publishing:          { label: "Publishing…",       color: C.ink,      bg: C.pageAlt },
  partially_published: { label: "Partly published",  color: C.ink,      bg: C.pageAlt },
  published:           { label: "Published",         color: C.muted,    bg: C.page },
  reviewed:            { label: "Reviewed",          color: C.ink,      bg: C.pageAlt },
  generated:           { label: "Drafts ready",      color: C.ink,      bg: C.pageAlt },
  analyzing:           { label: "Analyzing…",        color: C.ink,      bg: C.pageAlt },
  analyzed:            { label: "Analyzed",          color: C.ink,      bg: C.pageAlt },
  uploaded:            { label: "Uploaded",          color: C.ink,      bg: C.pageAlt },
  empty:               { label: "Empty",             color: C.muted,    bg: C.page },
};

const RANK: Record<SessionEngineState, number> = {
  failed: 0, publishing: 1, reviewed: 2, generated: 3,
  partially_published: 4, analyzing: 5, analyzed: 6, uploaded: 7,
  published: 8, empty: 9,
};

export function actionabilityRank(state: SessionEngineState): number {
  return RANK[state];
}

export function sortByActionability<T extends { state: SessionEngineState }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => actionabilityRank(a.state) - actionabilityRank(b.state));
}
```

NOTE: check `lib/colors.ts` for the exact `C` keys — if `C.dangerBg`/`C.pageAlt`/`C.page` don't exist under those names, use the nearest existing keys (e.g. `C.bgAlt`, `C.cardBg`) and keep the `??` fallback only where a key is genuinely absent. NO hardcoded hex beyond a fallback literal already present in the file's pattern.

- [ ] **Step 6: Run** — `npm test -- stateBadge` → PASS; `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add app/admin/content-engine/engineTypes.ts app/admin/content-engine/engineApi.ts app/admin/content-engine/stateBadge.ts tests/unit/stateBadge.test.ts
git commit -m "feat: engine UI types, API client, and actionability badges"
```

---

### Task 3: Autosave core + hook (spec §7.4 Autosave)

**Files:**
- Create: `app/admin/content-engine/[id]/autosaveCore.ts`
- Create: `app/admin/content-engine/[id]/useAutosave.ts`
- Create: `tests/unit/autosaveCore.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/autosaveCore.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  initialAutosaveState, autosaveReducer, draftStorageKey,
} from "@/app/admin/content-engine/[id]/autosaveCore";

describe("autosaveCore (spec §7.4 Autosave states)", () => {
  it("edit → saving → saved transitions with revision tracking", () => {
    let s = initialAutosaveState(3);
    expect(s.status).toBe("idle");
    s = autosaveReducer(s, { type: "edited" });
    expect(s.status).toBe("editing");
    expect(s.dirty).toBe(true);
    s = autosaveReducer(s, { type: "save_started" });
    expect(s.status).toBe("saving");
    s = autosaveReducer(s, { type: "save_succeeded", payloadRevision: 4, at: "3:42pm" });
    expect(s.status).toBe("saved");
    expect(s.revision).toBe(4);
    expect(s.dirty).toBe(false);
    expect(s.savedAt).toBe("3:42pm");
  });

  it("an edit DURING a save keeps the state dirty after success", () => {
    let s = initialAutosaveState(1);
    s = autosaveReducer(s, { type: "edited" });
    s = autosaveReducer(s, { type: "save_started" });
    s = autosaveReducer(s, { type: "edited" }); // keystroke while in flight
    s = autosaveReducer(s, { type: "save_succeeded", payloadRevision: 2, at: "now" });
    expect(s.dirty).toBe(true); // needs another save
    expect(s.revision).toBe(2);
  });

  it("save failure preserves the local backup flag", () => {
    let s = initialAutosaveState(1);
    s = autosaveReducer(s, { type: "edited" });
    s = autosaveReducer(s, { type: "save_started" });
    s = autosaveReducer(s, { type: "save_failed", message: "network down" });
    expect(s.status).toBe("save_failed");
    expect(s.dirty).toBe(true);
    expect(s.error).toBe("network down");
  });

  it("conflict carries the server copy for the comparison prompt", () => {
    let s = initialAutosaveState(1);
    s = autosaveReducer(s, { type: "edited" });
    s = autosaveReducer(s, { type: "save_started" });
    s = autosaveReducer(s, {
      type: "conflict",
      server: { payload: { x: 1 }, payload_revision: 5, status: "draft" },
    });
    expect(s.status).toBe("conflict");
    expect(s.conflict!.payload_revision).toBe(5);
    // resolving with the server copy adopts its revision and clears dirty
    s = autosaveReducer(s, { type: "conflict_resolved", adopt: "server" });
    expect(s.status).toBe("idle");
    expect(s.revision).toBe(5);
    expect(s.dirty).toBe(false);
    // resolving keep-mine keeps dirty so the next tick re-saves at the new revision
    let k = initialAutosaveState(1);
    k = autosaveReducer(k, { type: "edited" });
    k = autosaveReducer(k, { type: "save_started" });
    k = autosaveReducer(k, {
      type: "conflict",
      server: { payload: { x: 1 }, payload_revision: 5, status: "draft" },
    });
    k = autosaveReducer(k, { type: "conflict_resolved", adopt: "mine" });
    expect(k.revision).toBe(5); // rebases onto the server revision
    expect(k.dirty).toBe(true);
  });

  it("uses the spec localStorage key pattern", () => {
    expect(draftStorageKey("abc")).toBe("draft_abc");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- autosaveCore` → FAIL.

- [ ] **Step 3: Write the core** (`app/admin/content-engine/[id]/autosaveCore.ts`)

```ts
// Pure autosave state machine (spec §7.4 Autosave): Editing… / Saving… /
// Saved <time> / Save failed — local backup preserved / conflict (409 with the
// server copy for an explicit comparison prompt). The hook owns timers and IO;
// this reducer owns every transition so it is unit-testable.
export interface ServerCopy {
  payload: Record<string, unknown>;
  payload_revision: number;
  status: string;
}

export type AutosaveStatus = "idle" | "editing" | "saving" | "saved" | "save_failed" | "conflict";

export interface AutosaveState {
  status: AutosaveStatus;
  revision: number;
  dirty: boolean;
  savedAt: string | null;
  error: string | null;
  conflict: ServerCopy | null;
}

export type AutosaveEvent =
  | { type: "edited" }
  | { type: "save_started" }
  | { type: "save_succeeded"; payloadRevision: number; at: string }
  | { type: "save_failed"; message: string }
  | { type: "conflict"; server: ServerCopy }
  | { type: "conflict_resolved"; adopt: "server" | "mine" };

export function initialAutosaveState(revision: number): AutosaveState {
  return { status: "idle", revision, dirty: false, savedAt: null, error: null, conflict: null };
}

export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (event.type) {
    case "edited":
      // a keystroke during an in-flight save must leave dirty=true afterwards
      return { ...state, dirty: true, status: state.status === "saving" ? "saving" : "editing" };
    case "save_started":
      return { ...state, status: "saving", dirty: false, error: null };
    case "save_succeeded":
      return {
        ...state,
        status: state.dirty ? "editing" : "saved",
        revision: event.payloadRevision,
        savedAt: event.at,
        error: null,
      };
    case "save_failed":
      return { ...state, status: "save_failed", dirty: true, error: event.message };
    case "conflict":
      return { ...state, status: "conflict", dirty: true, conflict: event.server };
    case "conflict_resolved": {
      const revision = state.conflict?.payload_revision ?? state.revision;
      if (event.adopt === "server") {
        return { ...state, status: "idle", revision, dirty: false, conflict: null, error: null };
      }
      // keep mine: rebase onto the server revision; stay dirty so the next
      // debounce tick overwrites deliberately (user confirmed via the prompt)
      return { ...state, status: "editing", revision, dirty: true, conflict: null, error: null };
    }
  }
}

// spec §7.4: localStorage fallback key pattern (AGENTS.md convention)
export function draftStorageKey(itemId: string): string {
  return `draft_${itemId}`;
}
```

- [ ] **Step 4: Run** — `npm test -- autosaveCore` → PASS.

- [ ] **Step 5: Write the hook** (`app/admin/content-engine/[id]/useAutosave.ts`)

```ts
"use client";
// Debounced (~1.5s) server-backed autosave over autosaveCore (spec §7.4).
// localStorage draft_${itemId} is a TEMPORARY fallback: written while a save is
// pending or failed, cleared on confirmed save.
import { useCallback, useEffect, useRef, useState } from "react";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import {
  autosaveReducer, initialAutosaveState, draftStorageKey,
  type AutosaveState, type ServerCopy,
} from "./autosaveCore";

export const AUTOSAVE_DEBOUNCE_MS = 1500;

export interface UseAutosaveResult {
  state: AutosaveState;
  payload: Record<string, unknown>;
  edit: (next: Record<string, unknown>) => void;
  saveNow: () => void;
  resolveConflict: (adopt: "server" | "mine") => void;
}

export function useAutosave(
  itemId: string,
  initialPayload: Record<string, unknown>,
  initialRevision: number,
  onStatusReset?: () => void,
): UseAutosaveResult {
  const [payload, setPayload] = useState(initialPayload);
  const [state, setState] = useState<AutosaveState>(() => initialAutosaveState(initialRevision));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef(payload);
  const stateRef = useRef(state);
  payloadRef.current = payload;
  stateRef.current = state;

  const dispatch = useCallback((event: Parameters<typeof autosaveReducer>[1]) => {
    setState((s) => autosaveReducer(s, event));
  }, []);

  const persistLocal = useCallback((p: Record<string, unknown>) => {
    try {
      localStorage.setItem(draftStorageKey(itemId), JSON.stringify(p));
    } catch { /* quota errors are non-fatal: the server copy is authoritative */ }
  }, [itemId]);

  const clearLocal = useCallback(() => {
    try { localStorage.removeItem(draftStorageKey(itemId)); } catch { /* ignore */ }
  }, [itemId]);

  const runSave = useCallback(async () => {
    const current = stateRef.current;
    if (current.status === "saving" || current.status === "conflict") return;
    dispatch({ type: "save_started" });
    try {
      const result = await engineApi.autosaveItem(itemId, payloadRef.current, current.revision);
      dispatch({
        type: "save_succeeded",
        payloadRevision: result.payloadRevision,
        at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
      if (!stateRef.current.dirty) clearLocal();
      onStatusReset?.(); // editing an approved item reverts it to draft server-side
    } catch (err) {
      if (err instanceof EngineApiError && err.status === 409 && err.body.outcome === "conflict") {
        dispatch({ type: "conflict", server: err.body.server as ServerCopy });
        return;
      }
      const message = err instanceof Error ? err.message : "save failed";
      dispatch({ type: "save_failed", message });
      persistLocal(payloadRef.current); // local backup preserved
    }
  }, [itemId, dispatch, clearLocal, persistLocal, onStatusReset]);

  const edit = useCallback((next: Record<string, unknown>) => {
    setPayload(next);
    dispatch({ type: "edited" });
    persistLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void runSave(); }, AUTOSAVE_DEBOUNCE_MS);
  }, [dispatch, persistLocal, runSave]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void runSave();
  }, [runSave]);

  const resolveConflict = useCallback((adopt: "server" | "mine") => {
    const server = stateRef.current.conflict;
    dispatch({ type: "conflict_resolved", adopt });
    if (adopt === "server" && server) {
      setPayload(server.payload);
      clearLocal();
    } else if (adopt === "mine") {
      // stay dirty: schedule an immediate deliberate overwrite at the rebased revision
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void runSave(); }, 0);
    }
  }, [dispatch, clearLocal, runSave]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { state, payload, edit, saveNow, resolveConflict };
}
```

- [ ] **Step 6: Run** — `npm test -- autosaveCore` PASS again; `npx tsc --noEmit` clean (the hook compiles; it has no unit test — its logic lives in the reducer).

- [ ] **Step 7: Commit**

```bash
git add "app/admin/content-engine/[id]/autosaveCore.ts" "app/admin/content-engine/[id]/useAutosave.ts" tests/unit/autosaveCore.test.ts
git commit -m "feat: autosave state machine and debounced hook with conflict protocol"
```

---

### Task 4: Session list dashboard (spec §7.1)

**Files:**
- Create: `app/admin/content-engine/page.tsx`
- Create: `app/admin/content-engine/EngineDashboard.tsx`

- [ ] **Step 1: Write the page shell** (`app/admin/content-engine/page.tsx`)

```tsx
import type { Metadata } from "next";
import EngineDashboard from "@/app/admin/content-engine/EngineDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Engine",
  description: "Session-to-marketing content workflow.",
};

export default function ContentEnginePage() {
  return <EngineDashboard />;
}
```

- [ ] **Step 2: Write the dashboard** (`app/admin/content-engine/EngineDashboard.tsx`)

```tsx
"use client";
// Session list (spec §7.1): derived-state badges, filters, actionability sort,
// "New from client session" picker (conflict opens the existing workspace) and
// "Blank session". Mirrors the /admin/sessions dashboard conventions.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { C } from "@/lib/colors";
import { checkAuth } from "@/lib/adminAuth";
import { engineApi, EngineApiError } from "./engineApi";
import { STATE_BADGES, sortByActionability } from "./stateBadge";
import { SERVICE_TYPES } from "@/lib/contentEngine/taxonomy";
import type { EngineSessionRow, SessionEngineState } from "./engineTypes";

type ClientSessionOption = { id: string; clientName: string | null; sessionType: string | null; currentStatus: string };

const card: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.warmEdge}`, borderRadius: 12, padding: 16,
};

export default function EngineDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<EngineSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<SessionEngineState | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [showPicker, setShowPicker] = useState(false);
  const [clientSessions, setClientSessions] = useState<ClientSessionOption[]>([]);
  const [blankType, setBlankType] = useState<string>("grads");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { sessions } = await engineApi.listSessions();
      setRows(sessions);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!checkAuth()) {
      router.replace("/admin");
      return;
    }
    void load();
  }, [router, load]);

  const openPicker = useCallback(async () => {
    setShowPicker(true);
    try {
      const res = await fetch("/api/admin/sessions");
      const body = (await res.json()) as { sessions?: { id: string; clientName: string | null; sessionType: string | null; currentStatus: string }[] };
      // session_completed and later are eligible (spec §7.1)
      const DONE = ["session_completed", "photos_backed_up", "culling", "editing", "final_review", "delivered"];
      setClientSessions((body.sessions ?? [])
        .filter((s) => DONE.includes(s.currentStatus))
        .map((s) => ({ id: s.id, clientName: s.clientName, sessionType: s.sessionType, currentStatus: s.currentStatus })));
    } catch {
      setNotice("could not load client sessions");
    }
  }, []);

  const createFrom = useCallback(async (clientSessionId?: string) => {
    try {
      const created = clientSessionId
        ? await engineApi.createSession({ clientSessionId })
        : await engineApi.createSession({ serviceType: blankType });
      router.push(`/admin/content-engine/${created.sessionId}`);
    } catch (err) {
      if (err instanceof EngineApiError && err.status === 409 && typeof err.body.existingSessionId === "string") {
        // DB-enforced: open the existing session (spec §7.1)
        router.push(`/admin/content-engine/${err.body.existingSessionId}`);
        return;
      }
      setNotice(err instanceof Error ? err.message : "could not create session");
    }
  }, [router, blankType]);

  const visible = useMemo(() => {
    const filtered = rows.filter((r) =>
      (stateFilter === "all" || r.state === stateFilter)
      && (serviceFilter === "all" || r.service_type === serviceFilter));
    return sortByActionability(filtered);
  }, [rows, stateFilter, serviceFilter]);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: C.ink }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Content Engine</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void openPicker()} style={btn(true)}>New from client session</button>
          <select value={blankType} onChange={(e) => setBlankType(e.target.value)} style={input}>
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => void createFrom()} style={btn(false)}>Blank session</button>
        </div>
      </header>

      {notice && (
        <p role="alert" style={{ color: C.danger, marginBottom: 12 }}>
          {notice} <button onClick={() => setNotice(null)} style={btn(false)}>dismiss</button>
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as SessionEngineState | "all")} style={input}>
          <option value="all">All states</option>
          {Object.entries(STATE_BADGES).map(([s, b]) => <option key={s} value={s}>{b.label}</option>)}
        </select>
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} style={input}>
          <option value="all">All services</option>
          {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <p>Loading…</p> : visible.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.muted }}>
          No sessions yet — create one from a completed client session.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((row) => {
            const badge = STATE_BADGES[row.state];
            return (
              <Link key={row.id} href={`/admin/content-engine/${row.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{row.public_display_name ?? row.internal_client_name ?? "Untitled session"}</strong>
                    <span style={{ color: C.muted, marginLeft: 8 }}>
                      {row.service_type}{row.school_slug ? ` · ${row.school_slug}` : ""}{row.session_date ? ` · ${row.session_date}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>
                      {row.photoCount} photos
                      {!row.marketing_permission && " · no marketing ✋"}
                      {!row.ai_processing_allowed && " · no AI"}
                    </span>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "2px 10px", fontSize: 12 }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div style={overlay} onClick={() => setShowPicker(false)}>
          <div style={{ ...card, maxWidth: 520, width: "100%", maxHeight: "70vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Pick a completed client session</h2>
            {clientSessions.length === 0 ? <p style={{ color: C.muted }}>No completed client sessions found.</p> : (
              clientSessions.map((cs) => (
                <button key={cs.id} onClick={() => void createFrom(cs.id)}
                  style={{ ...btn(false), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
                  {cs.clientName ?? "Unnamed"} — {cs.sessionType ?? "?"} <span style={{ color: C.muted }}>({cs.currentStatus})</span>
                </button>
              ))
            )}
            <button onClick={() => setShowPicker(false)} style={btn(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

const input: React.CSSProperties = {
  border: `1px solid ${C.warmEdge}`, borderRadius: 8, padding: "6px 10px", background: C.white, color: C.ink,
};
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};
function btn(primary: boolean): React.CSSProperties {
  return {
    border: `1px solid ${C.warmEdge}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
    background: primary ? C.ink : C.white, color: primary ? C.white : C.ink, fontSize: 13,
  };
}
```

NOTE: confirm the actual `C` keys (`C.white`, `C.ink`, `C.muted`, `C.danger`, `C.warmEdge`, `C.page`, `C.pageAlt`) against `lib/colors.ts` — those names appear in its source; adapt any that differ. The `/api/admin/sessions` GET returns `{ sessions: AdminClientSessionDTO[] }` with camelCase fields (`clientName`, `sessionType`, `currentStatus`) — verify against `lib/clientSessions.ts` `toAdminClientSessionDTO` and adapt field names if they differ.

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint app/admin/content-engine` clean; `npm run dev` smoke-load `/admin/content-engine` if quick (optional — the manual checklist covers it).

- [ ] **Step 4: Commit**

```bash
git add app/admin/content-engine/page.tsx app/admin/content-engine/EngineDashboard.tsx
git commit -m "feat: content engine session list with pickers and actionability sort"
```

---

### Task 5: Workspace shell + facts + permissions (spec §7.4 Sections 1, §7.3)

**Files:**
- Create: `app/admin/content-engine/[id]/page.tsx`
- Create: `app/admin/content-engine/[id]/Workspace.tsx`
- Create: `app/admin/content-engine/[id]/FactsSection.tsx`
- Create: `app/admin/content-engine/[id]/PermissionsBar.tsx`
- Create: `app/admin/content-engine/[id]/ui.ts` (tiny shared style constants for the workspace files)

- [ ] **Step 1: Write the shared styles** (`app/admin/content-engine/[id]/ui.ts`)

```ts
import { C } from "@/lib/colors";
import type { CSSProperties } from "react";

export const card: CSSProperties = {
  background: C.white, border: `1px solid ${C.warmEdge}`, borderRadius: 12, padding: 16, marginBottom: 16,
};
export const input: CSSProperties = {
  border: `1px solid ${C.warmEdge}`, borderRadius: 8, padding: "6px 10px",
  background: C.white, color: C.ink, fontSize: 13, width: "100%", boxSizing: "border-box",
};
export const label: CSSProperties = { fontSize: 12, color: C.muted, display: "block", marginBottom: 2 };
export function btn(primary = false, danger = false): CSSProperties {
  return {
    border: `1px solid ${danger ? C.danger : C.warmEdge}`, borderRadius: 8, padding: "6px 12px",
    cursor: "pointer", fontSize: 13,
    background: danger ? C.white : primary ? C.ink : C.white,
    color: danger ? C.danger : primary ? C.white : C.ink,
  };
}
export const chip = (color: string, bg: string): CSSProperties => ({
  background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12, whiteSpace: "nowrap",
});
export const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};
export const sectionTitle: CSSProperties = { fontSize: 16, margin: "0 0 10px" };
```

- [ ] **Step 2: Write the page shell** (`app/admin/content-engine/[id]/page.tsx`)

```tsx
import type { Metadata } from "next";
import Workspace from "@/app/admin/content-engine/[id]/Workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Content Engine Session" };

export default async function ContentEngineSessionPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return <Workspace sessionId={id} />;
}
```

- [ ] **Step 3: Write the orchestrator** (`app/admin/content-engine/[id]/Workspace.tsx`)

```tsx
"use client";
// Workspace (spec §7.4): sticky header (name, type, state, permissions),
// single-scroll sections gating top-to-bottom, sticky bottom action bar.
// All durable state is server rows; refresh() refetches everything.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { C } from "@/lib/colors";
import { checkAuth } from "@/lib/adminAuth";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { STATE_BADGES } from "@/app/admin/content-engine/stateBadge";
import type { EnginePhoto, WorkspaceData } from "@/app/admin/content-engine/engineTypes";
import { chip } from "./ui";
import FactsSection from "./FactsSection";
import PermissionsBar from "./PermissionsBar";
import PhotosSection from "./PhotosSection";
import GenerationSection from "./GenerationSection";
import ItemsSection from "./ItemsSection";
import ActionBar from "./ActionBar";
import PublicationHistory from "./PublicationHistory";
import ReconcileBanner from "./ReconcileBanner";

export default function Workspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [photos, setPhotos] = useState<EnginePhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [workspace, photoList] = await Promise.all([
        engineApi.getWorkspace(sessionId),
        engineApi.listPhotos(sessionId),
      ]);
      setData(workspace);
      setPhotos(photoList.photos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load session");
    }
  }, [sessionId]);

  useEffect(() => {
    if (!checkAuth()) {
      router.replace("/admin");
      return;
    }
    void refresh();
  }, [router, refresh]);

  if (error) {
    return <main style={{ padding: 24, color: C.danger }}>{error}</main>;
  }
  if (!data) {
    return <main style={{ padding: 24, color: C.muted }}>Loading…</main>;
  }

  const badge = STATE_BADGES[data.state];
  const session = data.session;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "0 24px 96px", color: C.ink }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 20, background: C.page,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 0", borderBottom: `1px solid ${C.warmEdge}`, marginBottom: 16,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>
            {(session.public_display_name as string) ?? "Untitled session"}
          </h1>
          <span style={{ color: C.muted, fontSize: 13 }}>
            {session.service_type as string}
            {session.school_slug ? ` · ${session.school_slug as string}` : ""}
            {data.activePackage ? ` · package #${data.activePackage.generation_number}` : ""}
          </span>
        </div>
        <span style={chip(badge.color, badge.bg)}>{badge.label}</span>
      </header>

      <ReconcileBanner sessionId={sessionId} onChanged={refresh} />
      <PermissionsBar session={session} sessionId={sessionId} onChanged={refresh} />
      <FactsSection session={session} sessionId={sessionId} onSaved={refresh} />
      <PhotosSection sessionId={sessionId} photos={photos}
        aiAllowed={session.ai_processing_allowed} onChanged={refresh} />
      <GenerationSection sessionId={sessionId} activePackage={data.activePackage}
        items={data.items} aiAllowed={session.ai_processing_allowed}
        photos={photos} onChanged={refresh} />
      <ItemsSection items={data.items} photos={photos} onChanged={refresh} />
      <PublicationHistory published={data.published} onChanged={refresh} />
      <ActionBar items={data.items}
        marketingPermission={session.marketing_permission} onChanged={refresh} />
    </main>
  );
}
```

- [ ] **Step 4: Write the facts section** (`app/admin/content-engine/[id]/FactsSection.tsx`)

```tsx
"use client";
// Section 1 — Session facts (spec §7.4): editable fields; saving commits values.
// Taxonomy-invalid slugs are rejected server-side (422) and surfaced inline.
import { useState } from "react";
import { C } from "@/lib/colors";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { SERVICE_TYPES, SCHOOL_SLUGS, LIGHTING_CONDITIONS } from "@/lib/contentEngine/taxonomy";
import { btn, card, input, label, sectionTitle } from "./ui";

interface Props {
  session: Record<string, unknown>;
  sessionId: string;
  onSaved: () => void;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export default function FactsSection({ session, sessionId, onSaved }: Props) {
  const [form, setForm] = useState({
    public_display_name: text(session.public_display_name),
    internal_client_name: text(session.internal_client_name),
    service_type: text(session.service_type) || "grads",
    school_slug: text(session.school_slug),
    primary_location: text(session.primary_location),
    session_date: text(session.session_date),
    lighting_condition: text(session.lighting_condition),
    public_session_summary: text(session.public_session_summary),
    internal_notes: text(session.internal_notes),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await engineApi.patchFacts(sessionId, {
        ...form,
        school_slug: form.school_slug || null,
        lighting_condition: form.lighting_condition || null,
        session_date: form.session_date || null,
      });
      setNotice("Saved.");
      onSaved();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Session facts</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div>
          <span style={label}>Public display name (may appear in published copy)</span>
          <input style={input} value={form.public_display_name} onChange={set("public_display_name")} />
        </div>
        <div>
          <span style={label}>Internal client name (never published)</span>
          <input style={input} value={form.internal_client_name} onChange={set("internal_client_name")} />
        </div>
        <div>
          <span style={label}>Service type</span>
          <select style={input} value={form.service_type} onChange={set("service_type")}>
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>School</span>
          <select style={input} value={form.school_slug} onChange={set("school_slug")}>
            <option value="">— none —</option>
            {SCHOOL_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Primary location</span>
          <input style={input} value={form.primary_location} onChange={set("primary_location")} />
        </div>
        <div>
          <span style={label}>Session date</span>
          <input style={input} type="date" value={form.session_date} onChange={set("session_date")} />
        </div>
        <div>
          <span style={label}>Lighting</span>
          <select style={input} value={form.lighting_condition} onChange={set("lighting_condition")}>
            <option value="">— unknown —</option>
            {LIGHTING_CONDITIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={label}>Public session summary (may be sent to AI)</span>
        <textarea style={{ ...input, minHeight: 56 }} value={form.public_session_summary} onChange={set("public_session_summary")} />
        <span style={label}>Internal notes (never sent to AI, never published)</span>
        <textarea style={{ ...input, minHeight: 56 }} value={form.internal_notes} onChange={set("internal_notes")} />
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button style={btn(true)} onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save facts"}
        </button>
        {notice && <span style={{ fontSize: 13, color: notice === "Saved." ? C.muted : C.danger }}>{notice}</span>}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Write the permissions bar** (`app/admin/content-engine/[id]/PermissionsBar.tsx`)

```tsx
"use client";
// Permissions header (spec §7.3): two SEPARATE controls with source/basis
// dropdowns and auto-stamped confirmations. Revoking marketing permission with
// live published content opens the blocking modal (server 409 acknowledgement
// protocol): Cancel / Disable future publishing only. Takedown stays per-item
// in Publication history.
import { useState } from "react";
import { C } from "@/lib/colors";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS } from "@/app/admin/content-engine/engineTypes";
import { btn, card, input, label, overlay, sectionTitle } from "./ui";

const MARKETING_SOURCES = ["contract", "email", "testimonial_form", "manual_confirmation", "portfolio_collaboration"];
const AI_BASES = ["contract", "privacy_policy", "portfolio_collaboration", "manual_confirmation", "internal_business_policy"];

interface Props {
  session: Record<string, unknown>;
  sessionId: string;
  onChanged: () => void;
}

export default function PermissionsBar({ session, sessionId, onChanged }: Props) {
  const [marketingSource, setMarketingSource] = useState(MARKETING_SOURCES[3]);
  const [aiBasis, setAiBasis] = useState(AI_BASES[3]);
  const [notice, setNotice] = useState<string | null>(null);
  const [revokeCounts, setRevokeCounts] = useState<Record<string, number> | null>(null);

  const marketingOn = session.marketing_permission === true;
  const aiOn = session.ai_processing_allowed === true;

  const patch = async (body: Record<string, unknown>) => {
    setNotice(null);
    try {
      await engineApi.patchPermissions(sessionId, body);
      onChanged();
    } catch (err) {
      if (err instanceof EngineApiError && err.status === 409
          && err.body.outcome === "requires_acknowledgement") {
        setRevokeCounts(err.body.publishedCounts as Record<string, number>);
        return;
      }
      setNotice(err instanceof Error ? err.message : "update failed");
    }
  };

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Permissions</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <span style={label}>Marketing permission (gates publication)</span>
          {marketingOn ? (
            <button style={btn(false, true)}
              onClick={() => void patch({ marketingPermission: false })}>
              Enabled — revoke
            </button>
          ) : (
            <span style={{ display: "flex", gap: 6 }}>
              <select style={input} value={marketingSource} onChange={(e) => setMarketingSource(e.target.value)}>
                {MARKETING_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button style={btn(true)}
                onClick={() => void patch({ marketingPermission: true, marketingPermissionSource: marketingSource })}>
                Enable
              </button>
            </span>
          )}
        </div>
        <div>
          <span style={label}>AI processing (gates analysis + generation)</span>
          {aiOn ? (
            <button style={btn(false, true)} onClick={() => void patch({ aiProcessingAllowed: false })}>
              Enabled — disable
            </button>
          ) : (
            <span style={{ display: "flex", gap: 6 }}>
              <select style={input} value={aiBasis} onChange={(e) => setAiBasis(e.target.value)}>
                {AI_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <button style={btn(true)}
                onClick={() => void patch({ aiProcessingAllowed: true, aiProcessingBasis: aiBasis })}>
                Enable
              </button>
            </span>
          )}
        </div>
      </div>
      {notice && <p style={{ color: C.danger, fontSize: 13, marginBottom: 0 }}>{notice}</p>}

      {revokeCounts && (
        <div style={overlay} onClick={() => setRevokeCounts(null)}>
          <div style={{ ...card, maxWidth: 480, marginBottom: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Published content exists</h3>
            <p style={{ fontSize: 14 }}>
              {Object.entries(revokeCounts).map(([type, n]) =>
                `${n} ${CONTENT_TYPE_LABELS[type] ?? type}${n === 1 ? "" : "s"}`).join(", ")} are live.
              Disabling stops FUTURE publishing only — use Publication history below to take
              individual placements down.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn(false)} onClick={() => setRevokeCounts(null)}>Cancel</button>
              <button style={btn(false, true)} onClick={() => {
                setRevokeCounts(null);
                void patch({ marketingPermission: false, acknowledgePublished: true });
              }}>
                Disable future publishing only
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit` will FAIL until Tasks 6-9's section components exist (Workspace imports them). To keep this task commit-able, create five one-line placeholder-free stubs is NOT allowed — instead, Task 5 is committed TOGETHER with Tasks 6-9 only if needed. PREFERRED: implement Tasks 5-9 in plan order in one working session; run `npx tsc --noEmit` at the END of Task 9 and make the five commits sequentially then (each commit stages only its task's files; tsc gating happens once all files exist). Mark each task's commit step accordingly.

- [ ] **Step 7: Commit (deferred until Task 9's verify passes)**

```bash
git add "app/admin/content-engine/[id]/page.tsx" "app/admin/content-engine/[id]/Workspace.tsx" "app/admin/content-engine/[id]/FactsSection.tsx" "app/admin/content-engine/[id]/PermissionsBar.tsx" "app/admin/content-engine/[id]/ui.ts"
git commit -m "feat: content engine workspace shell with facts and permissions"
```

---

### Task 6: Photos section — upload + analyze loop (spec §7.4 Section 2, §8.1)

**Files:**
- Create: `app/admin/content-engine/[id]/PhotosSection.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
// Section 2 — Photos (spec §7.4): drag/drop or picker upload through
// sign → uploadToSignedUrl → finalize (server hash is authoritative), grid of
// 1h signed thumbnails with analysis-status chips, Exclude toggle, and the
// client-orchestrated analyze loop (one batch per call; Resume = same button).
import { useCallback, useRef, useState } from "react";
import { C } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { btn, card, chip, sectionTitle } from "./ui";

interface Props {
  sessionId: string;
  photos: EnginePhoto[];
  aiAllowed: boolean;
  onChanged: () => void;
}

const STATUS_CHIP: Record<EnginePhoto["analysis_status"], { label: string; color: string }> = {
  pending: { label: "pending", color: C.muted },
  processing: { label: "processing…", color: C.ink },
  completed: { label: "✓ analyzed", color: C.ink },
  failed: { label: "failed", color: C.danger },
  skipped: { label: "skipped", color: C.muted },
};

export default function PhotosSection({ sessionId, photos, aiAllowed, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);
    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        const signed = await engineApi.signUpload(sessionId, { mime: file.type, sizeBytes: file.size });
        const { error } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
        if (error) throw new Error(`upload failed: ${error.message}`);
        await engineApi.finalizeUpload(sessionId, signed.path, {
          filename: file.name, mime: file.type, sizeBytes: file.size,
        });
      } catch (err) {
        if (err instanceof EngineApiError && err.status === 409) {
          setNotice(`${file.name}: already uploaded (duplicate photo)`);
        } else {
          setNotice(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        }
      }
    }
    setUploading(null);
    onChanged();
  }, [sessionId, onChanged]);

  const pendingCount = photos.filter((p) => !p.excluded
    && (p.analysis_status === "pending" || p.analysis_status === "failed")).length;
  const failedCount = photos.filter((p) => !p.excluded && p.analysis_status === "failed").length;

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setNotice(null);
    try {
      // client orchestrates: one batch per request until none remain (spec §8.1)
      for (;;) {
        const result = await engineApi.analyzeBatch(sessionId);
        onChanged();
        if (result.failed > 0) {
          setNotice(`${result.failed} photo(s) failed analysis — fix or retry below`);
          break;
        }
        if (result.remaining === 0) break;
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "analysis failed");
    } finally {
      setAnalyzing(false);
      onChanged();
    }
  }, [sessionId, onChanged]);

  const toggleExcluded = useCallback(async (photo: EnginePhoto) => {
    try {
      await engineApi.patchPhoto(photo.id, { excluded: !photo.excluded });
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "update failed");
    }
  }, [onChanged]);

  return (
    <section style={card}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void uploadFiles(e.dataTransfer.files); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>Photos ({photos.length})</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(false)} onClick={() => fileInput.current?.click()} disabled={uploading !== null}>
            {uploading ? `Uploading ${uploading}…` : "Upload photos"}
          </button>
          <button style={btn(true)} disabled={!aiAllowed || analyzing || pendingCount === 0}
            onClick={() => void runAnalysis()}
            title={!aiAllowed ? "Enable AI processing above to analyze" : undefined}>
            {analyzing ? "Analyzing…" : failedCount > 0 ? `Retry failed (${failedCount})` : `Analyze ${pendingCount} photos`}
          </button>
        </div>
      </div>
      {!aiAllowed && (
        <p style={{ fontSize: 13, color: C.muted }}>
          Analysis is disabled until AI processing is confirmed in Permissions.
        </p>
      )}
      {notice && <p style={{ fontSize: 13, color: C.danger }}>{notice}</p>}
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => void uploadFiles(e.target.files)} />

      {photos.length === 0 ? (
        <p style={{ color: C.muted, textAlign: "center", padding: 24 }}>
          No photos uploaded — drop files here or use Upload photos.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
          {photos.map((photo) => {
            const status = STATUS_CHIP[photo.analysis_status];
            return (
              <figure key={photo.id} style={{
                margin: 0, opacity: photo.excluded ? 0.4 : 1,
                border: `1px solid ${C.warmEdge}`, borderRadius: 10, overflow: "hidden",
              }}>
                {photo.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
                  <img src={photo.thumbnailUrl} alt={photo.alt_text ?? photo.original_filename ?? "session photo"}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ aspectRatio: "1", background: C.pageAlt }} />
                )}
                <figcaption style={{ padding: 6, fontSize: 11, display: "flex", justifyContent: "space-between", gap: 4 }}>
                  <span style={chip(status.color, C.pageAlt)} title={photo.analysis_error ?? undefined}>
                    {status.label}{photo.quality_score ? ` · ${photo.quality_score}` : ""}
                  </span>
                  <button style={{ ...btn(false), padding: "0 6px", fontSize: 11 }}
                    onClick={() => void toggleExcluded(photo)}>
                    {photo.excluded ? "Include" : "Exclude"}
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit (deferred with Task 5 — see Task 9's verify)**

```bash
git add "app/admin/content-engine/[id]/PhotosSection.tsx"
git commit -m "feat: workspace photos section with signed-upload flow and analyze loop"
```

---

### Task 7: Generation section + reconcile banner (spec §7.4 Section 3, §9.4)

**Files:**
- Create: `app/admin/content-engine/[id]/GenerationSection.tsx`
- Create: `app/admin/content-engine/[id]/ReconcileBanner.tsx`

- [ ] **Step 1: Write the generation section**

```tsx
"use client";
// Section 3 — Generation (spec §7.4): pre-generation summary, per-type
// progress, dependency-ORDERED sequencing (links + testimonial BEFORE journal
// — Plan 3 contract), Skip failed type, and Regenerate (archive + new package,
// optional preserve-approvals copy-forward per §8.4).
import { useCallback, useState } from "react";
import { C } from "@/lib/colors";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import {
  GENERATION_ORDER, CONTENT_TYPE_LABELS,
  type EngineItem, type EnginePackage, type EnginePhoto,
} from "@/app/admin/content-engine/engineTypes";
import { btn, card, chip, sectionTitle } from "./ui";

interface Props {
  sessionId: string;
  activePackage: EnginePackage | null;
  items: EngineItem[];
  photos: EnginePhoto[];
  aiAllowed: boolean;
  onChanged: () => void;
}

export default function GenerationSection({
  sessionId, activePackage, items, photos, aiAllowed, onChanged,
}: Props) {
  const [busyType, setBusyType] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preserveApprovals, setPreserveApprovals] = useState(true);

  const analyzedCount = photos.filter((p) => !p.excluded && p.analysis_status === "completed").length;
  const progress = activePackage?.generation_settings.progress ?? {};
  const selected = activePackage?.generation_settings.selected_types ?? [];

  const createPackage = useCallback(async (archive: boolean) => {
    setNotice(null);
    try {
      const copyItems = archive && preserveApprovals
        ? items.filter((i) => i.status === "approved" && !i.published_target_id)
            .map((i) => ({ item_id: i.id, preserve_approval: true }))
        : [];
      await engineApi.createPackage(sessionId, [...GENERATION_ORDER], { archiveCurrent: archive, copyItems });
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not create package");
    }
  }, [sessionId, items, preserveApprovals, onChanged]);

  const generateOne = useCallback(async (contentType: string) => {
    if (!activePackage) return;
    setBusyType(contentType);
    setNotice(null);
    try {
      const result = await engineApi.generateType(activePackage.id, contentType);
      if (result.outcome === "failed") setNotice(`${CONTENT_TYPE_LABELS[contentType]}: ${result.error ?? "failed"}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "generation failed");
    } finally {
      setBusyType(null);
      onChanged();
    }
  }, [activePackage, onChanged]);

  const generateAll = useCallback(async () => {
    if (!activePackage) return;
    setNotice(null);
    // dependency order is mandatory: links + testimonial feed the journal
    for (const type of GENERATION_ORDER) {
      const entry = progress[type];
      if (!entry || entry.status === "completed" || entry.status === "skipped") continue;
      setBusyType(type);
      try {
        const result = await engineApi.generateType(activePackage.id, type);
        if (result.outcome === "failed") {
          setNotice(`${CONTENT_TYPE_LABELS[type]}: ${result.error ?? "failed"} — continue or skip below`);
        }
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "generation failed");
        break;
      } finally {
        onChanged();
      }
    }
    setBusyType(null);
    onChanged();
  }, [activePackage, progress, onChanged]);

  const skip = useCallback(async (contentType: string) => {
    if (!activePackage) return;
    try {
      await engineApi.skipType(activePackage.id, contentType);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "skip failed");
    }
  }, [activePackage, onChanged]);

  if (!aiAllowed) {
    return (
      <section style={card}>
        <h2 style={sectionTitle}>Generation</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>
          Generation is disabled until AI processing is confirmed in Permissions.
        </p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>
          Generation{activePackage ? ` — package #${activePackage.generation_number} (${activePackage.status})` : ""}
        </h2>
        {activePackage ? (
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <label style={{ color: C.muted }}>
              <input type="checkbox" checked={preserveApprovals}
                onChange={(e) => setPreserveApprovals(e.target.checked)} /> preserve approvals
            </label>
            <button style={btn(false)} onClick={() => {
              if (confirm("Archive the current package and start a new generation run?")) void createPackage(true);
            }}>Regenerate ▾</button>
          </span>
        ) : (
          <button style={btn(true)} disabled={analyzedCount === 0}
            title={analyzedCount === 0 ? "Analyze photos first" : undefined}
            onClick={() => void createPackage(false)}>
            Generate content package
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 10px" }}>
        Inputs: {analyzedCount} analyzed photos. Journal generation uses the link and
        testimonial drafts, so types run in dependency order.
      </p>
      {notice && <p style={{ fontSize: 13, color: C.danger }}>{notice}</p>}

      {activePackage && (
        <>
          <div style={{ display: "grid", gap: 6 }}>
            {GENERATION_ORDER.filter((t) => selected.includes(t)).map((type) => {
              const entry = progress[type];
              const status = entry?.status ?? "pending";
              const color = status === "failed" ? C.danger : status === "completed" ? C.ink : C.muted;
              return (
                <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span>{CONTENT_TYPE_LABELS[type]}</span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {entry?.usage && (
                      <span style={{ color: C.muted, fontSize: 11 }}>
                        {entry.usage.input_tokens + entry.usage.output_tokens} tok
                      </span>
                    )}
                    <span style={chip(color, C.pageAlt)} title={entry?.error ?? undefined}>{status}</span>
                    {(status === "pending" || status === "failed") && (
                      <button style={btn(false)} disabled={busyType !== null}
                        onClick={() => void generateOne(type)}>
                        {busyType === type ? "Generating…" : status === "failed" ? "Retry" : "Generate"}
                      </button>
                    )}
                    {status === "failed" && (
                      <button style={btn(false)} onClick={() => void skip(type)}>Skip</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {activePackage.status === "generating" && (
            <button style={{ ...btn(true), marginTop: 10 }} disabled={busyType !== null}
              onClick={() => void generateAll()}>
              {busyType ? `Generating ${CONTENT_TYPE_LABELS[busyType] ?? busyType}…` : "Generate all remaining"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write the reconcile banner**

```tsx
"use client";
// §9.4 banner: items stuck publishing past the lease, failed items whose
// target detectably exists (Link to existing — auto for hash/constraint
// proofs, confirm for slug matches), and the orphaned-derivative count.
import { useCallback, useEffect, useState } from "react";
import { C } from "@/lib/colors";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type ReconcileReport } from "@/app/admin/content-engine/engineTypes";
import { btn, card } from "./ui";

interface Props {
  sessionId: string;
  onChanged: () => void;
}

export default function ReconcileBanner({ sessionId, onChanged }: Props) {
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await engineApi.reconcile(sessionId));
    } catch {
      setReport(null); // banner is best-effort; workspace still works without it
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  if (!report) return null;
  const hasWork = report.stuckPublishing.length > 0 || report.failedWithExistingTarget.length > 0;
  if (!hasWork && report.orphanedDerivatives.length === 0) return null;

  const act = async (body: Record<string, unknown>) => {
    setNotice(null);
    try {
      await engineApi.reconcileAction(body);
      await load();
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "action failed");
    }
  };

  return (
    <section style={{ ...card, borderColor: C.danger }}>
      <strong style={{ fontSize: 14 }}>Needs reconciliation</strong>
      {notice && <p style={{ color: C.danger, fontSize: 13 }}>{notice}</p>}
      {report.stuckPublishing.map((s) => (
        <p key={s.itemId} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          {CONTENT_TYPE_LABELS[s.contentType] ?? s.contentType} stuck publishing since{" "}
          {new Date(s.publishingStartedAt).toLocaleTimeString()}.
          <button style={btn(false, true)} onClick={() => void act({ action: "mark_failed", itemId: s.itemId })}>
            Mark failed
          </button>
        </p>
      ))}
      {report.failedWithExistingTarget.map((m) => (
        <p key={m.itemId} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          Failed {CONTENT_TYPE_LABELS[m.contentType] ?? m.contentType} already exists live ({m.proof}).
          <button style={btn(false)} onClick={() => {
            if (m.autoConfirmable || confirm("Slug matches are not proof of provenance. Link anyway?")) {
              void act({ action: "link", itemId: m.itemId, targetType: m.targetType, targetId: m.targetId, confirm: !m.autoConfirmable });
            }
          }}>
            Link to existing record
          </button>
        </p>
      ))}
      {report.orphanedDerivatives.length > 0 && (
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 0 }}>
          {report.orphanedDerivatives.length} orphaned public derivative(s) — reclaimed by the deferred cleanup sweep.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Commit (deferred with Task 5 — see Task 9's verify)**

```bash
git add "app/admin/content-engine/[id]/GenerationSection.tsx" "app/admin/content-engine/[id]/ReconcileBanner.tsx"
git commit -m "feat: generation sequencing and reconciliation banner"
```

---

### Task 8: Item review cards + editors (spec §7.4 Section 4)

**Files:**
- Create: `app/admin/content-engine/[id]/ItemsSection.tsx`
- Create: `app/admin/content-engine/[id]/editorsJournal.tsx`
- Create: `app/admin/content-engine/[id]/editorsSimple.tsx`

- [ ] **Step 1: Write the simple editors** (`app/admin/content-engine/[id]/editorsSimple.tsx`)

```tsx
"use client";
// Per-type editors for the non-journal types (spec §7.4 Section 4).
// Destination dropdowns use the canonical taxonomy so invalid slugs are
// unrepresentable. Each editor renders controlled fields over the payload and
// calls onEdit with the FULL next payload (autosave owns persistence).
import { PORTFOLIO_CATEGORIES, SCHOOL_SLUGS, GUIDE_TYPES, guideLocationKeys } from "@/lib/contentEngine/taxonomy";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { input, label } from "./ui";

export interface EditorProps {
  payload: Record<string, unknown>;
  photos: EnginePhoto[];
  onEdit: (next: Record<string, unknown>) => void;
  disabled: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Field({ name, value, onChange, disabled, multiline = false }: {
  name: string; value: string; onChange: (v: string) => void; disabled: boolean; multiline?: boolean;
}) {
  return (
    <div>
      <span style={label}>{name}</span>
      {multiline ? (
        <textarea style={{ ...input, minHeight: 56 }} value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={input} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function PhotoSelect({ payload, photos, onEdit, disabled }: EditorProps) {
  return (
    <div>
      <span style={label}>Photo</span>
      <select style={input} disabled={disabled} value={str(payload.session_photo_id)}
        onChange={(e) => onEdit({ ...payload, session_photo_id: e.target.value })}>
        {photos.filter((p) => !p.excluded).map((p) => (
          <option key={p.id} value={p.id}>
            {p.original_filename ?? p.id.slice(0, 8)}{p.quality_score ? ` (q${p.quality_score})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PortfolioEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      <PhotoSelect {...props} />
      <div>
        <span style={label}>Category</span>
        <select style={input} disabled={disabled} value={str(payload.category)}
          onChange={(e) => onEdit({ ...payload, category: e.target.value })}>
          {PORTFOLIO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Field name="Title" value={str(payload.title)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, title: v })} />
      <Field name="Alt text" value={str(payload.alt_text)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, alt_text: v })} />
      <label style={{ fontSize: 13, alignSelf: "end" }}>
        <input type="checkbox" disabled={disabled} checked={payload.featured === true}
          onChange={(e) => onEdit({ ...payload, featured: e.target.checked })} /> featured (homepage)
      </label>
    </div>
  );
}

export function SchoolEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      <PhotoSelect {...props} />
      <div>
        <span style={label}>School</span>
        <select style={input} disabled={disabled} value={str(payload.school_slug)}
          onChange={(e) => onEdit({ ...payload, school_slug: e.target.value })}>
          {SCHOOL_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <Field name="Caption" value={str(payload.caption)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, caption: v })} />
      <Field name="Alt override" value={str(payload.alt_override)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, alt_override: v })} />
    </div>
  );
}

export function GuideEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  const guide = (str(payload.guide) || "family") as (typeof GUIDE_TYPES)[number];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      <PhotoSelect {...props} />
      <div>
        <span style={label}>Guide</span>
        <select style={input} disabled={disabled} value={guide}
          onChange={(e) => onEdit({ ...payload, guide: e.target.value, location_key: guideLocationKeys(e.target.value as typeof guide)[0] })}>
          {GUIDE_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>Location</span>
        <select style={input} disabled={disabled} value={str(payload.location_key)}
          onChange={(e) => onEdit({ ...payload, location_key: e.target.value })}>
          {guideLocationKeys(guide).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <Field name="Alt text" value={str(payload.alt_text)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, alt_text: v })} />
    </div>
  );
}

export function TestimonialEditor({ payload, onEdit, disabled }: EditorProps) {
  return (
    <Field name="Quote excerpt" multiline value={str(payload.quote_excerpt)} disabled={disabled}
      onChange={(v) => onEdit({ ...payload, quote_excerpt: v })} />
  );
}

export function LinksEditor({ payload, onEdit, disabled }: EditorProps) {
  const links = Array.isArray(payload.links)
    ? (payload.links as { url: string; label: string; reason?: string }[]) : [];
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {links.map((link, i) => (
        <div key={`${link.url}-${i}`} style={{ display: "flex", gap: 6, fontSize: 13, alignItems: "center" }}>
          <code style={{ whiteSpace: "nowrap" }}>{link.url}</code>
          <input style={input} value={link.label} disabled={disabled}
            onChange={(e) => {
              const next = links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l));
              onEdit({ ...payload, links: next });
            }} />
          <button style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}
            disabled={disabled}
            onClick={() => onEdit({ ...payload, links: links.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      {links.length === 0 && <span style={{ fontSize: 13, opacity: 0.7 }}>No links suggested.</span>}
    </div>
  );
}
```

- [ ] **Step 2: Write the journal editor** (`app/admin/content-engine/[id]/editorsJournal.tsx`)

```tsx
"use client";
// Journal editor (spec §7.4): title/slug/body/meta, photo picker (cover +
// extras from analyzed photos), and the structured internal-links list
// (payload.internal_links — rendered into "Keep exploring" at publish, §9.3).
import { CANONICAL_INTERNAL_LINKS } from "@/lib/contentEngine/taxonomy";
import type { EditorProps } from "./editorsSimple";
import { input, label } from "./ui";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

export function JournalEditor({ payload, photos, onEdit, disabled }: EditorProps) {
  const photoIds = arr(payload.photo_ids);
  const links = Array.isArray(payload.internal_links)
    ? (payload.internal_links as { url: string; label: string }[]) : [];
  const candidates = photos.filter((p) => !p.excluded && p.analysis_status === "completed");

  const togglePhoto = (id: string) => {
    const next = photoIds.includes(id) ? photoIds.filter((p) => p !== id) : [...photoIds, id];
    const cover = str(payload.cover_photo_id);
    onEdit({
      ...payload,
      photo_ids: next,
      cover_photo_id: next.includes(cover) ? cover : (next[0] ?? ""),
    });
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div>
          <span style={label}>Title</span>
          <input style={input} value={str(payload.title)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, title: e.target.value })} />
        </div>
        <div>
          <span style={label}>Slug</span>
          <input style={input} value={str(payload.slug)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, slug: e.target.value })} />
        </div>
      </div>
      <div>
        <span style={label}>Body (markdown)</span>
        <textarea style={{ ...input, minHeight: 220, fontFamily: "monospace" }}
          value={str(payload.body)} disabled={disabled}
          onChange={(e) => onEdit({ ...payload, body: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <span style={label}>Meta description</span>
          <textarea style={{ ...input, minHeight: 48 }} value={str(payload.meta_description)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, meta_description: e.target.value })} />
        </div>
        <div>
          <span style={label}>Meta keywords (deterministic; editable)</span>
          <textarea style={{ ...input, minHeight: 48 }} value={str(payload.meta_keywords)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, meta_keywords: e.target.value })} />
        </div>
      </div>

      <div>
        <span style={label}>Photos (click to toggle; ◉ = cover, set below)</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {candidates.map((p) => (
            <button key={p.id} disabled={disabled} onClick={() => togglePhoto(p.id)}
              style={{
                ...input, width: "auto", cursor: "pointer",
                opacity: photoIds.includes(p.id) ? 1 : 0.45,
              }}>
              {photoIds.includes(p.id) ? "✓ " : ""}{p.original_filename ?? p.id.slice(0, 8)}
              {str(payload.cover_photo_id) === p.id ? " ◉" : ""}
            </button>
          ))}
        </div>
        <span style={label}>Cover photo</span>
        <select style={input} disabled={disabled} value={str(payload.cover_photo_id)}
          onChange={(e) => onEdit({ ...payload, cover_photo_id: e.target.value })}>
          {photoIds.map((id) => {
            const p = photos.find((x) => x.id === id);
            return <option key={id} value={id}>{p?.original_filename ?? id.slice(0, 8)}</option>;
          })}
        </select>
      </div>

      <div>
        <span style={label}>Internal links ("Keep exploring" section at publish)</span>
        {links.map((link, i) => (
          <div key={`${link.url}-${i}`} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <code style={{ fontSize: 12, alignSelf: "center", whiteSpace: "nowrap" }}>{link.url}</code>
            <input style={input} value={link.label} disabled={disabled}
              onChange={(e) => onEdit({
                ...payload,
                internal_links: links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
              })} />
            <button style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }} disabled={disabled}
              onClick={() => onEdit({ ...payload, internal_links: links.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <select style={input} disabled={disabled} value=""
          onChange={(e) => {
            if (!e.target.value) return;
            onEdit({
              ...payload,
              internal_links: [...links, { url: e.target.value, label: e.target.value }],
            });
          }}>
          <option value="">+ add canonical link…</option>
          {CANONICAL_INTERNAL_LINKS.filter((u) => !links.some((l) => l.url === u))
            .map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the items section** (`app/admin/content-engine/[id]/ItemsSection.tsx`)

```tsx
"use client";
// Section 4 — Item review (spec §7.4): one card per item with status chip,
// type-specific editor, Approve / Reject / Un-reject, autosave state line, and
// the 409 comparison prompt. Published items render display-only.
import { useState } from "react";
import { C } from "@/lib/colors";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem, type EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { useAutosave } from "./useAutosave";
import { JournalEditor } from "./editorsJournal";
import {
  PortfolioEditor, SchoolEditor, GuideEditor, TestimonialEditor, LinksEditor,
  type EditorProps,
} from "./editorsSimple";
import { btn, card, chip, sectionTitle } from "./ui";

const EDITORS: Record<string, (props: EditorProps) => React.ReactElement> = {
  journal_post: JournalEditor,
  portfolio_pick: PortfolioEditor,
  school_page_photo: SchoolEditor,
  guide_photo: GuideEditor,
  testimonial_feature: TestimonialEditor,
  internal_link_suggestion: LinksEditor,
};

const STATUS_COLORS: Record<EngineItem["status"], string> = {
  draft: C.muted, approved: C.ink, rejected: C.muted,
  publishing: C.ink, published: C.muted, failed: C.danger,
};

function ItemCard({ item, photos, onChanged }: {
  item: EngineItem; photos: EnginePhoto[]; onChanged: () => void;
}) {
  const { state, payload, edit, saveNow, resolveConflict } = useAutosave(
    item.id, item.payload, item.payload_revision, onChanged,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const Editor = EDITORS[item.content_type];
  const locked = item.status === "published" || item.status === "publishing" || item.status === "rejected";

  const act = async (action: "approve" | "reject" | "unreject") => {
    setNotice(null);
    try {
      if (action === "approve" && state.dirty) saveNow(); // flush before approving
      const reason = action === "reject" ? (prompt("Rejection reason (optional)") ?? undefined) : undefined;
      await engineApi.itemStatus(item.id, action, reason);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "action failed");
    }
  };

  const saveLine =
    state.status === "saving" ? "Saving…"
    : state.status === "editing" ? "Editing…"
    : state.status === "saved" ? `Saved ${state.savedAt}`
    : state.status === "save_failed" ? `Save failed — local backup preserved (${state.error})`
    : "";

  return (
    <div style={{ border: `1px solid ${C.warmEdge}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>{CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted }}>{saveLine}</span>
          <span style={chip(STATUS_COLORS[item.status], C.pageAlt)} title={item.error ?? item.rejection_reason ?? undefined}>
            {item.status}
          </span>
          {(item.status === "draft" || item.status === "failed") && (
            <button style={btn(true)} onClick={() => void act("approve")}>Approve</button>
          )}
          {(item.status === "draft" || item.status === "approved" || item.status === "failed") && (
            <button style={btn(false, true)} onClick={() => void act("reject")}>Reject</button>
          )}
          {item.status === "rejected" && (
            <button style={btn(false)} onClick={() => void act("unreject")}>Un-reject</button>
          )}
        </span>
      </div>
      {item.status === "failed" && item.error && (
        <p style={{ color: C.danger, fontSize: 12 }}>{item.error}</p>
      )}
      {notice && <p style={{ color: C.danger, fontSize: 12 }}>{notice}</p>}

      {state.status === "conflict" && state.conflict && (
        <div style={{ border: `1px solid ${C.danger}`, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>
          <p style={{ marginTop: 0 }}>
            This item changed in another tab/device (server revision {state.conflict.payload_revision}).
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(false)} onClick={() => resolveConflict("server")}>Use server copy</button>
            <button style={btn(false, true)} onClick={() => resolveConflict("mine")}>Overwrite with mine</button>
          </div>
        </div>
      )}

      {Editor ? (
        <Editor payload={payload} photos={photos} onEdit={edit} disabled={locked} />
      ) : (
        <pre style={{ fontSize: 12, overflowX: "auto" }}>{JSON.stringify(payload, null, 2)}</pre>
      )}
    </div>
  );
}

export default function ItemsSection({ items, photos, onChanged }: {
  items: EngineItem[]; photos: EnginePhoto[]; onChanged: () => void;
}) {
  return (
    <section style={card}>
      <h2 style={sectionTitle}>Review drafts ({items.length})</h2>
      {items.length === 0 ? (
        <p style={{ color: C.muted, textAlign: "center", padding: 16 }}>
          No drafts yet — generate a content package above.
        </p>
      ) : (
        items.map((item) => (
          <ItemCard key={`${item.id}:${item.payload_revision}`} item={item} photos={photos} onChanged={onChanged} />
        ))
      )}
    </section>
  );
}
```

- [ ] **Step 4: Commit (deferred with Task 5 — see Task 9's verify)**

```bash
git add "app/admin/content-engine/[id]/ItemsSection.tsx" "app/admin/content-engine/[id]/editorsJournal.tsx" "app/admin/content-engine/[id]/editorsSimple.tsx"
git commit -m "feat: item review cards with per-type editors and autosave"
```

---

### Task 9: Action bar + publication history, then the consolidated verify + commits

**Files:**
- Create: `app/admin/content-engine/[id]/ActionBar.tsx`
- Create: `app/admin/content-engine/[id]/PublicationHistory.tsx`

- [ ] **Step 1: Write the action bar**

```tsx
"use client";
// Sticky bottom bar (spec §7.4): "n of m handled · k failed · j approved
// awaiting publish", Approve all remaining (confirmation summary), and
// Publish approved (sequenced one POST per item; per-item failures surface).
import { useState } from "react";
import { C } from "@/lib/colors";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem } from "@/app/admin/content-engine/engineTypes";
import { btn } from "./ui";

interface Props {
  items: EngineItem[];
  marketingPermission: boolean;
  onChanged: () => void;
}

export default function ActionBar({ items, marketingPermission, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const drafts = items.filter((i) => i.status === "draft");
  const approved = items.filter((i) => i.status === "approved");
  const failed = items.filter((i) => i.status === "failed");
  const handled = items.length - drafts.length;
  if (items.length === 0) return null;

  const approveAll = async () => {
    const summary = Object.entries(
      drafts.reduce<Record<string, number>>((acc, i) => {
        acc[i.content_type] = (acc[i.content_type] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([t, n]) => `${n} ${CONTENT_TYPE_LABELS[t] ?? t}`).join(", ");
    if (!confirm(`Approve ${drafts.length} item(s)? — ${summary}`)) return;
    setBusy("approve");
    setNotice(null);
    try {
      for (const item of drafts) {
        await engineApi.itemStatus(item.id, "approve");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "approve failed");
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const publishApproved = async () => {
    if (!confirm(`Publish ${approved.length} approved item(s)? Live tables and public storage will be written.`)) return;
    setBusy("publish");
    setNotice(null);
    const problems: string[] = [];
    for (const item of approved) {
      try {
        const result = await engineApi.publish(item.id);
        if (result.revalidationFailures.length > 0) {
          problems.push(`${CONTENT_TYPE_LABELS[item.content_type]}: published; revalidation pending for ${result.revalidationFailures.join(", ")}`);
        }
      } catch (err) {
        const message = err instanceof EngineApiError ? err.message : "publish failed";
        problems.push(`${CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}: ${message}`);
      }
      onChanged();
    }
    if (problems.length > 0) setNotice(problems.join(" · "));
    setBusy(null);
    onChanged();
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
      background: C.white, borderTop: `1px solid ${C.warmEdge}`, padding: "10px 24px",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 13, color: C.muted }}>
        {handled} of {items.length} handled · {failed.length} failed · {approved.length} approved awaiting publish
        {notice && <span style={{ color: C.danger }}> — {notice}</span>}
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        {drafts.length > 0 && (
          <button style={btn(false)} disabled={busy !== null} onClick={() => void approveAll()}>
            {busy === "approve" ? "Approving…" : `Approve all remaining (${drafts.length})`}
          </button>
        )}
        {approved.length > 0 && (
          <button style={btn(true)} disabled={busy !== null || !marketingPermission}
            title={!marketingPermission ? "Enable marketing permission to publish" : undefined}
            onClick={() => void publishApproved()}>
            {busy === "publish" ? "Publishing…" : `Publish approved (${approved.length})`}
          </button>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Write the publication history**

```tsx
"use client";
// Section 5 — Publication history (spec §7.4): permanent across packages, with
// live link, Revalidate (site-wide cache invalidation — targeted Step-C runs
// at publish; this is the recovery affordance), and per-item Takedown.
import { useState } from "react";
import { C } from "@/lib/colors";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem } from "@/app/admin/content-engine/engineTypes";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";
import { btn, card, sectionTitle } from "./ui";

interface Props {
  published: EngineItem[];
  onChanged: () => void;
}

export default function PublicationHistory({ published, onChanged }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (published.length === 0) return null;

  const takedown = async (item: EngineItem) => {
    if (!confirm(`Take down this ${CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}? The live record is removed or deactivated; history is preserved.`)) return;
    setBusy(item.id);
    setNotice(null);
    try {
      await engineApi.takedown(item.id);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "takedown failed");
    } finally {
      setBusy(null);
    }
  };

  const revalidate = async () => {
    setBusy("revalidate");
    try {
      await engineApi.revalidateAll();
      setNotice("Caches revalidated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "revalidation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>Publication history ({published.length})</h2>
        <button style={btn(false)} disabled={busy !== null} onClick={() => void revalidate()}>
          {busy === "revalidate" ? "Revalidating…" : "Revalidate"}
        </button>
      </div>
      {notice && (
        <p style={{ fontSize: 13, color: notice === "Caches revalidated." ? C.muted : C.danger }}>{notice}</p>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {published.map((item) => {
          const takenDown = Boolean(item.published_ref?.taken_down_at);
          const livePath = pathsForPublishedItem(item.content_type, item.payload)[
            item.content_type === "journal_post" ? 1 : 0
          ];
          return (
            <div key={item.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 13, opacity: takenDown ? 0.55 : 1,
            }}>
              <span>
                {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                {" · "}{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}
                {takenDown && " · taken down"}
                {livePath && !takenDown && (
                  <> · <a href={livePath} target="_blank" rel="noreferrer" style={{ color: C.ink }}>{livePath}</a></>
                )}
              </span>
              {!takenDown && item.published_target_type !== "none" && (
                <button style={btn(false, true)} disabled={busy !== null} onClick={() => void takedown(item)}>
                  {busy === item.id ? "Removing…" : "Take down"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Consolidated verify for Tasks 5-9.** Now that every workspace file exists:

Run: `npx tsc --noEmit && npx eslint app/admin/content-engine && npm test && npm run test:integration`
Expected: tsc clean (fix any cross-file type drift NOW); eslint clean; suites unchanged-green.

- [ ] **Step 4: Make the five deferred commits sequentially**, staging each task's files exactly as listed in Tasks 5, 6, 7, 8, then:

```bash
git add "app/admin/content-engine/[id]/ActionBar.tsx" "app/admin/content-engine/[id]/PublicationHistory.tsx"
git commit -m "feat: sticky publish bar and publication history with takedown"
```

---

### Task 10: Build, manual checklist, wrap-up

**Files:**
- Create: `docs/superpowers/2026-06-11-content-engine-manual-checklist.md`

- [ ] **Step 1: Production build** — `npm run build`
Expected: compiles with no type errors; the two new admin routes appear in the route list. (Warnings from pre-existing pages are out of scope.)

- [ ] **Step 2: Write the manual checklist** (spec §13.4 + the 4A route-level checks)

```markdown
# Content Engine — Manual Browser Checklist (spec §13.4)

Run with the local stack + `npm run dev`, signed in as admin. Production is NOT touched.

## Session list
- [ ] /admin/content-engine loads; unauthenticated visit redirects to /admin
- [ ] Blank session creates and opens the workspace
- [ ] "New from client session" lists only session_completed+ sessions; picking one
      prefills facts (first-name display name, mapped service type, date, location)
- [ ] Creating again for the same client session opens the EXISTING workspace (409 path)
- [ ] Badges + actionability sort look right; filters work

## Workspace — permissions & facts
- [ ] Generation/analyze disabled with explanation until AI processing enabled
- [ ] Publish disabled until marketing permission enabled
- [ ] Facts save; invalid school slug impossible (dropdown only)
- [ ] Revoking marketing permission with live published content opens the blocking
      modal listing counts; "Disable future publishing only" stamps revoked_at

## Photos
- [ ] Drag-drop and picker uploads work; duplicate upload of identical bytes → 409 notice
- [ ] Thumbnails render (signed URLs); exclude toggle greys the photo
- [ ] Analyze runs batch-by-batch with live progress; failures surface with Retry
- [ ] Mid-analysis reload resumes cleanly (leases)

## Generation
- [ ] Package creation shows the pre-generation summary (photo count)
- [ ] Generate all runs in dependency order (links + testimonial BEFORE journal)
- [ ] A failed type shows Retry + Skip; skip lets the package reach ready
- [ ] Regenerate archives the package; preserve-approvals copies approved unpublished items

## Review & autosave
- [ ] Editors render per type; destination dropdowns are taxonomy-only
- [ ] Autosave: Editing… → Saving… → Saved <time>; reload restores server copy
- [ ] Two tabs editing the same item → second tab gets the comparison prompt (409)
- [ ] Save failure (kill dev server briefly) → "local backup preserved"; recovery works
- [ ] Editing an approved item reverts it to draft
- [ ] Approve / Reject (with reason) / Un-reject transitions work

## Publish & history & reconcile
- [ ] Publish approved publishes in sequence; summary shows per-item failures
- [ ] Published journal/portfolio/school/guide records appear correctly on the LOCAL site
- [ ] 409 blocked (permission off) vs 422 failed (slug conflict) surface distinctly
- [ ] Publication history lists live links; Revalidate works; Take down removes or
      deactivates the live record, preserves history, frees unshared derivatives
- [ ] Reconcile banner: stuck publishing → Mark failed; failed-with-existing → Link

## Route-level checks (4A handoff)
- [ ] All engine routes 401 without the admin cookie (curl spot-check)
- [ ] photos thumbnails stop working after ~1h (signed TTL) and recover on reload
```

- [ ] **Step 3: Full suites one more time** — `npm test && npm run test:integration && npx tsc --noEmit` → all green/clean.

- [ ] **Step 4: Commit** (explicit paths — the user's payments work-in-progress must never be staged)

```bash
git add docs/superpowers/2026-06-11-content-engine-manual-checklist.md
git commit -m "chore: content engine admin UI complete with manual checklist (plan 4B of 6)"
```

**STOP.** The manual checklist is for the USER to run in a browser (or with /verify). Plan 5 (public-page integrations: DB-backed school galleries on /grads/*, guide-photo rendering already live-table-driven, journal already live) and Plan 6 (analytics + deployment verification + the production-apply gate) follow.

---

## Self-Review Notes

- **Spec coverage (§7):** §7.1 list/filters/sort/pickers + DB-enforced duplicate → Task 4; §7.2 prefill semantics live server-side (4A) and surface in the picker flow; §7.3 permissions UI + revocation modal (409 acknowledgement; takedown per-item in history) → Tasks 5+9; §7.4 Section 1 facts → Task 5; Section 2 photos (upload via sign/uploadToSignedUrl/finalize, chips, exclude, batch progress + retry/resume) → Task 6; Section 3 generation (summary, per-type chips + usage tokens, regenerate w/ preserve-approvals copy, skip failed) → Task 7 (+Task 1 server gap); Section 4 review (per-type editors, taxonomy dropdowns, autosave protocol incl. conflict comparison + localStorage fallback + flush-before-approve) → Tasks 3+8; sticky action bar (counts, approve-all summary, publish sequencing) → Task 9; Section 5 history (live link, Revalidate, takedown) → Task 9; empty states (each section's empty copy) → Tasks 4/6/8; refresh safety: every durable thing is a server row, workspace refetches after each mutation; §9.4 banner → Task 7.
- **Deliberately deferred / consciously light:** view counts in history (Plan 6 analytics); manual photo re-ordering UI (PATCH sort_order exists; v1 keeps upload order — flag if the user wants drag-sort); archived-package read-only viewer + per-item restore (the RPC supports copy_items; v1 UI exposes regenerate-with-preserve only — spec §7.4's archived-viewer is noted as a 4B.1 follow-up for the user to prioritize); social captions (Phase 2, no UI by spec); dictation/mobile is untouched native behavior.
- **Type consistency:** `engineApi` return shapes match the 4A routes; `EditorProps` shared by both editor files; `useAutosave(itemId, payload, revision, onStatusReset)` matches ItemCard's call; `GENERATION_ORDER`/`CONTENT_TYPE_LABELS` single-sourced in engineTypes; ItemCard remount key `${id}:${payload_revision}` keeps hook state in sync with server refreshes.
- **No placeholders:** every component is complete; the only deliberately deferred verify is the documented Tasks 5-9 consolidated tsc gate (cross-importing files can't type-check until all exist — commits stay per-task and sequential).





