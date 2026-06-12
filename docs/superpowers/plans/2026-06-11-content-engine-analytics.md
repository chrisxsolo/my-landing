# Content Engine Analytics + Deployment Verification (Plan 6 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-party, cookieless content analytics (spec §10): the fail-closed `/api/track-event` route, the `ContentEventBeacon` on blog/school/guide/portfolio pages with correct attribution (single-session content resolves to its item; shared pages never attribute to a session; CTAs attribute to the page), per-item view counts in publication history and a per-session rollup — ending at the **production deployment gate** (explicit user authorization required; nothing in this plan applies to production).

**Architecture:** Pure rules module (path/referrer normalization, allowlists, bot filter — unit-tested) + a `recordContentEvent` service (attribution reverse-lookup through `(published_target_type, published_target_id)` — integration-tested) + a thin public route that fails closed (production-only, bot/admin skip, rate-limited, 2KB cap, always 202). The beacon is one client component mounted by the four page surfaces; CTA clicks use a delegated listener for `/contact` links.

**Tech Stack:** Next.js route handler + client component, `navigator.sendBeacon`, `rateLimit` from `@/lib/rateLimit`, Vitest.

**Spec is law.** Standing constraints: never `git add -A` (user's payments feature in-flight); production apply is the FINAL GATE, not an implementation step.

---

## File Structure

```
lib/contentEngine/trackEventRules.ts   — allowlists + normalizePath/normalizeReferrer/isLikelyBot (pure)
lib/contentEngine/recordEvent.ts       — recordContentEvent: validate → attribute → insert (spec §10)
app/api/track-event/route.ts           — public POST, fail-closed (spec §10)
app/components/ContentEventBeacon.tsx  — page_view on mount + delegated /contact cta_click
app/api/admin/session-content/analytics/route.ts — per-session/per-item counts (admin)
MODIFY: app/(professional)/blog/[slug]/page.tsx          (beacon, single-session target)
MODIFY: app/components/SchoolLandingTemplate.tsx          (beacon, shared page)
MODIFY: app/(professional)/portfolio/page.tsx             (beacon, shared page)
MODIFY: family/couples guide location [slug] pages        (beacon, shared page)
MODIFY: app/admin/content-engine/[id]/Workspace.tsx + PublicationHistory.tsx (view counts)
tests/unit/trackEventRules.test.ts · tests/integration/record-event.test.ts
```

---

### Task 1: Rules module (test-first)

**Files:**
- Create: `lib/contentEngine/trackEventRules.ts`
- Create: `tests/unit/trackEventRules.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/trackEventRules.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeEventPath, normalizeReferrer, isLikelyBot,
  TRACKED_EVENT_TYPES, TRACKED_CONTENT_TYPES,
} from "@/lib/contentEngine/trackEventRules";

describe("normalizeEventPath (spec §10)", () => {
  it("strips query/hash and accepts known route patterns", () => {
    expect(normalizeEventPath("/blog/golden-hour-sjsu?utm_source=ig#top")).toBe("/blog/golden-hour-sjsu");
    expect(normalizeEventPath("/grads/sjsu")).toBe("/grads/sjsu");
    expect(normalizeEventPath("/family-guide/locations/crissy-field")).toBe("/family-guide/locations/crissy-field");
    expect(normalizeEventPath("/portfolio")).toBe("/portfolio");
    expect(normalizeEventPath("/")).toBe("/");
  });
  it("rejects unknown routes, traversal junk, and over-long paths", () => {
    expect(normalizeEventPath("/admin/content-engine")).toBeNull();
    expect(normalizeEventPath("/api/track-event")).toBeNull();
    expect(normalizeEventPath("/blog/" + "x".repeat(300))).toBeNull();
    expect(normalizeEventPath("not-a-path")).toBeNull();
    expect(normalizeEventPath("/grads/../etc")).toBeNull();
  });
});

describe("normalizeReferrer", () => {
  it("reduces to a hostname, 'direct' when absent/invalid", () => {
    expect(normalizeReferrer("https://www.google.com/search?q=x")).toBe("www.google.com");
    expect(normalizeReferrer("https://l.instagram.com/?u=…")).toBe("l.instagram.com");
    expect(normalizeReferrer("")).toBe("direct");
    expect(normalizeReferrer(undefined)).toBe("direct");
    expect(normalizeReferrer("not a url")).toBe("direct");
  });
});

describe("isLikelyBot", () => {
  it("flags common crawlers and headless agents, passes real browsers", () => {
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("python-requests/2.31")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15")).toBe(false);
    expect(isLikelyBot(null)).toBe(true); // no UA = not a browser
  });
});

describe("allowlists (v1 records page_view + cta_click only)", () => {
  it("limits event and content types", () => {
    expect([...TRACKED_EVENT_TYPES]).toEqual(["page_view", "cta_click"]);
    expect(TRACKED_CONTENT_TYPES).toContain("blog_post");
    expect(TRACKED_CONTENT_TYPES).toContain("school_page");
  });
});
```

- [ ] **Step 2: Run** — `npm test -- trackEventRules` → FAIL.

- [ ] **Step 3: Write the module** (`lib/contentEngine/trackEventRules.ts`)

```ts
// Fail-closed event validation (spec §10): v1 records page_view + cta_click
// only; paths are query-stripped, length-capped, and must match a known public
// route pattern; referrers reduce to a hostname (no PSL dependency — the admin
// view may group known hostnames); bot UAs are dropped.
export const TRACKED_EVENT_TYPES = ["page_view", "cta_click"] as const;
export type TrackedEventType = (typeof TRACKED_EVENT_TYPES)[number];

export const TRACKED_CONTENT_TYPES = [
  "blog_post", "school_page", "guide_page", "portfolio", "page",
] as const;

const KNOWN_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/blog$/,
  /^\/blog\/[a-z0-9-]+$/,
  /^\/blog\/category\/[a-z0-9-]+$/,
  /^\/portfolio$/,
  /^\/grads\/[a-z0-9-]+$/,
  /^\/grad-guide(?:\/[a-z0-9-]+)?$/,
  /^\/family-guide(?:\/[a-z0-9-]+)?(?:\/[a-z0-9-]+)?$/,
  /^\/couples-guide(?:\/[a-z0-9-]+)?(?:\/[a-z0-9-]+)?$/,
  /^\/pricing(?:\/[a-z0-9-]+)?$/,
  /^\/(about|contact|faq|availability|bay-area-locations)$/,
];

export function normalizeEventPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const stripped = raw.split(/[?#]/)[0];
  if (stripped.length > 200) return null;
  if (stripped.includes("..")) return null;
  return KNOWN_ROUTES.some((re) => re.test(stripped)) ? stripped : null;
}

export function normalizeReferrer(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "direct";
  try {
    return new URL(raw).hostname || "direct";
  } catch {
    return "direct";
  }
}

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|preview|fetch|curl|wget|python|node-fetch|axios|monitor|scan/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}
```

- [ ] **Step 4: Run** — PASS; **Step 5: Commit**

```bash
git add lib/contentEngine/trackEventRules.ts tests/unit/trackEventRules.test.ts
git commit -m "feat: fail-closed track-event validation rules"
```

---

### Task 2: Record service with attribution (test-first)

**Files:**
- Create: `lib/contentEngine/recordEvent.ts`
- Create: `tests/integration/record-event.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/integration/record-event.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem } from "./helpers";
import { recordContentEvent } from "@/lib/contentEngine/recordEvent";

beforeAll(() => resetDb());

async function publishedLinkItem(sessionId: string) {
  const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
  const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
  // simulate a published target the reverse lookup can resolve. 'none' targets
  // are excluded from the lookup index, so use a fake portfolio target id.
  await service.from("session_content_items").update({
    status: "published", published_target_type: "portfolio_image",
    published_target_id: "424242", published_at: new Date().toISOString(),
  }).eq("id", item);
  return item;
}

describe("recordContentEvent (spec §10 attribution)", () => {
  it("shared page_view stores nulls for session/item (never false attribution)", async () => {
    const result = await recordContentEvent(service, {
      event: "page_view", path: "/grads/sjsu", contentType: "school_page",
      contentId: "sjsu", referrer: "https://www.google.com/", target: null,
    });
    expect(result.recorded).toBe(true);
    const { data } = await service.from("content_events")
      .select("*").eq("path", "/grads/sjsu").order("id", { ascending: false }).limit(1).single();
    expect(data!.event_type).toBe("page_view");
    expect(data!.referrer_domain).toBe("www.google.com");
    expect(data!.photography_session_id).toBeNull();
    expect(data!.content_item_id).toBeNull();
  });

  it("single-session content resolves the item via (target_type, target_id)", async () => {
    const sessionId = await createTestSession();
    const item = await publishedLinkItem(sessionId);

    const result = await recordContentEvent(service, {
      event: "page_view", path: "/portfolio", contentType: "portfolio",
      contentId: "424242", referrer: "", target: { type: "portfolio_image", id: "424242" },
    });
    expect(result.recorded).toBe(true);
    const { data } = await service.from("content_events")
      .select("content_item_id,photography_session_id")
      .eq("content_item_id", item).single();
    expect(data!.content_item_id).toBe(item);
    expect(data!.photography_session_id).toBe(sessionId);
  });

  it("an unresolvable target records the event with nulls (no failure, no guess)", async () => {
    const result = await recordContentEvent(service, {
      event: "page_view", path: "/blog/some-post", contentType: "blog_post",
      contentId: "999999", referrer: "", target: { type: "blog_post", id: "999999" },
    });
    expect(result.recorded).toBe(true);
    const { data } = await service.from("content_events")
      .select("photography_session_id,content_item_id")
      .eq("path", "/blog/some-post").order("id", { ascending: false }).limit(1).single();
    expect(data!.photography_session_id).toBeNull();
  });

  it("cta_click NEVER attributes to a session even when a target sneaks in", async () => {
    const sessionId = await createTestSession();
    await publishedLinkItem(sessionId);
    await recordContentEvent(service, {
      event: "cta_click", path: "/grads/sjsu", contentType: "school_page",
      contentId: "sjsu", referrer: "", target: { type: "portfolio_image", id: "424242" },
    });
    const { data } = await service.from("content_events")
      .select("photography_session_id,content_item_id").eq("event_type", "cta_click")
      .order("id", { ascending: false }).limit(1).single();
    expect(data!.photography_session_id).toBeNull();
    expect(data!.content_item_id).toBeNull();
  });

  it("rejects bad event types, bad content types, and unknown paths", async () => {
    expect((await recordContentEvent(service, {
      event: "inquiry_submit", path: "/", contentType: "page", contentId: null, referrer: "", target: null,
    })).recorded).toBe(false); // v1 allowlist
    expect((await recordContentEvent(service, {
      event: "page_view", path: "/admin/content-engine", contentType: "page", contentId: null, referrer: "", target: null,
    })).recorded).toBe(false);
    expect((await recordContentEvent(service, {
      event: "page_view", path: "/", contentType: "weird", contentId: null, referrer: "", target: null,
    })).recorded).toBe(false);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Write the service** (`lib/contentEngine/recordEvent.ts`)

```ts
// Server-side event recording (spec §10). Attribution rules: ONLY an explicit
// live-target identity resolves to an item/session (via the indexed reverse
// lookup on (published_target_type, published_target_id) — never content_id
// alone); shared pages store nulls; cta_click attributes to the page, never a
// session. Server timestamps only — content_events.viewed_at defaults to now().
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeEventPath, normalizeReferrer,
  TRACKED_EVENT_TYPES, TRACKED_CONTENT_TYPES, type TrackedEventType,
} from "@/lib/contentEngine/trackEventRules";

