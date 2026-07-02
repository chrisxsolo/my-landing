// Per-service content configuration (spec §8.3 extension, 2026-07-02): voice
// guidance injected into generation prompts, photo-analysis guidance, and
// admin-UI placeholders — routed by ServiceType with grads as the fallback.
// grads guidance is intentionally EMPTY: grad prompts stay byte-identical to
// the pre-service-aware engine (regression guarantee).
import type { ServiceType } from "@/lib/contentEngine/taxonomy";

export interface ServiceContentConfig {
  // Appended to the brand line of every generation prompt's system message.
  contentGuidance: string;
  // Appended to the photo-analysis system message.
  analysisGuidance: string;
  // Admin-UI copy (FactsSection / editors).
  summaryPlaceholder: string;
  keywordsPlaceholder: string;
}

const GRAD_TERMS_RULE =
  "Never mention graduation, school, campus, cap and gown, stoles, diplomas, " +
  "graduation announcements, or senior photos unless the session facts or the " +
  "photos themselves explicitly include them.";

const COUPLES_CONTENT_GUIDANCE =
  "This session is a COUPLES photography session, not a graduation session. " +
  "Write in a casual, warm, natural photography voice — like a photographer " +
  "describing a real session. Focus on the couple's connection, movement, " +
  "location, lighting, styling, and emotional feel. Do not over-romanticize " +
  "and avoid generic luxury language. " + GRAD_TERMS_RULE + " " +
  "Weave in (naturally, never stuffed) SEO phrasing such as: couples " +
  "photography, San Francisco couple photoshoot, Bay Area couples " +
  "photographer, engagement-style photography, golden hour couple photos, " +
  "candid couples photography, romantic Bay Area photoshoot locations, and " +
  "location-specific couple-session phrases. Title style examples: " +
  "\"Couples Photoshoot at Crissy Field in San Francisco\", " +
  "\"Golden Hour Couples Session at Lovers Lane\", " +
  "\"Romantic Couple Photos at Palace of Fine Arts\", " +
  "\"Playful San Francisco Couple Session at Baker Beach\". " +
  "Caption/intro tone example: \"couple photoshoot at crissy field in san " +
  "francisco! loved how these two brought such a playful and natural energy " +
  "to the session. even with the fog rolling in, it gave the whole gallery " +
  "that classic sf feel.\"";

const COUPLES_ANALYSIS_GUIDANCE =
  "These are couples photos. Describe connection, interaction, movement, " +
  "pose, emotion, setting, light quality, composition, outfit coordination, " +
  "and whether the frame feels candid or posed. " + GRAD_TERMS_RULE;

// Non-grad, non-couples services get a light generic-portrait steer so grad
// language never leaks in; full keyword banks can be added per service later.
function genericConfig(noun: string): ServiceContentConfig {
  return {
    contentGuidance:
      `This session is a ${noun} photography session, not a graduation session. ` +
      "Write in a casual, warm, natural photography voice about the people, " +
      `location, lighting, and feel of the session. ${GRAD_TERMS_RULE}`,
    analysisGuidance:
      `These are ${noun} photos. Describe the people, emotion, setting, light ` +
      `quality, and composition. ${GRAD_TERMS_RULE}`,
    summaryPlaceholder:
      `What made this ${noun} session special — location, light, people, moments`,
    keywordsPlaceholder:
      `Bay Area ${noun} photographer, San Francisco ${noun} photos`,
  };
}

export const SERVICE_PROMPTS: Record<ServiceType, ServiceContentConfig> = {
  grads: {
    contentGuidance: "",
    analysisGuidance: "",
    summaryPlaceholder:
      "What made this grad session special — campus, light, outfits, moments",
    keywordsPlaceholder:
      "sjsu graduation photos, Bay Area grad photographer, golden hour campus session",
  },
  couples: {
    contentGuidance: COUPLES_CONTENT_GUIDANCE,
    analysisGuidance: COUPLES_ANALYSIS_GUIDANCE,
    summaryPlaceholder:
      "The couple, the location, the vibe, and the light — e.g. a playful golden hour session for two at Crissy Field with the bridge behind the fog",
    keywordsPlaceholder:
      "couple photoshoot in San Francisco, Bay Area couples photographer, golden hour couple photos, Crissy Field couples session",
  },
  families: genericConfig("family"),
  portraits: genericConfig("portrait"),
  maternity: genericConfig("maternity"),
  prom: genericConfig("prom"),
  events: genericConfig("event"),
  other: genericConfig("portrait"),
};

// Route by service type; unknown/legacy values fall back to grads so existing
// sessions and stored snapshots keep behaving exactly as before.
export function serviceConfigFor(serviceType: string | null | undefined): ServiceContentConfig {
  return SERVICE_PROMPTS[serviceType as ServiceType] ?? SERVICE_PROMPTS.grads;
}
