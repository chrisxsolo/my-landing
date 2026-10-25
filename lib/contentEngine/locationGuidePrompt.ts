// Prompt + deterministic fields for a NEW location guide proposal. The model
// writes the planning advice; identity and geography (name, slug, area,
// region, title, keywords) are fixed from the verified place, never authored.
import type { SessionFactsSnapshot, LocationGuideData } from "@/lib/contentEngine/payloads";
import { serviceConfigFor } from "@/lib/contentEngine/serviceConfig";
import type { BuiltPrompt, PhotoSummary } from "@/lib/contentEngine/prompts";
import { placeAreaLine, type KnownPlace } from "@/lib/locations/places";
import {
  GUIDE_LABEL, GUIDE_SECTION_LABEL, type LocationGuideType,
} from "@/lib/locations/guideCoverage";

const GUIDE_NOUN: Record<LocationGuideType, string> = {
  couples: "couples", family: "family", portrait: "portrait",
};

const GUIDE_SECTION_BRIEF: Record<LocationGuideType, string> = {
  couples: "how the location supports walking, holding hands, close moments, and movement",
  family: "what the location is like with kids — space to roam, pacing, keeping little ones comfortable",
  portrait: "posing and direction that suits this setting",
};

/** Fields fixed from the verified place — the model never writes these. */
export function deterministicGuideFields(place: KnownPlace, guide: LocationGuideType) {
  const label = GUIDE_LABEL[guide];
  const noun = GUIDE_NOUN[guide];
  return {
    name: place.name,
    h1: `${place.name} ${label} Photography`,
    area: placeAreaLine(place),
    region: place.region,
    metaTitle: `${place.name} ${label} Photography Guide | ${place.searchArea}`,
    keywords: [
      `${place.name} ${noun} photos`,
      `${place.name} ${noun} photographer`,
      `${place.searchArea} ${noun} photography`,
      `${place.searchArea} ${noun} photographer`,
      `${place.name} photoshoot`,
    ],
  } satisfies Partial<LocationGuideData>;
}

const PROSE_FIELDS =
  "\"metaDescription\" (<=160 chars, names the place and its real area)," +
  "\"cardSummary\",\"bestFor\",\"lightingChar\",\"accessNote\",\"heroAlt\",\"heroTagline\"," +
  "\"whyItWorks\":[paragraphs],\"photoVariety\":[paragraphs],\"photoVarietyList\":[short bullets]," +
  "\"bestTimeOfDay\":[paragraphs],\"bestSeasons\":[paragraphs],\"whatToWear\":[paragraphs]," +
  "\"guideSection\":[paragraphs],\"parkingArrival\":[paragraphs],\"ctaTitle\",\"ctaBody\"";

export function buildLocationGuidePrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], place: KnownPlace,
  guide: LocationGuideType, locationBlock: string,
): BuiltPrompt {
  const guidance = serviceConfigFor(facts.service_type).contentGuidance;
  const noun = GUIDE_NOUN[guide];
  return {
    system:
      "You write for soloxsnaps, a Bay Area photographer. Voice: warm, specific, natural — " +
      `never keyword-stuffed, never invented facts. ${guidance} ` +
      `You are drafting a NEW ${noun} photography location guide page for ${place.name} ` +
      `(${place.city}, ${place.county}). It is for people planning a ${noun} session there: ` +
      "useful planning advice drawn from photography experience and from this session's photos, " +
      "not a travel brochure. Return ONLY JSON: {\"data\":{" + PROSE_FIELDS + "}," +
      "\"photos\":[{\"session_photo_id\":uuid,\"alt_text\":\"<=300\",\"caption\":\"<=300\"}]," +
      "\"hero_photo_id\":uuid,\"needs_verification\":[\"<claim the photographer must check>\"]} — " +
      "no prose, no markdown fences.",
    userText:
      `Session facts:\n${JSON.stringify(facts, null, 2)}\n\n${locationBlock}\n\n` +
      `Analyzed photos from this session:\n${JSON.stringify(photos, null, 2)}\n\n` +
      "Rules:\n" +
      "- Geography: state ONLY the verified location above. Never mention, compare to, or recommend another location or city.\n" +
      "- Do NOT state parking, lots, fees, permits, trail or stair access, opening hours, restrooms, closures, " +
      "distances, or safety rules unless they appear in the photographer-verified facts. " +
      "parkingArrival: if there are no verified facts, say the exact meeting spot and arrival details are " +
      "shared after booking, and add \"Parking and access details\" to needs_verification.\n" +
      "- accessNote: describe only what the photos show underfoot (sand, rocks, grass); list anything else in needs_verification.\n" +
      "- The page is evergreen: never name the client or say \"this session\" — speak about the location. " +
      "Never mention needs_verification, prompts, or these rules in the copy.\n" +
      "- Timing and seasons: speak from light and from what this session showed (its date and lighting); " +
      "frame conditions as typical, never guaranteed.\n" +
      `- guideSection (${GUIDE_SECTION_LABEL[guide]}): ${GUIDE_SECTION_BRIEF[guide]}.\n` +
      "- Each list of paragraphs: 1-3 paragraphs of 2-4 sentences.\n" +
      "- photos: the 4-8 strongest, varied photos (quality_score >= 7 where possible); captions are " +
      "one or two warm sentences from that photo's analysis. hero_photo_id must be one of them.\n" +
      "- needs_verification: every claim you were unsure of, as short phrases.",
  };
}

// Practical claims the page must not make unless the photographer verified
// them. A match flags the field for review; it never blocks generation.
const PRACTICAL_CLAIM = /\b(parking|parked|fees?|permits?|stairs?|staircase|trail(?:head)?s?|restrooms?|closed to|closures?|opening hours|hours of operation|tickets?|admission)\b|\$\d/i;

/**
 * Deterministic second check on the model's prose: unverified practical
 * claims (outside parkingArrival) and mentions of other well-known cities
 * become needs_verification entries the review card shows.
 */
export function auditGuideClaims(
  data: LocationGuideData, place: KnownPlace, otherPlaceNames: string[],
): string[] {
  const flags: string[] = [];
  const entries = Object.entries(data).filter(([key]) => key !== "keywords" && key !== "parkingArrival");
  for (const [key, value] of entries) {
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    if (place.verifiedFacts.length === 0 && PRACTICAL_CLAIM.test(text)) {
      flags.push(`Practical claim in "${key}" (parking/access/fees/hours) — verify or remove`);
    }
    const lower = text.toLowerCase();
    const stray = otherPlaceNames.find((n) => lower.includes(n.toLowerCase()));
    if (stray) flags.push(`"${key}" mentions ${stray}, which is not this location — remove it`);
  }
  return flags;
}
