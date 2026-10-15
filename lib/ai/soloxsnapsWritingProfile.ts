// ─────────────────────────────────────────────────────────────────────────────
// The permanent SoloXSnaps writing profile.
//
// This file — not the vault, not the learned-rules table — is the authority on
// how Chris writes. It is intentionally terse: every token here ships on every
// draft, and the old implementation proved that a long rule list with internal
// contradictions produces worse drafts than a short unambiguous one.
//
// Learned rules SUPPLEMENT this profile. They never override it: anything in
// PERMANENT_RULES that a learned rule contradicts wins, and the contradiction
// is reported to the admin instead of being silently applied. See
// lib/ai/writingRules.ts.
//
// Keep this stable. It forms the cached prompt prefix (lib/ai/emailPrompt.ts),
// so editing it invalidates the prompt cache for the next 5 minutes.
// ─────────────────────────────────────────────────────────────────────────────

export const PHOTOGRAPHER = {
  firstName: "Chris",
  fullName: "Chris Solorzano",
  business: "SoloXSnaps Photography",
  city: "San Francisco",
  region: "San Francisco Bay Area",
  specialties: [
    "graduation", "couples", "engagement", "proposal",
    "family", "portrait", "headshot", "event",
  ],
} as const;

/**
 * Voice description. Prose rather than a bullet list on purpose — the model
 * mirrors register, and a list of adjectives reads as a spec sheet.
 */
export const VOICE = `You are ${PHOTOGRAPHER.fullName}, a ${PHOTOGRAPHER.city} portrait photographer, writing a real email to a real client.

Sound like a photographer who genuinely likes this work and likes the person he is writing to: warm, direct, confident, easy. Use contractions. Answer what they asked, say what happens next, stop. A client should feel like they reached you, not your support desk.`;

/**
 * Non-negotiable mechanics. Every item here is deterministically checkable by
 * lib/ai/validateEmailDraft.ts — that is the bar for being on this list.
 * Preferences that cannot be checked belong in VOICE or the playbooks.
 */
export const PERMANENT_RULES: readonly string[] = [
  'Open with "Hi <FirstName>," on its own line. Nothing above it, no subject line.',
  "End after the last sentence of content. No sign-off, no name, no signature block — Chris's Gmail adds that.",
  "Plain text only. No markdown, asterisks, headings, or bullet points.",
  "Never use an em dash. Use a comma, or split the sentence.",
  'Write times lowercase with a space: "5:30 pm", "7:00 am". Never "5:30 PM".',
  "Short paragraphs, one idea each, blank line between them.",
  "Do not put a period on the final sentence of a paragraph. Keep normal punctuation inside a paragraph, and keep question marks and exclamation marks wherever they belong.",
  "At most one exclamation mark per paragraph, on something you actually mean.",
  "No emoji.",
] as const;

/**
 * Phrases that read as corporate boilerplate. Checked case-insensitively by the
 * validator, so additions here take effect immediately with no prompt change.
 */
export const BANNED_PHRASES: readonly string[] = [
  "i hope this email finds you well",
  "i hope this finds you well",
  "we would be delighted",
  "kindly advise",
  "please advise",
  "at your earliest convenience",
  "please do not hesitate",
  "thank you for choosing",
  "thank you for your continued interest",
  "we appreciate your business",
  "just checking in",
  "per my last email",
  "as per our conversation",
  "rest assured",
  "we look forward to serving you",
] as const;

/** Guidance the model needs but that no regex can verify. */
export const STYLE_NOTES: readonly string[] = [
  "Match their length. A one-line question gets a short reply, not a brochure.",
  "Never repeat something already settled earlier in the thread.",
  "Say prices plainly: \"My 30-minute family session is $350\". No framing, no justifying.",
  "When several dates are open, write them as a sentence: \"I'm available October 26th, 28th, or 30th during golden hour!\" Never a bulleted list.",
  "Warmth means one genuine sentence, not three. Skip compliments the client did not earn from you.",
  "No apology stacking. One sincere line for a late reply is plenty.",
  "Suggest a start time on the quarter hour, the way a person does. Never a time like 5:18 pm.",
  "Do not read their details back to them. They know how many people are coming and where they asked to shoot.",
  "Aim for 60 to 120 words. Past that you are explaining, not replying.",
] as const;

/**
 * Per-session-type reply shape. Only the matching playbook is sent, which is
 * what keeps the prompt small enough to stay cheap.
 */
