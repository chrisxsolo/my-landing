// Deterministic, service-aware meta keywords (spec §9.3: keywords come from
// the approved taxonomy/facts, never AI-invented). grads (and every non-couples
// service) keeps the exact pre-service-aware format; couples gets a dedicated
// keyword bank with location / vibe / lighting / relationship facets.
//
// Geography comes from the session's VERIFIED place (2026-10-25): a Santa Cruz
// shoot gets Santa Cruz keywords, and a session with no verified place gets no
// city at all — never a San Francisco default.
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { KNOWN_PLACES, type KnownPlace } from "@/lib/locations/places";
import { resolveLocation } from "@/lib/locations/match";

const SERVICE_KEYWORD: Record<string, string> = {
  grads: "graduation photos", couples: "couples photography", families: "family photography",
  portraits: "portrait photography", maternity: "maternity photography",
  prom: "prom photography", events: "event photography", other: "photography",
};

// Location banks keyed by a match against primary_location (case-insensitive).
const COUPLES_LOCATION_KEYWORDS: [RegExp, string[]][] = [
  [/crissy field/i, ["Crissy Field couples photoshoot", "Golden Gate Bridge couple photos"]],
  [/lovers.? lane/i, ["Lovers Lane San Francisco couple photos"]],
  [/palace of fine arts/i, ["Palace of Fine Arts couples photography"]],
  [/legion of honor/i, ["Legion of Honor couple session"]],
  [/baker beach/i, ["Baker Beach couple photos", "Golden Gate Bridge couple photos"]],
  [/botanical garden/i, ["San Francisco Botanical Garden couple photoshoot"]],
  [/golden gate park/i, ["Golden Gate Park couple photos"]],
  [/ocean beach/i, ["Ocean Beach couples photoshoot"]],
];

const GOLDEN_LIGHT = new Set(["golden_hour", "sunset"]);

const VIBE_KEYWORDS: Record<string, string> = {
  romantic: "romantic couple photos",
  playful: "playful couple photoshoot",
  candid: "candid couples photoshoot",
  cinematic: "cinematic couple photos",
  cozy: "cozy Bay Area couples photoshoot",
  editorial: "editorial couple photos",
  adventurous: "adventurous couple photoshoot",
  intimate: "intimate couples session",
  casual: "casual couple photos",
};

interface KeywordPlace { name: string; searchArea: string }

function verifiedPlace(facts: SessionFactsSnapshot, places: readonly KnownPlace[]): KeywordPlace | null {
  const resolution = resolveLocation(
    { sessionLocation: facts.primary_location, gps: null, visualHints: [] }, places,
  );
  return resolution.status === "verified"
    ? { name: resolution.place.name, searchArea: resolution.place.searchArea }
    : null;
}

function couplesKeywords(facts: SessionFactsSnapshot, places: readonly KnownPlace[]): string {
  const place = verifiedPlace(facts, places);
  const area = place?.searchArea ?? null;
  const parts: string[] = [
    area ? `couple photoshoot in ${area}` : "couple photoshoot",
    "Bay Area couples photographer",
  ];

  // The SF keyword banks apply only to the verified SF place they name; any
  // other place gets "<place> couples photos" from its canonical name.
  const loc = place?.name ?? facts.primary_location?.trim();
  if (loc) {
    const bank = area === "San Francisco" ? COUPLES_LOCATION_KEYWORDS.find(([re]) => re.test(loc)) : undefined;
    parts.push(...(bank ? bank[1] : [`${loc} couples photos`]));
  }

  if (facts.lighting_condition && GOLDEN_LIGHT.has(facts.lighting_condition)) {
    parts.push("golden hour couple photos");
  }
  if (facts.vibe && VIBE_KEYWORDS[facts.vibe]) parts.push(VIBE_KEYWORDS[facts.vibe]);

  const rel = facts.relationship_type;
  if (rel === "engagement" || rel === "proposal") {
    if (area) parts.push(`${area} engagement photos`);
    parts.push("Bay Area engagement photographer");
  } else if (area) {
    parts.push(`${area} couples session`);
  }
  parts.push("candid couples photography");

  return [...new Set(parts)].join(", ");
}

// Exact pre-existing format: school, location, service keyword, "Bay Area".
function defaultKeywords(facts: SessionFactsSnapshot): string {
  const parts = [
    facts.school_slug ? facts.school_slug.replace(/-/g, " ") : null,
    facts.primary_location,
    SERVICE_KEYWORD[facts.service_type] ?? "photography",
    "Bay Area",
  ].filter((p): p is string => !!p && p.length > 0);
  return parts.join(", ");
}

export function generateMetaKeywords(
  facts: SessionFactsSnapshot, places: readonly KnownPlace[] = KNOWN_PLACES,
): string {
  if (facts.service_type === "couples") return couplesKeywords(facts, places);
  return defaultKeywords(facts);
}
