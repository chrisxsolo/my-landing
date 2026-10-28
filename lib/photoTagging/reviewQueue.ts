// The review queue: what the photographer should look at next, most
// important first. Pure — photo items are built from the live audit, so a
// field that is already verified (state "ok") or marked not applicable never
// shows up. Server findings (excluded photos still live, sessions and places
// needing review) become items of the same shape in lib/reviewQueue.
//
// Each item says what it is about (thumbnail, session, school, location),
// what the records suggest versus what is saved, how strong the evidence is
// (only when that means something), why it is in the queue in plain words,
// and what to do. An item is "safe" to approve in bulk only when it has
// exactly one high-confidence, non-competing, photo-scoped answer that rests
// on records — the same rule the server applies with apply-high + photoOnly
// (lib/photoTagging/highConfidence.ts). AI vision is never safe.
import {
  evidenceOf, type AuditedPhoto, type TagCheck, type TagField, type TagSuggestion,
} from "@/lib/photoTagging/types";

export type QueueKind =
  | "excluded-live" | "school" | "grad-no-school" | "location-conflict" | "session-location"
  | "proposed-place" | "categorization" | "location" | "vision" | "spot";

export const QUEUE_PRIORITY: Record<QueueKind, number> = {
  "excluded-live": 1, school: 2, "grad-no-school": 3, "location-conflict": 4, "session-location": 5,
  "proposed-place": 6, categorization: 7, location: 8, vision: 9, spot: 10,
};

export const QUEUE_LABELS: Record<QueueKind, string> = {
  "excluded-live": "Excluded but still live",
  school: "Graduation photo missing a university",
  "grad-no-school": "Graduation session with no school",
  "location-conflict": "Location records disagree — pick one",
  "session-location": "Session location needs review",
  "proposed-place": "Proposed new place",
  categorization: "Missing categorization",
  location: "Missing location",
  vision: "AI-suggested location (low confidence)",
  spot: "Campus spot to confirm",
};

/** What a button does. "request" calls an existing admin endpoint; "href" opens the editor. */
export interface QueueAction {
  id: string;
  label: string;
  role: "approve" | "reject" | "edit";
  request?: { method: "POST" | "PATCH" | "DELETE"; url: string; body?: Record<string, unknown> };
  href?: string;
  /** Asked before a request that removes something. */
  confirm?: string;
}

export interface QueueItem {
  /** `${photoKey}:${field}` for photo items; `${kind}:${ref}` for findings. */
  id: string;
  /** Photo key for photo items (apply / dismiss target); a session or row key otherwise. */
  key: string;
  kind: QueueKind;
  field: TagField | null;
  title: string;
  /** Public URL of the photo (the UI derives a small thumbnail); null when private or not a photo. */
  url: string | null;
  sessionId: string | null;
  sessionName: string | null;
  /** School slug and location text as the records have them. */
  school: string | null;
  location: string | null;
  /** What is saved now (null = nothing). */
  before: string | null;
  /** Answers to choose from, best first. Empty = needs a manual pick in the editor. */
  options: TagSuggestion[];
  /** "GPS · high" — only when the item has one answer whose evidence matters. */
  evidence: string | null;
  explanation: string;
  recommended: string;
  /** Where Edit / Open goes. */
  href: string | null;
  /** Server-side actions for finding items (photo items act through the tagging API). */
  actions: QueueAction[];
  createdAt: string | null;
  safe: boolean;
}

const ORIGIN_LABEL: Record<TagSuggestion["origin"], string> = {
  gps: "GPS", session: "session facts", siblings: "tagged siblings", location: "location tag",
  caption: "caption text", analysis: "analysis text", vision: "AI vision",
};
const CONFIDENCE_LABEL = { high: "high", medium: "needs approval" } as const;

const isVisionOnly = (options: readonly TagSuggestion[]) =>
  options.length > 0 && options.every((s) => evidenceOf(s.origin) === "vision");

function kindOf(photo: AuditedPhoto, check: TagCheck, options: readonly TagSuggestion[]): QueueKind | null {
  if (check.field === "school") return photo.category === "grads" ? "school" : null;
  if (check.field === "spot") return options.length > 0 ? "spot" : null;
  if (check.field === "location" && isContested(options)) return "location-conflict";
  if (check.field === "location" && isVisionOnly(options)) return "vision";
  if (check.field === "location") return "location";
  return "categorization";
}

function isContested(options: readonly TagSuggestion[]): boolean {
  return options.some((s) => s.competing) || new Set(options.filter((s) => s.confidence === "high")
    .map((s) => s.value.toLowerCase())).size > 1;
}

