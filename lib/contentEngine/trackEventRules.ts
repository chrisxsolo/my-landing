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
