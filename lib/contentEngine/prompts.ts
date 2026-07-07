// All engine prompts live here (spec §8.3) and carry PROMPT_VERSION, which is
// stored on every package and item. Builders accept ONLY SessionFactsSnapshot
// (no internal_client_name / internal_notes / email by type construction) plus
// closed taxonomy lists — output destinations outside those lists fail Zod
// validation downstream.
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import {
  guideLocationKeys, internalLinksForService, PORTFOLIO_CATEGORIES,
  type GuideType, type SchoolSlug,
} from "@/lib/contentEngine/taxonomy";
import { serviceConfigFor } from "@/lib/contentEngine/serviceConfig";

export const PROMPT_VERSION = "2026-07-07.1";

export interface BuiltPrompt {
  system: string;
  userText: string;
}

export interface PhotoSummary {
  session_photo_id: string;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  quality_score: number | null;
  suggested_category: string | null;
}

const BRAND =
  "You write for soloxsnaps, a Bay Area photographer (grads, couples, families). " +
  "Voice: warm, specific, natural — never keyword-stuffed, never invented facts.";

// Service-aware system prefix (2026-07-02): the per-service guidance from
// serviceConfig routes prompt voice/SEO by facts.service_type. grads guidance
// is empty by design, so grad prompts are unchanged from the pre-routing engine.
function brandFor(facts: SessionFactsSnapshot): string {
  const guidance = serviceConfigFor(facts.service_type).contentGuidance;
  return guidance ? `${BRAND} ${guidance}` : BRAND;
}

function analysisBrandFor(facts: SessionFactsSnapshot): string {
  const guidance = serviceConfigFor(facts.service_type).analysisGuidance;
  return guidance ? `${BRAND} ${guidance}` : BRAND;
}

function factsBlock(facts: SessionFactsSnapshot): string {
  return `Session facts (the ONLY facts you may use):\n${JSON.stringify(facts, null, 2)}`;
}

function summariesBlock(photos: PhotoSummary[]): string {
  return `Analyzed photos:\n${JSON.stringify(photos, null, 2)}`;
}

// CALLER CONTRACT: image blocks must be attached to the message in EXACTLY the
// order of photoIds — the prompt maps "Image N" to the Nth id. A mismatched
// order produces a silently wrong image↔id pairing that identity validation
// cannot catch (all ids would still be present and valid).
export function buildAnalysisPrompt(facts: SessionFactsSnapshot, photoIds: string[]): BuiltPrompt {
  return {
    system:
      `${analysisBrandFor(facts)} You analyze session photographs for marketing use. ` +
      "Return ONLY a JSON object — no prose, no markdown fences.",
    userText:
      `${factsBlock(facts)}\n\n` +
      `You are given ${photoIds.length} image(s). Image N corresponds to session_photo_id N in this list:\n` +
      photoIds.map((id, i) => `${i + 1}. ${id}`).join("\n") +
      "\n\nReturn JSON: {\"photos\":[{\"session_photo_id\":\"<uuid from the list>\"," +
      "\"alt_text\":\"<=300 chars, descriptive, mentions setting/light/attire\"," +
      "\"title\":\"<=160 chars\",\"description\":\"<=1000 chars\"," +
      "\"tags\":[\"<=15 short tags\"],\"quality_score\":1-10," +
      `\"suggested_category\":one of ${JSON.stringify(PORTFOLIO_CATEGORIES)} or null,` +
      "\"destination_recommendations\":{\"portfolio\":bool,\"school_page\":bool,\"guide\":bool,\"journal\":bool}}]}\n" +
      "Every listed session_photo_id must appear EXACTLY once. Key results by session_photo_id, never by position alone.",
  };
}

export interface JournalInputs {
  links: { url: string; label: string }[];
  testimonialQuote: string | null;
}

