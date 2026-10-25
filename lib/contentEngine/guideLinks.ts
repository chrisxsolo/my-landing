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

/**
 * Orders allowed links by how useful they are inside a post: the guide for
 * this exact location, then the graduate's school page, then guides, then
 * pricing, then everything else. Stable within each rank.
 */
export function prioritizeLinks<T extends { url: string }>(links: readonly T[], schoolSlug?: string | null): T[] {
  const rank = (url: string) => {
    const path = internalPath(url) ?? url;
    if (parseGuideLocationPath(path)) return 0;
    if (schoolSlug && path === `/grads/${schoolSlug}`) return 1;
    if (/-guide(?:\/|$)/.test(path)) return 2;
    if (path.startsWith("/pricing")) return 3;
    return 4;
  };
  return links.map((l, i) => ({ l, i, r: rank(l.url) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.l);
}

// ── Editorial cleanup ───────────────────────────────────────────────────────
// Navigation below an article is the website's job (blog/[slug] page), so a
// generated body must not carry its own "Keep exploring" style link list.

const GENERIC_LINK_HEADING =
  /^(?:keep exploring|explore more|related (?:resources|reading|posts|articles|guides|links)|useful (?:links|resources)|helpful (?:links|resources)|more resources|further reading|you might also like)[\s:.!]*$/i;
const LINK_BULLET = /^(?:[-*•]|\d{1,3}[.)])\s+\[[^\]]+\]\([^)\s]+\)/;

// "## Keep exploring", "**Related resources:**", "Useful links" all count.
const isGenericLinkHeading = (line: string) =>
  GENERIC_LINK_HEADING.test(line.trim().replace(/^#{1,6}\s+/, "").replace(/\*\*|__/g, "").trim());

/**
 * Removes generic link-list sections: a heading like "Keep exploring" or
 * "Related resources" followed only by bullets that start with a link. Real
 * sections (other headings, or bullets with prose) are left alone.
 */
export function stripLinkListSections(body: string): { body: string; removed: number } {
  const lines = body.split("\n");
  const kept: string[] = [];
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!isGenericLinkHeading(lines[i])) { kept.push(lines[i]); continue; }
    let j = i + 1;
    let bullets = 0;
    while (j < lines.length && (lines[j].trim() === "" || LINK_BULLET.test(lines[j].trim()))) {
      if (lines[j].trim()) bullets++;
      j++;
    }
    if (bullets === 0) { kept.push(lines[i]); continue; }
    removed++;
    i = j - 1;
  }
  return { body: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(), removed };
}

/** Keeps the first link to each internal page; later repeats become plain text. */
export function dedupeBodyLinks(body: string): string {
  const seen = new Set<string>();
  return body.replace(MARKDOWN_LINK, (whole, text: string, url: string) => {
    const path = internalPath(url);
    if (path === null) return whole;
    if (seen.has(path)) return text;
    seen.add(path);
    return whole;
  });
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
 * internal_links (the allowed-link list) and as one sentence at the end of
 * the body, which is where readers see it. Idempotent.
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

/**
 * Every generated journal body passes through this before it is stored:
 * unapproved internal links are unwrapped, generic link-list sections are
 * dropped, and repeat links to one page become plain text.
 */
export function finalizeJournalBody(
  body: string, allowed: ReadonlySet<string>,
): { body: string; removedLinks: string[]; removedSections: number } {
  const linked = sanitizeBodyLinks(body, allowed);
  const stripped = stripLinkListSections(linked.body);
  return { body: dedupeBodyLinks(stripped.body), removedLinks: linked.removed, removedSections: stripped.removed };
}
