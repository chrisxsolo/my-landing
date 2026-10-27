// ─────────────────────────────────────────────────────────────────────────────
// Approved writing examples.
//
// These demonstrate VOICE, nothing else. Every date, price, time and location
// inside them is a historical detail from a real past email and is NOT a
// current business fact — the prompt says so explicitly, and verified facts are
// supplied separately (lib/ai/businessFacts.ts, lib/ai/buildEmailContext.ts).
//
// ── Why this file was rebuilt ────────────────────────────────────────────────
// It was the main reason drafts did not sound like Chris, which is an awkward
// thing for a file of Chris's own emails to be.
//
// The old pool held six examples and five of them were FIRST replies: long,
// warm, full of location pitches and lighting commentary. Whatever stage a
// conversation was actually at, the model was shown a first reply and wrote
// one. A client confirming a time got a brochure, because a brochure was the
// only shape on offer. And the instructions said "do not read their details
// back to them" while an example did exactly that, so the concrete example won
// over the abstract rule — as it always will.
//
// So the pool is now tagged by conversation stage and weighted toward the
// SHORT later-turn replies that make up most of his sent mail and none of the
// old corpus. Two sentences were cut from the family example where it
// described a beach the client had chosen herself; the original sent email
// contained them, and Chris has since called that pattern out specifically.
//
// Retrieval is metadata filtering over a dozen rows. That is genuinely
// sufficient at this scale; a vector database here would add a dependency and
// a bill to rank twelve items.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConversationStage } from "./conversationStage";

/**
 * What an example demonstrates. Conversation stages are the primary axis; the
 * older scenario names are kept because approved examples already stored in
 * `ai_approved_examples.scenarios` use them, and widening the type beats a
 * migration for six strings.
 */
export type ExampleScenario =
  | ConversationStage
  | "first-reply"
  | "alternative-availability"
  | "location-recommendation"
  | "late-reply"
  | "booking-confirmed"
  | "declining";

export type ApprovedExample = {
  id: string;
  /** Playbook keys this example suits. Empty = suits any session type. */
  sessionTypes: string[];
  scenarios: ExampleScenario[];
  tags: string[];
  body: string;
  /** Seeded examples ship in code; approved drafts are added at runtime. */
  source: "seed" | "approved-draft";
};