export interface TrackEventInput {
  event: string;
  path: string;
  contentType: string | null;
  contentId: string | null;
  referrer: string;
  target: { type: string; id: string } | null;
}

export interface RecordResult {
  recorded: boolean;
  reason?: string;
}

async function resolveAttribution(
  client: SupabaseClient, target: { type: string; id: string },
): Promise<{ contentItemId: string; sessionId: string } | null> {
  const { data: item } = await client
    .from("session_content_items")
    .select("id,package_id")
    .eq("published_target_type", target.type)
    .eq("published_target_id", target.id)
    .maybeSingle();
  if (!item) return null;
  const { data: pkg } = await client
    .from("session_content_packages")
    .select("photography_session_id").eq("id", item.package_id).single();
  return { contentItemId: item.id as string, sessionId: pkg!.photography_session_id as string };
}

export async function recordContentEvent(
  client: SupabaseClient, input: TrackEventInput,
): Promise<RecordResult> {
  if (!(TRACKED_EVENT_TYPES as readonly string[]).includes(input.event)) {
    return { recorded: false, reason: "event type not tracked" };
  }
  const path = normalizeEventPath(input.path);
  if (!path) return { recorded: false, reason: "unknown path" };
  if (input.contentType !== null
      && !(TRACKED_CONTENT_TYPES as readonly string[]).includes(input.contentType)) {
    return { recorded: false, reason: "content type not tracked" };
  }

  // attribution: single-session content only, never for CTA clicks (spec §10)
  let attribution: { contentItemId: string; sessionId: string } | null = null;
  if (input.event !== "cta_click" && input.target?.type && input.target.id) {
    attribution = await resolveAttribution(client, input.target);
  }

  const { error } = await client.from("content_events").insert({
    event_type: input.event as TrackedEventType,
    path,
    referrer_domain: normalizeReferrer(input.referrer),
    content_type: input.contentType,
    content_id: input.contentId === null ? null : String(input.contentId).slice(0, 120),
    photography_session_id: attribution?.sessionId ?? null,
    content_item_id: attribution?.contentItemId ?? null,
  });
  if (error) {
    console.error("content event insert failed:", error.message);
    return { recorded: false, reason: "insert failed" };
  }
  return { recorded: true };
}
```

- [ ] **Step 4: Run** — `npm run test:integration -- record-event` → 5/5 PASS. **Step 5: Commit**

```bash
git add lib/contentEngine/recordEvent.ts tests/integration/record-event.test.ts
git commit -m "feat: content event recording with reverse-lookup attribution"
```

---

### Task 3: Public route + beacon + page wiring

**Files:**
- Create: `app/api/track-event/route.ts`
- Create: `app/components/ContentEventBeacon.tsx`
- Modify: `app/(professional)/blog/[slug]/page.tsx`, `app/components/SchoolLandingTemplate.tsx`, `app/(professional)/portfolio/page.tsx`, the family/couples guide location `[slug]` pages

- [ ] **Step 1: Write the route** (`app/api/track-event/route.ts`)

```ts
// Public, FAIL-CLOSED analytics intake (spec §10): production-only, bot-UA
// filter, admin-cookie skip, rate-limited, 2KB body cap, allowlist-validated,
// server timestamps. Always 202 — the beacon never learns why a hit dropped.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { isLikelyBot } from "@/lib/contentEngine/trackEventRules";
import { recordContentEvent } from "@/lib/contentEngine/recordEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED = NextResponse.json({ ok: true }, { status: 202 });
const MAX_BODY_BYTES = 2048;

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return ACCEPTED;          // fail closed off-prod
  if (isLikelyBot(req.headers.get("user-agent"))) return ACCEPTED;       // bots dropped
  if (req.cookies.get("admin_session")?.value) return ACCEPTED;          // admin visits skipped

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`track:${ip}`, 30, 60_000).ok) return ACCEPTED;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return ACCEPTED;
  }
  if (raw.length === 0 || raw.length > MAX_BODY_BYTES) return ACCEPTED;

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    await recordContentEvent(createSupabaseAdminClient(), {
      event: typeof body.event === "string" ? body.event : "",
      path: typeof body.path === "string" ? body.path : "",
      contentType: typeof body.contentType === "string" ? body.contentType : null,
      contentId: typeof body.contentId === "string" ? body.contentId : null,
      referrer: typeof body.referrer === "string" ? body.referrer : "",
      target:
        body.target && typeof body.target === "object"
          && typeof (body.target as Record<string, unknown>).type === "string"
          && typeof (body.target as Record<string, unknown>).id === "string"
          ? { type: (body.target as Record<string, string>).type, id: (body.target as Record<string, string>).id }
          : null,
    });
  } catch (err) {
    console.error("track-event failed", err);
  }
  return ACCEPTED;
}
```

- [ ] **Step 2: Write the beacon** (`app/components/ContentEventBeacon.tsx`)

```tsx
"use client";
// Page-view beacon + delegated /contact CTA tracking (spec §10). Renders
// nothing. CTA clicks carry NO target — they attribute to the page only.
import { useEffect } from "react";