function isSafe(options: readonly TagSuggestion[]): boolean {
  const high = options.filter((s) => s.confidence === "high");
  return high.length > 0 && !isContested(options) && high.every((s) => s.appliesTo === "photo" && evidenceOf(s.origin) !== "vision");
}

/** Evidence is shown only for a single answer; several answers each carry their own reason. */
export function evidenceLabel(options: readonly TagSuggestion[]): string | null {
  if (options.length !== 1) return null;
  const s = options[0];
  return `${ORIGIN_LABEL[s.origin]} · ${s.competing ? "disputed" : CONFIDENCE_LABEL[s.confidence]}`;
}

const FIELD_NOUN: Record<TagField, string> = { category: "category", school: "university", location: "location", spot: "campus spot" };

function explain(kind: QueueKind, check: TagCheck, options: readonly TagSuggestion[]): { explanation: string; recommended: string } {
  const noun = FIELD_NOUN[check.field];
  if (kind === "location-conflict") {
    return {
      explanation: `Records disagree about this photo's location: ${options.map((s) => s.label).join(" vs ")}.`,
      recommended: "Pick the place this photo shows — nothing is applied until you choose.",
    };
  }
  if (kind === "vision") {
    return {
      explanation: `Only AI image analysis suggests a location (${options.map((s) => s.label).join(", ")}). Looks alone never confirm a place.`,
      recommended: "Accept only if you know it is right, or dismiss it.",
    };
  }
  if (options.length === 0) return { explanation: `No ${noun} is saved and no record answers it.`, recommended: `Open the photo and set its ${noun} by hand.` };
  const best = options[0];
  return {
    explanation: `No ${noun} is saved. ${best.reason.charAt(0).toUpperCase()}${best.reason.slice(1)}.`,
    recommended: options.length === 1
      ? `Accept ${best.label}${best.appliesTo === "session" ? " (sets the whole session)" : ""}.`
      : "Choose one of the suggested answers.",
  };
}

function itemsFor(photo: AuditedPhoto): QueueItem[] {
  return photo.checks.filter((c) => c.state === "missing").flatMap((check): QueueItem[] => {
    const options = photo.suggestions.filter((s) => s.field === check.field);
    const kind = kindOf(photo, check, options);
    if (!kind) return [];
    return [{
      id: `${photo.key}:${check.field}`, key: photo.key, kind, field: check.field,
      title: photo.sessionName ?? photo.title, url: photo.url, sessionId: photo.sessionId, sessionName: photo.sessionName,
      school: photo.school, location: photo.checks.find((c) => c.field === "location")?.value ?? null,
      before: check.value, options, evidence: evidenceLabel(options), ...explain(kind, check, options),
      href: null, actions: [], createdAt: null, safe: isSafe(options),
    }];
  });
}

export function buildReviewQueue(photos: readonly AuditedPhoto[]): QueueItem[] {
  return sortByPriority(photos.flatMap(itemsFor));
}

export function sortByPriority(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => QUEUE_PRIORITY[a.kind] - QUEUE_PRIORITY[b.kind]
    || Number(b.options.length > 0) - Number(a.options.length > 0)
    || a.title.localeCompare(b.title));
}

/** Newest first; items with no date (photo items) keep their priority order after the dated ones. */
export function sortByNewest(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    if (a.createdAt || b.createdAt) return a.createdAt ? -1 : 1;
    return QUEUE_PRIORITY[a.kind] - QUEUE_PRIORITY[b.kind] || a.title.localeCompare(b.title);
  });
}

export interface QueueFilter {
  kind: QueueKind | null;
  sessionId: string | null;
  school: string | null;
}

export const EMPTY_QUEUE_FILTER: QueueFilter = { kind: null, sessionId: null, school: null };

export function filterQueue(items: readonly QueueItem[], f: QueueFilter): QueueItem[] {
  return items.filter((i) => (!f.kind || i.kind === f.kind)
    && (!f.sessionId || i.sessionId === f.sessionId)
    && (!f.school || i.school === f.school));
}

/** A photo item (Portfolio or Content Engine photo): its tags are edited in place, in the tag editor. */
export function isPhotoItem(item: Pick<QueueItem, "key">): boolean {
  return item.key.startsWith("portfolio:") || item.key.startsWith("engine:");
}

/** Photo keys whose queue items can all be approved in bulk. */
export function safeKeys(items: readonly QueueItem[]): string[] {
  return [...new Set(items.filter((i) => i.safe).map((i) => i.key))];
}