export function buildJournalPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], inputs: JournalInputs,
): BuiltPrompt {
  return {
    system:
      `${brandFor(facts)} You draft a journal/blog post about one photo session. ` +
      "Return ONLY JSON: {\"title\",\"slug\" (lowercase-kebab),\"body\" (markdown)," +
      "\"meta_description\" (<=160 chars),\"photo_ids\":[uuids],\"cover_photo_id\":uuid}. " +
      "Choose photo_ids and the cover from the provided analyzed photos only.",
    userText:
      `${factsBlock(facts)}\n\n${summariesBlock(photos)}\n\n` +
      `Internal links to weave naturally into the body where relevant (use markdown links; do not invent others):\n` +
      `${JSON.stringify(inputs.links)}\n\n` +
      (inputs.testimonialQuote
        ? `Client words to include as a blockquote, attributed to ${facts.public_display_name ?? "the client"}: "${inputs.testimonialQuote}"\n\n`
        : "") +
      "Write 350-600 words. Mention the location and light honestly.",
  };
}

export function buildPortfolioPickPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[],
): BuiltPrompt {
  return {
    system:
      `${brandFor(facts)} You select portfolio-worthy photos. Return ONLY JSON: ` +
      "{\"picks\":[{\"session_photo_id\":uuid,\"category\":" +
      `one of ${JSON.stringify(PORTFOLIO_CATEGORIES)},` +
      "\"title\":\"<=160\",\"alt_text\":\"<=300\",\"description\":\"\",\"featured\":false}]}. " +
      "Pick at most 8, only quality_score >= 7 unless nothing qualifies (then pick the best 1).",
    userText: `${factsBlock(facts)}\n\n${summariesBlock(photos)}`,
  };
}

export function buildSchoolPagePhotoPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], schoolSlug: SchoolSlug,
): BuiltPrompt {
  return {
    system:
      `${BRAND} You choose photos for a university page gallery. Return ONLY JSON: ` +
      "{\"placements\":[{\"session_photo_id\":uuid,\"school_slug\":\"" + schoolSlug + "\"," +
      "\"alt_override\":\"\",\"caption\":\"<=300\",\"sort_order\":0}]}. Pick at most 4.",
    userText: `${factsBlock(facts)}\n\nschool_slug: ${schoolSlug}\n\n${summariesBlock(photos)}`,
  };
}

export function buildGuidePhotoPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], guide: GuideType,
): BuiltPrompt {
  const keys = guideLocationKeys(guide);
  return {
    system:
      `${brandFor(facts)} You place photos on location-guide pages. Return ONLY JSON: ` +
      "{\"placements\":[{\"session_photo_id\":uuid,\"guide\":\"" + guide + "\"," +
      "\"location_key\":\"<one of the allowed keys>\",\"alt_text\":\"<=300\"," +
      "\"caption\":\"<=300\"}]}. The caption is shown under the photo on the public " +
      "guide page: one or two warm sentences drawn from this photo's analysis — the " +
      "light, the setting, the moment — useful to someone planning a session at this " +
      "location. Never generic filler. " +
      "If no allowed location matches the session, return {\"placements\":[]}.",
    userText:
      `${factsBlock(facts)}\n\nAllowed location keys for the ${guide} guide ` +
      `(any other value is invalid): ${JSON.stringify(keys)}\n\n${summariesBlock(photos)}`,
  };
}

// Link candidates are service-scoped (grads → full canonical list, unchanged;
// couples → couples guide cluster + pricing) so a couples session can never be
// pointed at grad pricing, school pages, or campus content.
export function buildInternalLinkPrompt(facts: SessionFactsSnapshot): BuiltPrompt {
  return {
    system:
      `${brandFor(facts)} You suggest internal links for a journal post. You may use ONLY ` +
      "urls from the provided list — anything else is invalid. Return ONLY JSON: " +
      "{\"links\":[{\"url\":\"<from list>\",\"label\":\"<=120\",\"reason\":\"<=300\"}]}. Suggest 2-5.",
    userText:
      `${factsBlock(facts)}\n\nCanonical internal links (closed list):\n` +
      JSON.stringify([...internalLinksForService(facts.service_type)], null, 1),
  };
}