export const SEED_EXAMPLES: ApprovedExample[] = [
  // ── First replies ─────────────────────────────────────────────────────────
  {
    id: "grad-first-price-travel",
    sessionTypes: ["graduation"],
    scenarios: ["initial_inquiry", "first-reply", "pricing_discussion"],
    tags: ["pricing", "travel", "congratulations"],
    source: "seed",
    body: `Hi Nayeli,

Thank you so much for reaching out, and congratulations on your graduation! I'd love to take your graduation pictures!

My graduation sessions at San Jose State start at $350 for a 1-hour session, plus a $75 travel fee for SJSU, so $425 total

Let me know which date works best for you, and I'll send over the invoice and contract to secure the session once we confirm the details

Looking forward to hearing back from you!`,
  },
  {
    id: "couples-first-alt-dates-location",
    sessionTypes: ["couples", "engagement"],
    scenarios: ["initial_inquiry", "first-reply", "availability_discussion", "alternative-availability", "location-recommendation"],
    tags: ["unavailable", "sunset", "sunrise", "beach", "golden_hour"],
    source: "seed",
    // The location pitch here is the ALLOWED case: she asked for "a beach
    // vibe" without naming a spot, so Crissy Field is his suggestion to sell.
    body: `Hi Angel,

Thank you so much for reaching out! I'd love to take your couples photos!

Unfortunately, I'm unavailable for a sunset session on November 26th, but I am available on November 25th, 27th, 28th, 29th, or 30th during sunset! I could also do November 26th for a sunrise session if you'd prefer to keep your original date

For the beach vibe you're looking for, I'd highly recommend Crissy Field! It has sandy beaches, waterfront views, and the Golden Gate Bridge in the background

Let me know if any of those dates work for you, whether you'd prefer sunrise or sunset, and if Crissy Field sounds good!

Looking forward to hearing back from you!`,
  },
  {
    id: "family-first-sensitive",
    sessionTypes: ["family"],
    scenarios: ["initial_inquiry", "first-reply"],
    tags: ["sensitive", "loss", "pricing", "golden_hour"],
    source: "seed",
    // Two sentences cut from the sent original: it called the beach SHE chose
    // "a lovely location" and described the light there. That echo is the
    // pattern Chris asked to stop.
    body: `Hi Catherine,

Thank you so much for reaching out! I'm so sorry for your family's loss, and I'd love to help capture some family photos while everyone is together

I'm available this Friday, October 16th, at 5:45 pm, which would be a great time for golden hour lighting

Is there a specific meeting point at Rockaway Beach you'd prefer to start from? Feel free to send me a location pin!

My 30-minute family session is $350. Let me know if the pricing and Friday at 5:45 pm work for you, and I'll send over the invoice and contract to secure the session

Looking forward to hearing back from you!`,
  },
  {
    id: "proposal-location-alt",
    sessionTypes: ["proposal"],
    scenarios: ["initial_inquiry", "location-recommendation", "late-reply"],
    tags: ["proposal", "surprise", "location", "travel"],
    source: "seed",
    body: `Hi Aaron,

Sorry for the late reply, and thanks so much for your patience!

I could definitely do later in the day on October 31st! If you'd still prefer Muir Woods, I could make that work with a 3:00 pm start time

Muir Woods can be a little tricky to coordinate, especially for a surprise proposal. If you're open to an alternative, I'd highly recommend Lover's Lane in the Presidio! It's woodsy and surrounded by tall trees, so it gives off a similar nature vibe

Let me know what you think and whether you'd prefer to stick with Muir Woods or consider Lover's Lane instead!

Looking forward to hearing back from you!`,
  },

  // ── Later turns: short. Most of his sent mail looks like this, and none of
  //    it was represented before. ───────────────────────────────────────────
  {
    id: "availability-later-turn-short",
    sessionTypes: [],
    scenarios: ["availability_discussion", "alternative-availability"],
    tags: ["unavailable", "short"],
    source: "seed",
    body: `Hi Aisa!

Unfortunately, I don't have any availability during the October 3rd weekend. I am available October 1st to 2nd, 5th to 7th, or the 9th around the same time

Let me know if any of those dates work for you!

Looking forward to hearing back from you!`,
  },
  {
    id: "scheduling-accept-shortest",
    sessionTypes: [],
    scenarios: ["scheduling"],
    tags: ["short", "confirm"],
    source: "seed",
    body: `Hi Lauren,

June 9th at 7pm works perfectly, see you then!`,
  },
  {
    id: "pricing-followup-total",
    sessionTypes: ["graduation"],
    scenarios: ["pricing_discussion"],
    tags: ["pricing", "travel", "group", "short"],
    source: "seed",
    body: `Yes, the $300 per person listed on my graduation pricing page is correct. For two graduates, that would be $600 total, plus the travel fee to San Jose State, which brings the session total to $675

If you'd like, I can send over the invoice and contract once you confirm the location`,
  },
  {
    id: "booking-confirmation-invoice-sent",
    sessionTypes: [],
    scenarios: ["booking_confirmation", "booking-confirmed"],
    tags: ["invoice", "contract", "meeting_point", "short"],
    source: "seed",
    body: `Hi Mandielene,

I just sent the invoice and contract over to your email. Once the deposit is paid and the contract is signed, May 18th at 6:30pm is locked in

I'll meet you in front of the main entrance

Looking forward to our session!`,
  },
  {
    id: "logistics-meeting-point-phone",
    sessionTypes: [],
    scenarios: ["logistics_coordination", "booking_confirmation"],
    tags: ["meeting_point", "phone", "short"],
    source: "seed",
    body: `Hi Aisa!

I just sent over the invoice and contract for October 9th at 5 pm at Crissy Field

We can meet at the picnic tables on the grass to start off the session

If you have any questions, feel free to let me know! You can also text me at 408-722-7680 if you need anything before the session

Looking forward to our session!`,
  },
  {
    id: "logistics-answer-local-question",
    sessionTypes: [],
    scenarios: ["logistics_coordination"],
    tags: ["weather", "parking", "local"],
    source: "seed",
    body: `Hi Aisa,

Thank you so much for catching that! It looks like we should still be good for our session at 5 pm at Crissy Field on October 9th. Most of the major Fleet Week events take place over the weekend and are concentrated more toward the piers and northeastern side of the city, so Crissy Field should still work well for us

I would recommend arriving a little earlier than usual and keeping an eye on traffic that day. Giving yourself some extra time for parking would be helpful as well

Looking forward to seeing you all on the 9th!`,
  },
  {
    id: "post-session-delivery",
    sessionTypes: [],
    scenarios: ["post_session"],
    tags: ["gallery", "turnaround", "short"],
    source: "seed",
    body: `Hi Mandielene,

Glad the time works for you! Editing typically takes about 1 to 2 weeks after the session

Once your gallery is ready I'll send you a link to view and download all of your photos`,
  },
  {
    id: "declining-unavailable",
    sessionTypes: [],
    scenarios: ["decline_or_close_out", "declining"],
    tags: ["unavailable", "short", "decline"],
    source: "seed",
    body: `Hi Lucy,

Unfortunately, I'm not available at noon on October 31st, but I really appreciate you reaching out and considering me for your elopement

I wish you both the best of luck and hope you have an amazing day!`,
  },
  {
    id: "late-reply-alt-availability",
    sessionTypes: [],
    scenarios: ["late-reply", "availability_discussion", "alternative-availability"],
    tags: ["unavailable", "golden_hour", "apology"],
    source: "seed",
    body: `Hi Wilton,

I'm so sorry for the late response, and thank you so much for your patience!

Unfortunately, I'm no longer available for October 18th at Crissy Field. However, I'm still available on October 26th, 28th, or 30th during golden hour

Let me know if any of those dates work for you! I'd still love to make this session happen if your schedule allows

Looking forward to hearing back from you!`,
  },
  {
    id: "info-gathering-short",
    sessionTypes: [],
    scenarios: ["information_gathering"],
    tags: ["questions", "short"],
    source: "seed",
    body: `Hi Cameron,

Thanks for reaching out! To get you a quote and check the best spot, what university are you graduating from, and where were you thinking for the session?

I'm available May 13th, 18th to 20th, or 23rd to 24th if any of those work`,
  },
];