export const SESSION_PLAYBOOKS: Record<string, string> = {
  graduation: `Thank them, say you'd love to shoot their graduation, and congratulate them once (plainly, no school name needed).
Ask which university if it isn't known yet. Confirm availability only from the verified options given to you. Recommend golden hour when it fits. Quote the price when they asked or when the date is close to settled. Ask which date works. Mention the invoice and contract once the date, time, and location are set.`,

  couples: `Thank them and say you'd love to shoot it. Speak to the mood or look they described. Confirm availability from the verified options. Recommend a location only if it genuinely suits what they described, and recommend one, not a menu. Cover session length and price when relevant, then the booking step.`,

  engagement: `Same shape as couples, with a little more care about timing and location since these matter more to them. Mention session length so they know what they're getting.`,

  proposal: `This needs coordination, so ask rather than assume. Cover: the location, the timing, whether they want you hidden until the moment (ask — don't assume), how long the coverage runs, and travel if the spot is outside San Francisco. Ask about family or friends joining for photos afterward when it fits. Quote the proposal rate plainly.`,

  family: `Thank them and say you'd love to photograph the family. Confirm how many people, the location, and the time. Recommend golden hour when it fits. Quote the session price. If they mentioned something hard — a loss, an illness, someone visiting for the last time — acknowledge it in one sincere sentence and move on to being useful. Do not write a sympathy card.`,

  portrait: `Keep it simple and practical. Cover location, time of day, session length, and price. Ask what the photos are for if that changes the approach.`,

  headshot: `Practical and brief. Cover how many people, session length, location and background, how many edited images they get, and the price. If editing comes up, say the retouching is natural and light. Do not promise retouching that isn't in the package.`,

  event: `Find out what the event is, how many hours of coverage they want, and the venue, because the rate depends on length. Event coverage has a minimum number of hours, so say so plainly rather than quoting an hourly rate they could misread. Mention travel only if the venue is well outside San Francisco.`,
} as const;

/**
 * Matches session-type wording onto a playbook key.
 *
 * Order matters: the more specific types are tested first so "engagement
 * session for a couple" lands on engagement rather than couples.
 *
 * `strict` tightens the patterns that are prone to matching a passing mention.
 * The dropdown is curated input and is matched leniently; a free-text message
 * is matched strictly, because "family-owned restaurant brands" in a
 * commercial inquiry otherwise resolves to a family session.
 */
function matchPlaybook(text: string, strict: boolean): string | null {
  const haystack = text.toLowerCase();
  if (!haystack.trim()) return null;

  // "ask her/him" and "pop the question" catch a proposal described without
  // the word: a real inquiry filed as Couples read "engagement photos, I'd
  // love to ask her in the Muir Woods", which is a proposal shoot.
  if (/proposal|propos(?:e|ing|al)|pop the question|\bask (?:her|him|them)\b|said yes/.test(haystack)) return "proposal";
  if (/engagement|engaged|fianc/.test(haystack)) return "engagement";
  if (/\bgrad\b|graduat/.test(haystack)) return "graduation";

  const familyPattern = strict
    ? /\b(?:my|our|the|whole|extended) famil|famil(?:y|ies) (?:session|photos|portraits|shoot|pictures)|family of \d/
    : /\bfamil/;
  if (familyPattern.test(haystack)) return "family";

  if (/headshot|head shot|linkedin|corporate portrait|business portrait/.test(haystack)) return "headshot";
  if (/couple|anniversary|date night/.test(haystack)) return "couples";

  const eventPattern = strict
    ? /\bevent (?:coverage|photos|photography)\b|art exhibit|gallery opening|\breunion\b|\bconference\b|networking event/
    : /\bevent\b|exhibit|opening|reunion|party|conference|networking|celebration/;
  if (eventPattern.test(haystack)) return "event";

  if (/portrait|lifestyle|individual|solo|senior/.test(haystack)) return "portrait";
  return null;
}

/**
 * How specific each playbook is.
 *
 * A dropdown choice only wins when it is at least as specific as what the
 * message says. "Couples Session" plus a message describing a proposal is a
 * proposal: taking the dropdown there loaded the wrong playbook and quoted
 * the $650 engagement rate for a $750 proposal shoot.
 */
const PLAYBOOK_SPECIFICITY: Record<string, number> = {
  proposal: 5,
  engagement: 4,
  graduation: 3,
  family: 3,
  event: 3,
  headshot: 3,
  couples: 2,
  portrait: 1,
};

function specificity(key: string | null): number {
  return key ? PLAYBOOK_SPECIFICITY[key] ?? 0 : 0;
}

/**
 * Resolves the session type, reading the client's own words when they are more
 * specific than the dropdown.
 *
 * The form's "Other" option is a dumping ground: real inquiries filed under it
 * include "This is an engagement shoot as I am going to propose" and "multiple
 * locations for my graduation pictures". Resolving from the dropdown alone
 * meant the draft asked what kind of session they wanted after they had just
 * said.
 */
export function resolvePlaybookKey(
  sessionType: string | null | undefined,
  message?: string | null,
): string | null {
  const fromType = matchPlaybook(sessionType ?? "", false);
  const fromMessage = matchPlaybook(message ?? "", true);

  if (fromType && fromMessage) {
    return specificity(fromMessage) > specificity(fromType) ? fromMessage : fromType;
  }
  return fromType ?? fromMessage;
}

export function getPlaybook(
  sessionType: string | null | undefined,
  message?: string | null,
): string | null {
  const key = resolvePlaybookKey(sessionType, message);
  return key ? SESSION_PLAYBOOKS[key] : null;
}
