// Shared shapes for the photo tagging audit (Portfolio + Content Engine).
// Pure module — safe for client components.
//
// A photo's tagging status is never stored: it is computed live from the same
// facts the public site uses to place photos (lib/pagePhotos/resolve.ts), so a
// "Fully Tagged" photo is exactly a photo the site can categorize. Only the
// photographer's review decisions (not applicable, dismissed suggestions) and
// cached AI vision suggestions are stored, in photo_tag_reviews.

export const PHOTO_TAG_REVIEWS_TABLE = "photo_tag_reviews";
export const PORTFOLIO_IMAGES_TABLE = "portfolio_images";
export const SESSION_PHOTOS_TABLE = "session_photos";

export type TagStatus = "full" | "partial" | "needs";
export type TagField = "category" | "school" | "location" | "spot";
/** ok = present · missing = should be filled · na = does not apply to this photo. */
export type CheckState = "ok" | "missing" | "na";
/** Low-confidence findings are never shown as suggestions — the field stays flagged for manual review. */
export type Confidence = "high" | "medium";
export type SuggestionOrigin = "session" | "siblings" | "gps" | "location" | "caption" | "analysis" | "vision";
export type PhotoSource = "portfolio" | "engine";

/** Fields the photographer may mark "not applicable" (category and school never are). */
export const NOT_APPLICABLE_FIELDS = ["location", "spot"] as const satisfies readonly TagField[];
export type NotApplicableField = (typeof NOT_APPLICABLE_FIELDS)[number];

export interface TagCheck {
  field: TagField;
  state: CheckState;
  /** A missing critical field makes the photo "Needs Tagging". */
  critical: boolean;
  /** What the photo has, as a person reads it ("UC Berkeley"). */
  value: string | null;
  /** Where the value came from ("photo tag", "session", "caption"…). */
  source: string | null;
  /** Why the field is missing or not applicable. */
  note: string | null;
}

export interface TagSuggestion {
  /** Stable id `${field}:${value}` — dismissals are stored by it. */
  id: string;
  field: TagField;
  /** The value written when accepted: school slug, place name, or spot key. */
  value: string;
  label: string;
  confidence: Confidence;
  origin: SuggestionOrigin;
  reason: string;
  /** "session" = accepting it sets the Content Engine session's fact (all its photos). */
  appliesTo: "photo" | "session";
  /**
   * Another record (GPS, the session's other locations, tagged siblings)
   * points somewhere else. Always medium; the photographer picks one — never
   * applied in bulk.
   */
  competing?: boolean;
}

export interface AuditedPhoto {
  /** "portfolio:<id>" or "engine:<uuid>". */
  key: string;
  source: PhotoSource;
  portfolioId: number | null;
  enginePhotoId: string | null;
  sessionId: string | null;
  sessionName: string | null;
  /** Public URL (portfolio image or published derivative); null for private engine photos. */
  url: string | null;
  /** Live on the public site (published portfolio row or a published derivative). */
  published: boolean;
  title: string;
  /** Canonical category (grads, couples, families, portraits…). */
  category: string | null;
  /** Effective school slug (tag, session, or caption), grads only. */
  school: string | null;
  status: TagStatus;
  checks: TagCheck[];
  suggestions: TagSuggestion[];
  /** Public pages this photo is eligible for (page keys, lib/pagePhotos/pageKeys). */
  pages: string[];
  /** Spot tags key on the public URL, so only public photos can carry one. */
  spotTaggable: boolean;
  aiAnalyzedAt: string | null;
}

export interface TagCounts {
  total: number;
  published: number;
  full: number;
  partial: number;
  needs: number;
  gradsMissingSchool: number;
  gradsMissingLocation: number;
  /** Photos with a pending location or campus-spot suggestion. */
  unresolvedLocation: number;
  /** Photos with at least one high-confidence suggestion ready to apply. */
  highConfidence: number;
}

export const TAG_FILTERS = [
  "all", "full", "partial", "needs", "grads-missing-school", "grads-missing-location", "suggestions",
] as const;
export type TagFilter = (typeof TAG_FILTERS)[number];

export interface TagFilterState {
  filter: TagFilter;
  /** Canonical category, or "" for every category. */
  category: string;
  /** School slug, "none" for grads without one, or "" for every school. */
  school: string;
}

export interface SchoolChoice { slug: string; label: string; builtIn: boolean }
export interface SpotChoice { key: string; name: string }
export interface CategoryChoice { slug: string; label: string }

export interface TaggingOptions {
  schools: SchoolChoice[];
  /** Campus spots per school slug (only schools with a spot guide). */
  spots: Record<string, SpotChoice[]>;
  categories: CategoryChoice[];
  /** Known place names, for the location field's suggestions. */
  places: string[];
}

export interface TaggingReport {
  photos: AuditedPhoto[];
  counts: TagCounts;
  options: TaggingOptions;
  /** Read failures — a non-empty list means the audit is incomplete. */
  errors: string[];
}

/** What a bulk or single edit asks for. Absent = leave unchanged; null = clear (replace mode only). */
export interface TagChanges {
  category?: string;
  school?: string | null;
  location?: string | null;
  spot?: string | null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  grads: "Graduation",
  couples: "Couples",
  families: "Families",
  portraits: "Portraits",
  maternity: "Maternity",
  proposals: "Proposals",
  elopements: "Elopements",
  prom: "Prom",
  events: "Events",
  other: "Other",
};

export const STATUS_LABELS: Record<TagStatus, string> = {
  full: "Fully Tagged",
  partial: "Partially Tagged",
  needs: "Needs Tagging",
};

export const FILTER_LABELS: Record<TagFilter, string> = {
  all: "All Photos",
  full: "Fully Tagged",
  partial: "Partially Tagged",
  needs: "Needs Tagging",
  "grads-missing-school": "Grads missing university",
  "grads-missing-location": "Grads missing campus location",
  suggestions: "Unresolved location suggestions",
};

export function categoryLabel(slug: string | null): string {
  if (!slug) return "No category";
  return CATEGORY_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Raw portfolio_categories slug → canonical vocabulary. ("portraits" stays portraits here.) */
export function canonicalCategory(raw: string | null | undefined): string | null {
  const slug = raw?.trim().toLowerCase();
  if (!slug || slug === "portfolio") return null;
  if (slug === "graduation") return "grads";
  if (slug === "family") return "families";
  return slug;
}

export function portfolioPhotoKey(id: number): string {
  return `portfolio:${id}`;
}

export function enginePhotoKey(id: string): string {
  return `engine:${id}`;
}

const PHOTO_KEY = /^(portfolio:\d{1,12}|engine:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function isPhotoKey(value: unknown): value is string {
  return typeof value === "string" && PHOTO_KEY.test(value);
}
