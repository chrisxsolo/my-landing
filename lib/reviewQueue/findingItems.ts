// Turns server findings (lib/reviewQueue/findings.ts) into review-queue
// items of the same shape as the photo items. Pure — client-safe, so the
// admin builds items from the findings it fetched.
//
// Every action here reuses an EXISTING admin endpoint; nothing new can
// remove or publish anything. Approve on a proposed place publishes it
// through the library's own PATCH (which refuses a place without a
// description); Reject keeps it unpublished and takes it out of review.
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import type { LivePlacement } from "@/lib/photoExclusion/kinds";
import type { QueueAction, QueueItem } from "@/lib/photoTagging/reviewQueue";
import { enginePhotoKey, type TagSuggestion } from "@/lib/photoTagging/types";

export interface ExcludedLiveFinding {
  photoId: string;
  sessionId: string;
  sessionName: string | null;
  schoolSlug: string | null;
  url: string;
  placements: LivePlacement[];
  /** `placement:<kind>:<ref>` ids the photographer chose to keep live. */
  dismissed: string[];
  excludedAt: string | null;
}

export interface SessionFinding {
  id: string;
  name: string;
  serviceType: string;
  schoolSlug: string | null;
  location: string | null;
  syncStatus: string | null;
  syncMessage: string | null;
  createdAt: string;
  /** The audit's session-wide school suggestions for this session, when any photo carries one. */
  schoolSuggestions: TagSuggestion[];
  /** A public photo of the session, for the thumbnail. */
  url: string | null;
  /** The photo key a session-wide school write goes through. */
  photoKey: string | null;
}

export interface ProposedPlaceFinding {
  id: number;
  title: string;
  slug: string;
  city: string;
  region: string;
  origin: string;
  hasDescription: boolean;
  sessionCount: number;
  createdAt: string;
  heroUrl: string | null;
}

export interface ReviewFindings {
  excludedLive: ExcludedLiveFinding[];
  sessions: SessionFinding[];
  proposedPlaces: ProposedPlaceFinding[];
  /** Read failures — a non-empty list means the findings are incomplete. */
  errors: string[];
}

export const placementDismissId = (p: Pick<LivePlacement, "kind" | "ref">) => `placement:${p.kind}:${p.ref}`;
export const sessionHref = (id: string) => `/admin/content-engine/${id}`;
export const LOCATIONS_ADMIN_HREF = "/admin/content-engine/locations";
const LIBRARY_API = "/api/admin/location-library";

const schoolName = (slug: string | null) => (slug && isSchoolSlug(slug) ? BUILT_IN_SCHOOLS[slug].shortName : slug);

const base = (over: Partial<QueueItem> & Pick<QueueItem, "id" | "key" | "kind" | "title" | "explanation" | "recommended">): QueueItem => ({
  field: null, url: null, sessionId: null, sessionName: null, school: null, location: null, before: null,
  options: [], evidence: null, href: null, actions: [], createdAt: null, safe: false, ...over,
});

function placementAction(p: LivePlacement): QueueAction {
  const id = `${p.kind}:${p.ref}`;
  return p.removal
    ? { id, label: `Remove from ${p.where}`, role: "approve", request: p.removal, confirm: `Remove this photo from ${p.where}? The page updates right away.` }
    : { id, label: `Open ${p.where}`, role: "edit", href: p.href };
}

export function excludedLiveItems(findings: readonly ExcludedLiveFinding[]): QueueItem[] {
  return findings.flatMap((f): QueueItem[] => {
    const live = f.placements.filter((p) => !f.dismissed.includes(placementDismissId(p)));
    if (live.length === 0) return [];
    const where = live.map((p) => p.where).join("; ");
    return [base({
      id: `excluded-live:${f.photoId}`, key: enginePhotoKey(f.photoId), kind: "excluded-live",
      title: f.sessionName ?? "Session photo", url: f.url, sessionId: f.sessionId, sessionName: f.sessionName, school: f.schoolSlug,
      explanation: `This photo was excluded in the Content Engine but is still placed by hand: ${where}.`,
      recommended: "Remove it where it should not show, or choose Keep live if the placement is intended.",
      href: live[0].href, createdAt: f.excludedAt,
      actions: live.map(placementAction),
    })];
  });
}

