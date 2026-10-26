// All engine prompts live here (spec §8.3) and carry PROMPT_VERSION, which is
// stored on every package and item. Builders accept ONLY SessionFactsSnapshot
// (no internal_client_name / internal_notes / email by type construction) plus
// closed taxonomy lists — output destinations outside those lists fail Zod
// validation downstream.
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import {
  PORTFOLIO_CATEGORIES, type GuideType, type SchoolSlug,
} from "@/lib/contentEngine/taxonomy";
import { serviceConfigFor } from "@/lib/contentEngine/serviceConfig";

export const PROMPT_VERSION = "2026-10-26.1";

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
  "Voice: warm, specific, natural — never keyword-stuffed, never invented facts. " +
  "Name only the places in the session facts: never recommend, suggest, or pair another " +
  "location (being near the campus or session is not a reason to mention one), and never " +
  "say Chris has photographed somewhere the facts do not show.";

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

// The school is spelled out because a slug alone ("uc-law-san-francisco")
// invites the model to guess — or swap in a better-known campus.
function schoolRule(facts: SessionFactsSnapshot): string {
  if (!facts.school_name) return "";
  const short = facts.school_short_name && facts.school_short_name !== facts.school_name
    ? ` (short name: ${facts.school_short_name})` : "";
  return `\n\nThe graduate's school is ${facts.school_name}${short}. Refer to it only by that name ` +
    "or its short name, and never name a different university or campus as the school.";
}

function factsBlock(facts: SessionFactsSnapshot): string {
  return `Session facts (the ONLY facts you may use):\n${JSON.stringify(facts, null, 2)}${schoolRule(facts)}`;
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

// Curation pass (summaries only, no image bytes): everything NOT picked gets
// excluded, so the prompt demands EXACTLY `count` picks — a short list would
// silently shrink the session's usable pool and strict validation rejects it.
export function buildTopPicksPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], count: number,
): BuiltPrompt {
  return {
    system:
      `${brandFor(facts)} You curate a photo session down to its strongest selects. ` +
      "Return ONLY JSON: {\"picks\":[\"<session_photo_id uuid>\", ...]} — no prose, no markdown fences.",
    userText:
      `${factsBlock(facts)}\n\n${summariesBlock(photos)}\n\n` +
      `Pick EXACTLY ${count} photos to keep as this session's selects. ` +
      "Favor higher quality_score, then variety — different settings, poses, and " +
      "compositions across the set. Avoid near-duplicates: when several photos' " +
      "alt_text/tags describe the same moment, keep only the strongest one. " +
      "Every pick must be a session_photo_id from the list above, each at most once.",
  };
}

export interface JournalInputs {
  /** Allowed internal links, most relevant first (see prioritizeLinks). */
  links: { url: string; label: string }[];
  /** Existing posts on the same service the body may link once, if useful. */
  relatedPosts?: { url: string; title: string }[];
  testimonialQuote: string | null;
  /** verifiedPlaceBlock() — the only geography the post may state. */
  locationBlock: string;
}

// The model once wrote a link to a guide page it guessed from the URL pattern
// (a Santa Cruz post linking the San Francisco Ocean Beach guide). Every body
// link is now checked against the provided list after generation, and the
// prompt says so plainly.
const LINK_RULE =
  "Use ONLY the internal links listed above, exactly as given. Never write any " +
  "other link or URL, never guess a page address, and never point readers to a " +
  "different location than the one this session was photographed at.";

// Links belong inside the story, not in a list at the end: the public page
// already shows its own navigation and booking button below every post.
const JOURNAL_LINKING =
  "Weave 2-4 of these links into paragraphs where they genuinely fit, as Markdown " +
  "links with natural, descriptive anchor text that names the page — for example: " +
  "\"If you're planning a session here, my [<that page's title>](<its url>) covers " +
  "the best light and spots.\" The list is ordered most relevant first: prefer the " +
  "guide for this exact location over a broad guide. Link each page at most once, " +
  "never put a link in a sentence that exists only to hold it, and use fewer links " +
  "rather than forcing one.";

const JOURNAL_STRUCTURE =
  "Write it as a photographer's journal entry, not an SEO article. Flow: open with " +
  "the session itself; then the location and how it looks; then the experience and " +
  "the moments that stood out; then useful context about the location, light, or " +
  "timing; then a short, natural closing paragraph. Use plain paragraphs — a ## " +
  "heading only if the post truly needs one. Never add a \"Keep exploring\", " +
  "\"Related resources\", \"Useful links\" or any other list of links or pages, and " +
  "mention booking at most once, lightly — the page has its own booking button.";

