// Deterministic, service-aware meta keywords (spec §9.3: keywords come from
// the approved taxonomy/facts, never AI-invented). grads (and every non-couples
// service) keeps the exact pre-service-aware format; couples gets a dedicated
// keyword bank with location / vibe / lighting / relationship facets.
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";

const SERVICE_KEYWORD: Record<string, string> = {
  grads: "graduation photos", couples: "couples photography", families: "family photography",
  portraits: "portrait photography", maternity: "maternity photography",
  prom: "prom photography", events: "event photography", other: "photography",
};

// Location banks keyed by a match against primary_location (case-insensitive).
const COUPLES_LOCATION_KEYWORDS: [RegExp, string[]][] = [
  [/crissy field/i, ["Crissy Field couples photoshoot", "Golden Gate Bridge couple photos"]],
  [/lovers lane/i, ["Lovers Lane San Francisco couple photos"]],
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

function couplesKeywords(facts: SessionFactsSnapshot): string {
  const parts: string[] = [
    "couple photoshoot in San Francisco",
    "Bay Area couples photographer",
  ];

  const loc = facts.primary_location;
  if (loc) {
    const bank = COUPLES_LOCATION_KEYWORDS.find(([re]) => re.test(loc));
    parts.push(...(bank ? bank[1] : [`${loc} couples photos`]));
  }

  if (facts.lighting_condition && GOLDEN_LIGHT.has(facts.lighting_condition)) {
    parts.push("golden hour couple photos");
  }
  if (facts.vibe && VIBE_KEYWORDS[facts.vibe]) parts.push(VIBE_KEYWORDS[facts.vibe]);

  const rel = facts.relationship_type;
  if (rel === "engagement" || rel === "proposal") {
    parts.push("San Francisco engagement photos", "Bay Area engagement photographer");
  } else {
    parts.push("San Francisco couples session");
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

export function generateMetaKeywords(facts: SessionFactsSnapshot): string {
  if (facts.service_type === "couples") return couplesKeywords(facts);
  return defaultKeywords(facts);
}
