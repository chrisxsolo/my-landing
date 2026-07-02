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
  "family_location_photo", "couples_location_photo", "testimonial", "none",
] as const;
export type PublicationTargetType = (typeof PUBLICATION_TARGET_TYPES)[number];

export const GUIDE_TYPES = ["family", "couples"] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

// Guide location keys derive from the registries (spec §8.5: keys never drift
// from the guide pages). Includes unpublished locations: publication targeting
// is independent of a location's search-visibility flag.
const FAMILY_LOCATION_KEYS: string[] = getAllFamilyLocations().map((l) => l.slug);
const COUPLES_LOCATION_KEYS: string[] = getAllCouplesLocations().map((l) => l.slug);

export function guideLocationKeys(guide: GuideType): string[] {
  return guide === "family" ? FAMILY_LOCATION_KEYS : COUPLES_LOCATION_KEYS;
}

// Closed canonical internal-link list fed to the journal generator (spec §8.3):
// every school page, both guide hubs, and the pricing page. Output links are
// validated against this list — anything else is a validation failure.
export const CANONICAL_INTERNAL_LINKS: readonly string[] = [
  ...SCHOOL_SLUGS.map((s) => `/grads/${s}`),
  "/family-guide",
  "/couples-guide",
  ...FAMILY_LOCATION_KEYS.map((k) => `/family-guide/locations/${k}`),
  ...COUPLES_LOCATION_KEYS.map((k) => `/couples-guide/locations/${k}`),
  "/pricing",
];

// Service-scoped subset of CANONICAL_INTERNAL_LINKS (spec §8.3): grads keeps
// the full list (unchanged behavior); couples/families see only their own
// guide cluster + pricing so the generator never suggests grad/campus pages
// for a non-grad session. Everything stays inside the closed canonical list.
export function internalLinksForService(serviceType: ServiceType): readonly string[] {
  if (serviceType === "grads") return CANONICAL_INTERNAL_LINKS;
  if (serviceType === "couples") {
    return [
      "/couples-guide",
      ...COUPLES_LOCATION_KEYS.map((k) => `/couples-guide/locations/${k}`),
      "/pricing",
    ];
  }
  if (serviceType === "families") {
    return [
      "/family-guide",
      ...FAMILY_LOCATION_KEYS.map((k) => `/family-guide/locations/${k}`),
      "/pricing",
    ];
  }
  return ["/family-guide", "/couples-guide", "/pricing"];
}

const has = <T extends string>(arr: readonly T[]) => {
  const set = new Set<string>(arr);
  return (v: unknown): v is T => typeof v === "string" && set.has(v);
};

export const isServiceType = has(SERVICE_TYPES);
export const isVibe = has(VIBES);
export const isRelationshipType = has(RELATIONSHIP_TYPES);
export const isSchoolSlug = has(SCHOOL_SLUGS);
export const isPortfolioCategory = has(PORTFOLIO_CATEGORIES);
export const isLightingCondition = has(LIGHTING_CONDITIONS);
export const isContentType = has(CONTENT_TYPES);
export const isGuideType = has(GUIDE_TYPES);
export const isCanonicalInternalLink = has(CANONICAL_INTERNAL_LINKS);

export function isGuideLocationKey(guide: GuideType, key: unknown): boolean {
  return typeof key === "string" && guideLocationKeys(guide).includes(key);
}
