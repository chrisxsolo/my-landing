// First-party anonymous visitor identity + funnel event senders (client-only).
//
// A persistent visitor id (first-party cookie, ~13 months, mirrored to
// localStorage) is the join key for full-funnel attribution: it travels from
// the first page view, through the estimator and inquiry form, and is stamped
// onto the inquiry at submit — so payments(inquiry_id) can be traced back to the
// landing page, referrer, and UTM campaign that first brought the visitor in.
//
// All sends are fire-and-forget and must NEVER throw into page code. The server
// intake (/api/track-visitor, /api/track-event) is fail-closed and authoritative
// for timestamps, allowlists, and rate limiting — this module only gathers.

const VISITOR_COOKIE = "sx_vid";
const VISITOR_LS_KEY = "sx_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months, in seconds
const MAX_BEACON_BYTES = 1900; // stay under the route's 2KB cap

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through to manual */ }
  // RFC4122-ish fallback for older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

// Resolve the persistent visitor id, creating and persisting one on first call.
// Cookie is the source of truth (sent to the server automatically); localStorage
// is a backup in case the cookie is cleared but storage survives.
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = readCookie(VISITOR_COOKIE);
  if (!id) {
    try { id = window.localStorage.getItem(VISITOR_LS_KEY); } catch { /* storage blocked */ }
  }
  if (!id) id = uuid();
  writeCookie(VISITOR_COOKIE, id);
  try { window.localStorage.setItem(VISITOR_LS_KEY, id); } catch { /* storage blocked */ }
  return id;
}

function utmFromUrl(): Record<string, string | null> {
  const out: Record<string, string | null> = {
    utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null,
  };
  try {
    const q = new URLSearchParams(window.location.search);
    out.utmSource = q.get("utm_source");
    out.utmMedium = q.get("utm_medium");
    out.utmCampaign = q.get("utm_campaign");
    out.utmContent = q.get("utm_content");
  } catch { /* ignore malformed query */ }
  return out;
}

function send(url: string, payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (body.length > MAX_BEACON_BYTES) return;
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else if (typeof fetch !== "undefined") {
      fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } })
        .catch(() => { /* analytics must never break the page */ });
    }
  } catch { /* analytics must never break the page */ }
}

// Upsert the visitor session. Sends the CURRENT page/referrer/UTM; the server's
// upsert keeps first-touch landing_page/first_referrer/utm and refreshes only
// latest_referrer + last_seen_at, so calling this on every page is correct.
export function captureVisitor() {
  if (typeof window === "undefined") return;
  send("/api/track-visitor", {
    id: getVisitorId(),
    landingPage: window.location.pathname,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    ...utmFromUrl(),
  });
}

export interface FunnelEventInput {
  event: string;
  path?: string;
  contentType?: string | null;
  contentId?: string | null;
  meta?: Record<string, unknown> | null;
}

// Emit a funnel event with the visitor id auto-attached.
export function trackEvent(input: FunnelEventInput) {
  if (typeof window === "undefined") return;
  send("/api/track-event", {
    event: input.event,
    path: input.path ?? window.location.pathname,
    contentType: input.contentType ?? "page",
    contentId: input.contentId ?? null,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    target: null,
    anonymousSessionId: getVisitorId(),
    meta: input.meta ?? null,
  });
}