function relatedPostsBlock(posts: JournalInputs["relatedPosts"]): string {
  if (!posts?.length) return "";
  return `Earlier journal posts you may link at most ONE of, only if it adds something ` +
    `useful for the reader (same rules as above):\n${JSON.stringify(posts)}\n\n`;
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
      `${inputs.locationBlock}\n\n` +
      `Internal links (most relevant first):\n` +
      `${JSON.stringify(inputs.links)}\n${JOURNAL_LINKING}\n\n` +
      relatedPostsBlock(inputs.relatedPosts) +
      `${LINK_RULE}\n\n` +
      (inputs.testimonialQuote
        ? `Client words to include as a blockquote, attributed to ${facts.public_display_name ?? "the client"}: "${inputs.testimonialQuote}"\n\n`
        : "") +
      `${JOURNAL_STRUCTURE}\n\nWrite 350-600 words. Mention the location and light honestly.`,
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

// The location is decided BEFORE this prompt (deterministic place match), so
// the model only chooses photos and writes captions for that one guide page —
// it never picks which location the session belongs to.
export function buildGuidePhotoPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], guide: GuideType,
  keys: string[], locationBlock: string,
): BuiltPrompt {
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
      `${factsBlock(facts)}\n\n${locationBlock}\n\nAllowed location keys for the ${guide} guide ` +
      `(any other value is invalid): ${JSON.stringify(keys)}\n\n${summariesBlock(photos)}`,
  };
}

export interface GradSpotSummary {
  id: number;
  name: string;
  description: string;
  tip: string;
}

// Grad guide placements target the campus-spots guide, where each spot is a
// single image slot — publishing REPLACES the spot's current photo, so the
// bar is "clearly this spot, clearly excellent", not "best available".
export function buildGradSpotPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], spots: GradSpotSummary[],
): BuiltPrompt {
  return {
    system:
      `${brandFor(facts)} You match graduation photos to a campus photo-spots guide. ` +
      "Return ONLY JSON: {\"placements\":[{\"session_photo_id\":uuid,\"guide\":\"grad\"," +
      "\"location_key\":\"<spot id as a string>\",\"alt_text\":\"<=300, descriptive\"," +
      "\"caption\":\"\"}]}. At most ONE photo per spot. Each placement replaces the " +
      "spot's current example photo on the public guide, so only place a photo when it " +
      "clearly shows that spot (or unmistakably matches its setting) AND is strong " +
      "enough to represent it (quality_score >= 7). " +
      "If no photo meets that bar for any spot, return {\"placements\":[]}.",
    userText:
      `${factsBlock(facts)}\n\nCampus spots for this school (location_key must be one ` +
      `of these ids, as a string; any other value is invalid):\n` +
      `${JSON.stringify(spots, null, 1)}\n\n${summariesBlock(photos)}`,
  };
}

// Link candidates are service-scoped (grads → full canonical list; couples →
// couples guide cluster + pricing) so a couples session can never be pointed
// at grad pricing, school pages, or campus content — and location pages are
// limited to the guide that covers the session's verified place
// (sessionLocation.allowedInternalLinks), so a Santa Cruz shoot is never
// offered a San Francisco beach guide.
export function buildInternalLinkPrompt(
  facts: SessionFactsSnapshot, allowedUrls: readonly string[], locationBlock: string,
): BuiltPrompt {
  return {
    system:
      `${brandFor(facts)} You suggest internal links for a journal post. You may use ONLY ` +
      "urls from the provided list — anything else is invalid. Return ONLY JSON: " +
      "{\"links\":[{\"url\":\"<from list>\",\"label\":\"<=120\",\"reason\":\"<=300\"}]}. " +
      "Suggest 2-4 that a reader of this post would genuinely want, in this priority: " +
      "the guide for this session's exact location; for graduates, their school's page; " +
      "the service's guide; the service's pricing page. Never pad the list.",
    userText:
      `${factsBlock(facts)}\n\n${locationBlock}\n\nCanonical internal links (closed list):\n` +
      JSON.stringify([...allowedUrls], null, 1),
  };
}
