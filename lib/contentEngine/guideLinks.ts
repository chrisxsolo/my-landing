// Internal-link safety for generated journal posts (pure functions).
//
// 1. sanitizeBodyLinks — the model may only link URLs it was given. Any other
//    internal link in the markdown body is unwrapped to plain text. This is
//    the check that was missing when a Santa Cruz post linked the San
//    Francisco Ocean Beach guide.
// 2. Pending guide links — a journal can reference a location guide that is
//    still a proposal. The reference lives in pending_guide_links only, so a
//    broken public URL can never ship. Publishing the guide turns it into a
//    real link; rejecting the guide drops it. The body is never touched by a
//    rejection because a pending guide is never linked in the body.
import type { PendingGuideLink } from "@/lib/contentEngine/payloads";
import { parseGuideLocationPath, type LocationGuideType } from "@/lib/locations/guideCoverage";

// Real top-level pages a post may always link (the conversion path), beyond
// the per-session list the model is given.
export const ALWAYS_ALLOWED_PATHS: readonly string[] = [
  "/", "/contact", "/portfolio", "/pricing", "/about", "/faq", "/blog", "/availability",
];

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SITE_ORIGIN = /^https?:\/\/(?:www\.)?soloxsnaps\.com(?=\/|$)/i;

/** "/couples-guide" for internal links (relative or on our domain), else null. */
export function internalPath(url: string): string | null {
  if (url.startsWith("/") && !url.startsWith("//")) return url.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (SITE_ORIGIN.test(url)) return internalPath(url.replace(SITE_ORIGIN, "") || "/");
  return null;
}

/** Every internal path linked from a markdown body. */
export function internalLinksInBody(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(MARKDOWN_LINK)) {
    const path = internalPath(m[2]);
    if (path) found.push(path);
  }
  return found;
}

/** Unwraps internal links that are not in the allowed set. External links are left alone. */
export function sanitizeBodyLinks(
  body: string, allowed: ReadonlySet<string>,
): { body: string; removed: string[] } {
  const removed: string[] = [];
  const next = body.replace(MARKDOWN_LINK, (whole, text: string, url: string) => {
    const path = internalPath(url);
    if (path === null || allowed.has(path)) return whole;
    removed.push(path);
    return text;
  });
  return { body: next, removed };
}

interface JournalLinkFields {
  body: string;
  internal_links?: { url: string; label: string }[];
  pending_guide_links?: PendingGuideLink[];
}

const sameGuide = (guide: LocationGuideType, locationKey: string) =>
  (p: PendingGuideLink) => p.guide === guide && p.location_key === locationKey;

export function hasPendingGuideLink(
  payload: JournalLinkFields, guide: LocationGuideType, locationKey: string,
): boolean {
  return (payload.pending_guide_links ?? []).some(sameGuide(guide, locationKey));
}

/** The sentence added to a journal body when its pending guide goes live. */
export function guideLinkSentence(link: PendingGuideLink, url: string): string {
  return `Planning a session at ${link.place_name}? The [${link.label}](${url}) covers the light, timing, and what to expect.`;
}

/**
 * The guide is live: replace the pending reference with a real link — in
 * internal_links (rendered under "Keep exploring") and as one sentence at the
 * end of the body. Idempotent.
 */
export function applyGuideLink<T extends JournalLinkFields>(
  payload: T, guide: LocationGuideType, locationKey: string, url: string,
): T {
  const pending = payload.pending_guide_links ?? [];
  const link = pending.find(sameGuide(guide, locationKey));
  if (!link) return payload;
  const links = payload.internal_links ?? [];
  const alreadyLinked = internalLinksInBody(payload.body).includes(url);
  return {
    ...payload,
    body: alreadyLinked ? payload.body : `${payload.body.trimEnd()}\n\n${guideLinkSentence(link, url)}`,
    internal_links: links.some((l) => l.url === url) ? links : [...links, { url, label: link.label }],
    pending_guide_links: pending.filter((p) => !sameGuide(guide, locationKey)(p)),
  };
}

/** The guide went live after this journal was approved: flag it, change nothing else. */
export function markGuideLinkReady<T extends JournalLinkFields>(
  payload: T, guide: LocationGuideType, locationKey: string,
): T {
  const pending = payload.pending_guide_links ?? [];
  return {
    ...payload,
    pending_guide_links: pending.map((p) => (sameGuide(guide, locationKey)(p) ? { ...p, status: "ready" as const } : p)),
  };
}

/** The guide was rejected: forget the dependency. Body and live links are untouched. */
export function dropPendingGuideLink<T extends JournalLinkFields>(
  payload: T, guide: LocationGuideType, locationKey: string,
): T {
  const pending = payload.pending_guide_links ?? [];
  return { ...payload, pending_guide_links: pending.filter((p) => !sameGuide(guide, locationKey)(p)) };
}

/**
 * Location-guide links a journal would publish that do not resolve to a live
 * guide page (static or database). Other internal paths are not judged here.
 */
export function brokenGuideLinks(
  payload: JournalLinkFields, isLiveGuidePath: (path: string) => boolean,
): string[] {
  const paths = [
    ...(payload.internal_links ?? []).map((l) => internalPath(l.url) ?? l.url),
    ...internalLinksInBody(payload.body),
  ];
  return [...new Set(paths)].filter((p) => parseGuideLocationPath(p) !== null && !isLiveGuidePath(p));
}