export type ExampleQuery = {
  /** Playbook key from resolvePlaybookKey(). */
  sessionType: string | null;
  scenarios: ExampleScenario[];
  tags?: string[];
};

const SESSION_MATCH_SCORE = 3;
const STAGE_MATCH_SCORE = 4;
/**
 * Rare, highly informative situations outrank the stage. A late reply or a
 * date Chris cannot do changes the shape of the email more than the stage
 * does, and there is exactly one example of each to find.
 */
const SITUATION_MATCH_SCORE = 6;
const SITUATIONAL = new Set(["late-reply", "alternative-availability", "declining", "location-recommendation"]);
/** Generic and therefore cheap: almost every long example is a first reply. */
const GENERIC_MATCH_SCORE = 2;
const GENERIC = new Set(["first-reply"]);
const TAG_MATCH_SCORE = 1;

/**
 * Ranks examples by metadata overlap and returns the best few.
 *
 * Stage agreement now outranks session-type agreement, which is the change
 * that stops a logistics question being answered with a first-reply pitch: a
 * generic short logistics example is a better model for that email than a
 * long graduation inquiry reply, even on a graduation booking.
 *
 * Ties break on array order, which keeps selection deterministic and therefore
 * keeps the prompt cacheable across repeat generations.
 */
export function selectExamples(
  query: ExampleQuery,
  pool: ApprovedExample[] = SEED_EXAMPLES,
  limit = 3,
): ApprovedExample[] {
  const wantedTags = new Set(query.tags ?? []);
  const wantedScenarios = new Set<string>(query.scenarios);

  const scored = pool.map((example, index) => {
    let score = 0;

    // An example with no session types is generic and fits anywhere, so it is
    // never penalised for a mismatch — but it never earns the bonus either.
    if (query.sessionType && example.sessionTypes.includes(query.sessionType)) {
      score += SESSION_MATCH_SCORE;
    }
    for (const scenario of example.scenarios) {
      if (!wantedScenarios.has(scenario)) continue;
      score += SITUATIONAL.has(scenario) ? SITUATION_MATCH_SCORE
        : GENERIC.has(scenario) ? GENERIC_MATCH_SCORE
        : STAGE_MATCH_SCORE;
    }
    for (const tag of example.tags) {
      if (wantedTags.has(tag)) score += TAG_MATCH_SCORE;
    }
    return { example, score, index };
  });

  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .slice(0, limit)
    .map((row) => row.example);
}
