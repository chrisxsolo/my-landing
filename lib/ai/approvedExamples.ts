// ─────────────────────────────────────────────────────────────────────────────
// Approved writing examples.
//
// These demonstrate VOICE, nothing else. Every date, price, time and location
// inside them is a historical detail from a real past email and is NOT a
// current business fact — the prompt says so explicitly, and verified facts are
// supplied separately (lib/ai/businessFacts.ts, lib/ai/emailContext.ts).
//
// Retrieval is metadata filtering over a handful of rows. That is genuinely
// sufficient at this scale; a vector database here would add a dependency and
// a bill to rank seven items.
// ─────────────────────────────────────────────────────────────────────────────

/** What stage of the conversation an example demonstrates. */
export type ExampleScenario =
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
  {
    id: "a-couples-alt-dates",
    sessionTypes: ["couples", "engagement"],
    scenarios: ["first-reply", "alternative-availability", "location-recommendation"],
    tags: ["unavailable", "sunset", "sunrise", "beach", "golden_hour"],
    source: "seed",
    body: `Hi Angel,

Thank you so much for reaching out! I'd love to take your couples photos!

Unfortunately, I'm unavailable for a sunset session on November 26th, but I am available on November 25th, 27th, 28th, 29th, or 30th during sunset! I could also do November 26th for a sunrise session if you'd prefer to keep your original date

For the beach vibe you're looking for, I'd highly recommend Crissy Field! It's a beautiful location with sandy beaches, waterfront views, and the Golden Gate Bridge in the background. I think it'd be perfect for the type of photos you have in mind!

Let me know if any of those dates work for you, whether you'd prefer sunrise or sunset, and if Crissy Field sounds like a good location!

Once we confirm the date, time, and location, I'll go ahead and send over the invoice and contract to secure your session

Looking forward to hearing back from you!`,
  },
  {
    id: "b-family-sensitive",
    sessionTypes: ["family"],
    scenarios: ["first-reply"],
    tags: ["sensitive", "loss", "pricing", "golden_hour", "location"],
    source: "seed",
    body: `Hi Catherine,

Thank you so much for reaching out! I'm so sorry for your family's loss, and I'd love to help capture some family photos while everyone is together

I'm available this Friday, October 16th, at 5:45 pm, which would be a perfect time to catch some beautiful golden hour lighting!

Rockaway Beach in Pacifica sounds like a lovely location! Is there a specific meeting point you'd prefer to start the session? Feel free to send me a location pin!

My 30-minute family session is $350. Let me know if the pricing and Friday at 5:45 pm work for you!

Once we confirm the time and meeting location, I'll go ahead and send over the invoice and contract to secure your session

Looking forward to hearing back from you!`,
  },
  {
    id: "c-proposal-location-alt",
    sessionTypes: ["proposal"],
    scenarios: ["location-recommendation", "late-reply"],
    tags: ["proposal", "surprise", "location", "travel"],
    source: "seed",
    body: `Hi Aaron,

Sorry for the late reply, and thanks so much for your patience!

I could definitely do later in the day on October 31st! If you'd still prefer Muir Woods, I could make that work with a 3:00 pm start time

Muir Woods can be a little tricky to coordinate, especially for a surprise proposal. If you're open to an alternative that's a bit more straightforward, I'd highly recommend Lover's Lane in San Francisco's Presidio! It's a beautiful, woodsy location surrounded by tall trees that gives off a similar nature vibe to Muir Woods, although with a slightly different atmosphere

Let me know what you think and whether you'd prefer to stick with Muir Woods or consider Lover's Lane instead!

Looking forward to hearing back from you!`,
  },
  {
    id: "d-late-reply-alt-availability",
    sessionTypes: [],
    scenarios: ["late-reply", "alternative-availability"],
    tags: ["unavailable", "golden_hour", "apology"],
    source: "seed",
    body: `Hi Wilton,

I'm so sorry for the late response, and thank you so much for your patience!

Unfortunately, I'm no longer available for October 18th at Crissy Field. However, I'm still available on October 26th, 28th, or 30th during golden hour, which would be a beautiful time to take photos!

I'm also unavailable on October 17th, 24th, 25th, and 31st

Let me know if any of those alternative dates work for you! I'd still love to make this session happen if your schedule allows

Looking forward to hearing back from you!`,
  },
  {
    id: "e-booking-confirmed",
    sessionTypes: [],
    scenarios: ["booking-confirmed"],
    tags: ["invoice", "contract", "meeting_point", "short"],
    source: "seed",
    body: `Hi Sarah,

Perfect! I just sent over the invoice and contract to secure your session!

We'll meet at the main entrance at 5:30 pm. If you have any questions beforehand, feel free to reach out!

Looking forward to our shoot!`,
  },
  {
    id: "f-declining",
    sessionTypes: [],
    scenarios: ["declining"],
    tags: ["unavailable", "short", "decline"],
    source: "seed",
    body: `Hi Lisa,

Thank you so much for reaching out!

Unfortunately, I'm unavailable for your requested date, but I really appreciate you considering me!

If you're ever looking for photos in the future, I'd love to work with you!

Wishing you the best of luck!`,
  },
];

export type ExampleQuery = {
  /** Playbook key from resolvePlaybookKey(). */
  sessionType: string | null;
  scenarios: ExampleScenario[];
  tags?: string[];
};

const SESSION_MATCH_SCORE = 3;
const SCENARIO_MATCH_SCORE = 2;
const TAG_MATCH_SCORE = 1;

/**
 * Ranks examples by metadata overlap and returns the best few.
 *
 * Session-type and scenario agreement outrank tag agreement, so a proposal
 * inquiry gets the proposal example even when a couples example shares more
 * tags. Ties break on array order, which keeps selection deterministic and
 * therefore keeps the prompt cacheable across repeat generations.
 */
export function selectExamples(
  query: ExampleQuery,
  pool: ApprovedExample[] = SEED_EXAMPLES,
  limit = 3,
): ApprovedExample[] {
  const wantedTags = new Set(query.tags ?? []);
  const wantedScenarios = new Set(query.scenarios);

  const scored = pool.map((example, index) => {
    let score = 0;

    // An example with no session types is generic and fits anywhere, so it is
    // never penalised for a mismatch — but it never earns the bonus either.
    if (query.sessionType && example.sessionTypes.includes(query.sessionType)) {
      score += SESSION_MATCH_SCORE;
    }
    for (const scenario of example.scenarios) {
      if (wantedScenarios.has(scenario)) score += SCENARIO_MATCH_SCORE;
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
