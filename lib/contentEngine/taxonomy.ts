// Canonical taxonomy for the Session Content Engine (spec §8.5). Single source
// of truth: school slugs match the /grads/* route segments, guide location keys
// derive from the existing guide registries, and the internal-link list is the
// CLOSED set the generator may reference. Every engine create/update path
// validates against this module so invalid slugs are unstorable.
import { getAllFamilyLocations } from "@/lib/familyGuide/locations";
import { getAllCouplesLocations } from "@/lib/couplesGuide/locations";

export const SERVICE_TYPES = [
  "grads", "couples", "families", "portraits", "maternity", "prom", "events", "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

// Matches app/(professional)/grads/<slug> directories exactly (Bay Area only;
// no UCSC / UC Davis — see project scope memory).
export const SCHOOL_SLUGS = [
  "csueb", "santa-clara", "sf-state", "sjsu", "stanford", "uc-berkeley", "usf",
] as const;
export type SchoolSlug = (typeof SCHOOL_SLUGS)[number];

// Marketing portfolio categories (the suggested_category constraint set, spec
// §3.2). NOTE: a portfolio_pick's live destination category is additionally
// validated against the portfolio_categories DB table at publish time (spec §7.4).
export const PORTFOLIO_CATEGORIES = [
  "grads", "couples", "families", "portraits", "maternity",
] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export const LIGHTING_CONDITIONS = [
  "morning", "midday", "afternoon", "golden_hour", "sunset", "blue_hour", "night",
  "soft_shade", "overcast", "harsh_light", "flash", "mixed",
] as const;
export type LightingCondition = (typeof LIGHTING_CONDITIONS)[number];

// Couples-session facets (nullable columns on photography_sessions; the DB
// check constraints in 20260702000002 mirror these lists exactly).
export const VIBES = [
  "romantic", "playful", "candid", "cinematic", "cozy",
  "editorial", "adventurous", "intimate", "casual",
] as const;
export type Vibe = (typeof VIBES)[number];

export const RELATIONSHIP_TYPES = [
  "couple", "engagement", "anniversary", "proposal", "just_because", "date_night",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const CONTENT_TYPES = [
  "journal_post", "portfolio_pick", "school_page_photo", "guide_photo",
  "social_caption", "testimonial_feature", "internal_link_suggestion",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// v1 generation offers everything EXCEPT social_caption (Phase 2, spec §8.2).
export const GENERATABLE_CONTENT_TYPES = CONTENT_TYPES.filter(
  (t) => t !== "social_caption",
) as Exclude<ContentType, "social_caption">[];

export const PUBLICATION_TARGET_TYPES = [
  "blog_post", "portfolio_image", "school_page_photo",
  "family_location_photo", "couples_location_photo", "grad_spot_photo",
  "testimonial", "none",
] as const;
export type PublicationTargetType = (typeof PUBLICATION_TARGET_TYPES)[number];

export const GUIDE_TYPES = ["family", "couples", "grad"] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

// The grad guide (/grad-guide/campus-spots) keys spots by location_spots
// school_id, which predates the /grads route slugs — berkeley≠uc-berkeley,
// sfsu≠sf-state. Schools absent here (stanford, santa-clara) have no campus
// spots guide, so grad guide generation skips them.
export const SPOT_SCHOOL_IDS: Partial<Record<SchoolSlug, string>> = {
  sjsu: "sjsu",
  "uc-berkeley": "berkeley",
  "sf-state": "sfsu",
  csueb: "csueb",
  usf: "usf",
};

// Guide location keys derive from the registries (spec §8.5: keys never drift
// from the guide pages). Includes unpublished locations: publication targeting
// is independent of a location's search-visibility flag.
const FAMILY_LOCATION_KEYS: string[] = getAllFamilyLocations().map((l) => l.slug);
const COUPLES_LOCATION_KEYS: string[] = getAllCouplesLocations().map((l) => l.slug);

// Static registries for family/couples. Grad spot keys live in the
// location_spots table (numeric row ids), so the static list is empty —
// callers that need real grad keys load them from the DB.
export function guideLocationKeys(guide: GuideType): string[] {
  if (guide === "family") return FAMILY_LOCATION_KEYS;
  if (guide === "couples") return COUPLES_LOCATION_KEYS;
  return [];
}

// Grad-guide cluster pages (matching app/(professional)/grad-guide/*) —
// grad sessions may link to these from journal posts.
export const GRAD_GUIDE_LINKS: readonly string[] = [
  "/grad-guide",
  "/grad-guide/campus-spots",
  "/grad-guide/what-to-wear",
  "/grad-guide/posing",
  "/grad-guide/how-to-prepare",
];

// Closed canonical internal-link list fed to the journal generator (spec §8.3):
// every school page, the guide hubs and clusters, the pricing hub, and the
// per-service pricing pages (matching app/(professional)/pricing/*
// directories). Output links are validated against this list — anything else
// is a validation failure.
export const CANONICAL_INTERNAL_LINKS: readonly string[] = [
  ...SCHOOL_SLUGS.map((s) => `/grads/${s}`),
  ...GRAD_GUIDE_LINKS,
  "/family-guide",
  "/couples-guide",
  ...FAMILY_LOCATION_KEYS.map((k) => `/family-guide/locations/${k}`),
  ...COUPLES_LOCATION_KEYS.map((k) => `/couples-guide/locations/${k}`),
  "/pricing",
  "/pricing/grads",
  "/pricing/couples",
  "/pricing/families",
  "/pricing/events",
];

// Service-scoped subset of CANONICAL_INTERNAL_LINKS (spec §8.3): each service
// sees only its own cluster + its own pricing page, so the generator can never
// suggest grad/campus pages for a couples session (or couples pricing for a
// grad). Everything stays inside the closed canonical list.
export function internalLinksForService(serviceType: ServiceType): readonly string[] {
  if (serviceType === "grads") {
    // The pre-service-aware full list plus the grad-guide cluster and grad
    // pricing — every other service's pricing page is filtered out.
    return CANONICAL_INTERNAL_LINKS.filter(
      (l) => !l.startsWith("/pricing/") || l === "/pricing/grads",
    );
  }
  if (serviceType === "couples") {
    return [
      "/couples-guide",
      ...COUPLES_LOCATION_KEYS.map((k) => `/couples-guide/locations/${k}`),
      "/pricing/couples",
      "/pricing",
    ];
  }
  if (serviceType === "families") {
    return [
      "/family-guide",
      ...FAMILY_LOCATION_KEYS.map((k) => `/family-guide/locations/${k}`),
      "/pricing/families",
      "/pricing",
    ];
  }
  if (serviceType === "events") {
    return ["/family-guide", "/couples-guide", "/pricing/events", "/pricing"];
  }
  return ["/family-guide", "/couples-guide", "/pricing"];
}

const has = <T extends string>(arr: readonly T[]) => {
  const set = new Set<string>(arr);
  return (v: unknown): v is T => typeof v === "string" && set.has(v);
};

// Tolerant free-text → canonical service type. Exact enum values pass through;
// anything else is pattern-matched so singular/plural/case variants ("couple",
// "Couples", "couples session", "engagement") land on the canonical value
// instead of silently falling out of the taxonomy. Order matters: first match
// wins (mirrors the original prefill mapping).
const SERVICE_TYPE_PATTERNS: [RegExp, ServiceType][] = [
  [/grad/i, "grads"],
  [/couple|engagement/i, "couples"],
  [/famil/i, "families"],
  [/maternity/i, "maternity"],
  [/prom/i, "prom"],
  [/portrait|senior/i, "portraits"],
  [/event/i, "events"],
];

export function normalizeServiceType(raw: unknown): ServiceType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if ((SERVICE_TYPES as readonly string[]).includes(lower)) return lower as ServiceType;
  for (const [pattern, service] of SERVICE_TYPE_PATTERNS) {
    if (pattern.test(value)) return service;
  }
  return null;
}

// Which guide page (if any) a service type publishes to. This is the single
// source of truth for "does this session have a guide destination" — the
// generation target and the admin UI both resolve through it, tolerant of
// singular/plural mismatches via normalizeServiceType.
export function guideTypeForService(serviceType: unknown): GuideType | null {
  const normalized = normalizeServiceType(serviceType);
  if (normalized === "couples") return "couples";
  if (normalized === "families") return "family";
  if (normalized === "grads") return "grad";
  return null;
}

export const isServiceType = has(SERVICE_TYPES);
export const isVibe = has(VIBES);
export const isRelationshipType = has(RELATIONSHIP_TYPES);
export const isSchoolSlug = has(SCHOOL_SLUGS);
export const isPortfolioCategory = has(PORTFOLIO_CATEGORIES);
export const isLightingCondition = has(LIGHTING_CONDITIONS);
export const isContentType = has(CONTENT_TYPES);
export const isGuideType = has(GUIDE_TYPES);
export const isCanonicalInternalLink = has(CANONICAL_INTERNAL_LINKS);

// Grad keys are location_spots row ids — a numeric string is structurally
// valid here; existence is enforced where the DB is reachable (the generation
// target checks against loaded spots, the publish RPC raises on missing rows).
export function isGuideLocationKey(guide: GuideType, key: unknown): boolean {
  if (typeof key !== "string") return false;
  if (guide === "grad") return /^\d+$/.test(key);
  return guideLocationKeys(guide).includes(key);
}
