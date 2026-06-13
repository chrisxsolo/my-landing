// Fail-closed event validation (spec §10): paths are query-stripped,
// length-capped, and must match a known public route pattern; referrers reduce
// to a hostname (no PSL dependency — the admin view may group known hostnames);
// bot UAs are dropped. The funnel events below extend the original
// page_view/cta_click pair to capture the front of the booking funnel; each
// carries the anonymous visitor id so events can be stitched into a journey.
export const TRACKED_EVENT_TYPES = [
  "page_view",
  "cta_click",
  "pricing_view",
  "estimator_start",
  "estimator_complete",
  "availability_selected",
  "inquiry_start",
  "inquiry_submit",
] as const;
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
    return (new URL(raw).hostname || "direct").slice(0, 255);
  } catch {
    return "direct";
  }
}

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|preview|fetch|curl|wget|python|node-fetch|axios|monitor|scan/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}

// Anonymous visitor id: client-generated, so accept only an opaque token of
// UUID-ish characters within the column's 64-char cap. Anything else → null
// (the event still records, just unattributed to a visitor).
export function normalizeVisitorId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
}

// Small, whitelisted funnel-event detail (e.g. estimated total, session type).
// Bounds keys, value types, and total size so the jsonb column stays compact and
// can never carry free-form or oversized client data.
const META_KEYS = new Set([
  "estimatedTotalCents", "sessionType", "school", "package", "headcount",
  "duration", "date", "addOnCount",
]);

export function sanitizeMeta(raw: unknown): Record<string, string | number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!META_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "string" && value.length > 0) {
      out[key] = value.slice(0, 120);
    }
  }
  return Object.keys(out).length ? out : null;
}