const SYNC_LABEL: Record<string, string> = {
  needs_review: "the location could not be matched to a verified place",
  error: "the last location sync failed",
};

export function sessionItems(findings: readonly SessionFinding[]): QueueItem[] {
  return findings.flatMap((s): QueueItem[] => {
    const items: QueueItem[] = [];
    const common = { title: s.name, url: s.url, sessionId: s.id, sessionName: s.name, school: s.schoolSlug, location: s.location, href: sessionHref(s.id), createdAt: s.createdAt };
    if (s.serviceType === "grads" && !s.schoolSlug) {
      const best = s.schoolSuggestions[0];
      items.push(base({
        ...common, id: `grad-no-school:${s.id}`, key: s.photoKey ?? `session:${s.id}`, kind: "grad-no-school", field: "school",
        options: s.schoolSuggestions, evidence: s.schoolSuggestions.length === 1 ? `${best.origin === "session" ? "session facts" : best.origin} · ${best.confidence}` : null,
        explanation: `A graduation session with no school set: its photos cannot reach a school page or campus-spot guide.${best ? ` ${best.reason.charAt(0).toUpperCase()}${best.reason.slice(1)}.` : ""}`,
        recommended: best ? `Accept ${best.label} for the whole session, or set the school in Session facts.` : "Set the school in Session facts.",
      }));
    }
    if (s.syncStatus === "needs_review" || s.syncStatus === "error") {
      items.push(base({
        ...common, id: `session-location:${s.id}`, key: `session:${s.id}`, kind: "session-location", field: "location",
        before: s.location,
        explanation: `${s.location ? `"${s.location}"` : "No location is entered"} — ${SYNC_LABEL[s.syncStatus] ?? s.syncStatus}.${s.syncMessage ? ` ${s.syncMessage}` : ""}`,
        recommended: "Confirm the place on the session's Location panel (link it to a verified place or add it as a new one), then resync.",
        actions: [
          { id: `resync:${s.id}`, label: "Resync", role: "approve", request: { method: "POST", url: `${LIBRARY_API}/sync`, body: { sessionId: s.id } } },
          { id: `open:${s.id}`, label: "Open session", role: "edit", href: sessionHref(s.id) },
        ],
      }));
    }
    return items;
  });
}

export function proposedPlaceItems(findings: readonly ProposedPlaceFinding[]): QueueItem[] {
  return findings.map((p) => base({
    id: `proposed-place:${p.id}`, key: `place:${p.id}`, kind: "proposed-place", title: p.title, url: p.heroUrl,
    location: p.title, before: null, href: LOCATIONS_ADMIN_HREF, createdAt: p.createdAt,
    explanation: `${p.origin === "engine" ? "The location sync proposed" : "A draft was added for"} “${p.title}” (${p.city}, ${p.region}) from ${p.sessionCount} session${p.sessionCount === 1 ? "" : "s"}. It is not published and appears in no navigation until approved.`,
    recommended: p.hasDescription
      ? "Publish it if the place and its write-up are right, or keep it unpublished."
      : "Open it in Locations to add a description (and check the AI profile) before publishing.",
    actions: [
      ...(p.hasDescription ? [{ id: `publish:${p.id}`, label: "Publish", role: "approve" as const,
        request: { method: "PATCH" as const, url: `${LIBRARY_API}/${p.id}`, body: { active: true } }, confirm: `Publish “${p.title}” to the Bay Area locations guide?` }] : []),
      { id: `shelve:${p.id}`, label: "Keep unpublished", role: "reject", request: { method: "PATCH", url: `${LIBRARY_API}/${p.id}`, body: { active: false, needs_review: false } } },
      { id: `edit:${p.id}`, label: "Open in Locations", role: "edit", href: LOCATIONS_ADMIN_HREF },
    ],
  }));
}

export function findingItems(findings: ReviewFindings): QueueItem[] {
  return [...excludedLiveItems(findings.excludedLive), ...sessionItems(findings.sessions), ...proposedPlaceItems(findings.proposedPlaces)];
}

/** "UC Berkeley" for a filter chip; the slug itself for a custom school. */
export const schoolFilterLabel = (slug: string) => schoolName(slug) ?? slug;