export interface BeaconTarget {
  type: string;
  id: string;
}

interface Props {
  contentType: "blog_post" | "school_page" | "guide_page" | "portfolio" | "page";
  contentId: string | null;
  target?: BeaconTarget | null;
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (body.length > 1900) return; // stay under the route's 2KB cap
    navigator.sendBeacon("/api/track-event", new Blob([body], { type: "application/json" }));
  } catch { /* analytics must never break the page */ }
}

export default function ContentEventBeacon({ contentType, contentId, target = null }: Props) {
  useEffect(() => {
    send({
      event: "page_view",
      path: window.location.pathname,
      contentType,
      contentId,
      referrer: document.referrer,
      target,
    });

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href^='/contact']");
      if (!anchor) return;
      send({
        event: "cta_click",
        path: window.location.pathname,
        contentType,
        contentId,
        referrer: document.referrer,
        target: null, // CTA attribution is to the page, never a session (spec §10)
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
    // mount-once per page instance is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
```

- [ ] **Step 3: Mount the beacon on the four surfaces.** In each file, import `ContentEventBeacon` and render it as the first child of the page's outermost returned element:
  - `app/(professional)/blog/[slug]/page.tsx`: the page loads the post row server-side — render `<ContentEventBeacon contentType="blog_post" contentId={post.slug} target={{ type: "blog_post", id: String(post.id) }} />` (single-session content: the target identity drives attribution).
  - `app/components/SchoolLandingTemplate.tsx`: `<ContentEventBeacon contentType="school_page" contentId={data.slug} />` (shared page — NO target).
  - `app/(professional)/portfolio/page.tsx`: `<ContentEventBeacon contentType="portfolio" contentId="portfolio" />` (shared).
  - Family + couples guide location pages (`app/(professional)/family-guide/locations/[slug]/page.tsx` and the couples equivalent — confirm exact paths with `ls`): `<ContentEventBeacon contentType="guide_page" contentId={location.slug} />` (shared). If the location page is rendered by a shared template component, mount it ONCE in the template instead of per-page.
  In every case: locate the page's data variable names by reading the file first; keep the change to import + one JSX line.

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx eslint app/api/track-event app/components/ContentEventBeacon.tsx` clean; `npx next build --webpack` green.

- [ ] **Step 5: Commit**

```bash
git add app/api/track-event app/components/ContentEventBeacon.tsx "app/(professional)/blog/[slug]/page.tsx" app/components/SchoolLandingTemplate.tsx "app/(professional)/portfolio/page.tsx"
# plus the guide location page(s)/template actually modified
git commit -m "feat: fail-closed track-event route and content event beacons"
```

---

### Task 4: Admin analytics surfaces

**Files:**
- Create: `app/api/admin/session-content/analytics/route.ts`
- Modify: `app/admin/content-engine/engineApi.ts` (one helper), `app/admin/content-engine/[id]/Workspace.tsx` (rollup + pass-through), `app/admin/content-engine/[id]/PublicationHistory.tsx` (per-item counts)

- [ ] **Step 1: Write the route** (`app/api/admin/session-content/analytics/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("content_events")
    .select("event_type,content_item_id")
    .eq("photography_session_id", sessionId);
  if (error) {
    console.error("analytics query failed", error);
    return NextResponse.json({ error: "could not load analytics" }, { status: 500 });
  }

  const perItem: Record<string, number> = {};
  let views = 0;
  let ctaClicks = 0;
  for (const row of data ?? []) {
    if (row.event_type === "page_view") {
      views += 1;
      if (row.content_item_id) {
        perItem[row.content_item_id] = (perItem[row.content_item_id] ?? 0) + 1;
      }
    } else if (row.event_type === "cta_click") {
      ctaClicks += 1;
    }
  }
  return NextResponse.json({ views, ctaClicks, perItem });
}
```

- [ ] **Step 2: engineApi helper.** Add to `engineApi` in `app/admin/content-engine/engineApi.ts`:

```ts
  analytics: (sessionId: string) =>
    request<{ views: number; ctaClicks: number; perItem: Record<string, number> }>(
      `/api/admin/session-content/analytics?sessionId=${sessionId}`,
    ),
```

- [ ] **Step 3: Workspace rollup.** In `Workspace.tsx`: add `const [analytics, setAnalytics] = useState<{views:number; ctaClicks:number; perItem:Record<string,number>} | null>(null);`, fetch it inside `refresh()` (best-effort: `engineApi.analytics(sessionId).then(setAnalytics).catch(() => setAnalytics(null))` — do NOT let it fail the workspace load), show in the sticky header next to the badge when non-null: `<span style={{ color: C.muted, fontSize: 12 }}>{analytics.views} views · {analytics.ctaClicks} CTA</span>`, and pass `viewCounts={analytics?.perItem ?? {}}` to `<PublicationHistory …/>`.

- [ ] **Step 4: PublicationHistory counts.** Add `viewCounts: Record<string, number>` to its Props and render after the date: `{viewCounts[item.id] !== undefined && <> · {viewCounts[item.id]} views</>}` (true page views exist for journal targets; placements on shared pages show interaction-resolved counts only — that nuance is already server-side in attribution).

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app/admin/content-engine app/api/admin/session-content && npm test && npm run test:integration` — all green.

```bash
git add app/api/admin/session-content/analytics/route.ts app/admin/content-engine/engineApi.ts "app/admin/content-engine/[id]/Workspace.tsx" "app/admin/content-engine/[id]/PublicationHistory.tsx"
git commit -m "feat: per-session and per-item content analytics in the workspace"
```

---

### Task 5: Wrap-up + THE PRODUCTION GATE (user authorization required — STOP)

- [ ] **Step 1:** `./scripts/content-engine/reset-test-db.sh && npm test && npm run test:integration && npx tsc --noEmit && npx next build --webpack` — all green.
- [ ] **Step 2:** Commit stragglers explicitly. Documentation note: add the retention/cleanup reminder to the checklist doc if missing (15-month `content_events` cleanup is documented-manual, spec §3.6).
- [ ] **Step 3: STOP. Present the production gate to the user** (do NOT execute any of it without explicit authorization):
  1. Apply migrations `20260611000001` … `20260611000009` to production (in order, each followed by its `_verify.sql`), plus run `supabase/test/audit-live-schema.sql` informational queries first. Note: migration 2 creates the private `session-content-originals` bucket via `storage.buckets` insert.
  2. Confirm `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set in Vercel env.
  3. Deploy a PREVIEW and verify (spec §12): sharp native binary works (upload+finalize+analyze one photo on preview), route memory/duration acceptable, `VERCEL_ENV` gating of track-event (preview must no-op).
  4. Push to origin / production deploy — user's call on timing.
  5. Post-deploy: run the manual checklist against production with a REAL test session; first real publish; verify school gallery + analytics rows.

---

## Self-Review Notes

- **Spec coverage (§10):** fail-closed route gates (production-only, bot UA, admin cookie, rate limit, 2KB cap, allowlists, normalized path ≤200 + known patterns, hostname-only referrer, server timestamps) → Tasks 1+3; attribution rules (target-identity reverse lookup never content_id alone; shared pages null; CTA → page) → Task 2; beacon surfaces (blog single-session target, school/guide/portfolio shared) → Task 3; admin per-item counts + per-session rollup → Task 4; 15-month retention stays documented-manual (§3.6). §12 deployment verification + §14 production apply → Task 5 gate (explicitly NOT executed).
- **Type consistency:** `recordContentEvent(client, TrackEventInput)` matches route + tests; beacon payload fields match the route's reads; `viewCounts` prop name consistent between Workspace and PublicationHistory; analytics route response matches the engineApi helper type.
- **No placeholders:** Task 3 Step 3's per-page mounting gives the exact JSX per surface with a read-the-file instruction for variable names only.
