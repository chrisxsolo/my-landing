// ─────────────────────────────────────────────────────────────────────────────
// What kind of session is this client actually asking for?
//
// This replaces the ordered first-match ranking that used to live in
// soloxsnapsWritingProfile.ts. That ranking (proposal > engagement >
// graduation > couples > portrait) read any mention of a word as a request for
// that session, which misfired on real inquiries:
//
//   "I plan to do my proposal shortly before and I would just like to do a
//    couples session after"          → priced as a $750 proposal. It is a $350
//                                      couples mini, and they said they could
//                                      not afford more.
//   "an engagement photoshoot ... he might be proposing in September"
//                                   → priced as a $750 proposal. They asked
//                                      for a $650 engagement session.
//   "we did not take pictures of our proposal"
//                                   → priced as a $750 proposal. They are
//                                      married and asked for an hour session.
//   "a portrait shoot ... I'd like to do a couple looks"
//                                   → read "a couple looks" as a couples
//                                      session and quoted $450 for a session
//                                      that has no published rate.
//
// So evidence is graded instead of ordered. A phrase that names the coverage
// being bought is a REQUEST; the bare word appearing somewhere is a MENTION,
// worth much less; and context that rules a type out is a VETO. The strongest
// evidence wins, and only an exact tie falls back to specificity.
// ─────────────────────────────────────────────────────────────────────────────

/** Every session type the assistant can recognise. */
export type PlaybookKey =
  | "graduation" | "couples" | "engagement" | "proposal" | "elopement"
  | "family" | "portrait" | "headshot" | "headshot_event" | "commercial" | "event";

/** Weight of a phrase that names the coverage the client wants. */
const REQUEST = 10;
/** Weight of the bare word turning up somewhere in their prose. */
const MENTION = 4;

/**
 * How specific each type is, used only to break an exact tie.
 *
 * "Proposal Session" in the dropdown plus "we want couples photos after" in
 * the message is a proposal: both are request-grade, and proposal is the more
 * specific of the two.
 */
const SPECIFICITY: Record<PlaybookKey, number> = {
  proposal: 5,
  engagement: 4, elopement: 4, headshot_event: 4, commercial: 4,
  graduation: 3, family: 3, event: 3, headshot: 3,
  couples: 2,
  portrait: 1,
};

/**
 * Types that answer the same question, so a request for two of them is a
 * refinement rather than a contradiction. A message with request-grade
 * evidence in two different groups is genuinely ambiguous and gets flagged.
 */
const GROUPS: Record<PlaybookKey, string> = {
  proposal: "romantic", engagement: "romantic", couples: "romantic", elopement: "romantic",
  portrait: "individual", headshot: "individual", commercial: "individual", headshot_event: "individual",
  graduation: "graduation", family: "family", event: "event",
};

type Patterns = {
  /** Phrases that name the coverage being asked for. */
  request: RegExp[];
  /** The word appearing without naming the job. Absent where every mention
   *  would be noise: "a party afterwards" is not an event booking. */
  mention?: RegExp;
  /** Context that rules the type out no matter what else matched. */
  veto?: RegExp[];
};

const PATTERNS: Record<PlaybookKey, Patterns> = {
  // Intent plus an object, or explicit shoot framing. Deliberately NOT a bare
  // /propos/: "he might be proposing in September" is background, not the job.
  proposal: {
    request: [
      /\b(?:going|planning|plan|want|hoping|intend(?:ing)?) to propose\b/,
      /\bpropos(?:e|ing) to (?:her|him|them|my)\b/,
      /\bsurprise (?:proposal|engagement)\b/,
      /\bproposal (?:shoot|session|photos|photography|coverage|pictures)\b/,
      /\bcapture (?:the|this|our|my) (?:surprise|proposal|moment)\b/,
      /\bpop the question\b/,
      /\bshe (?:thinks|has no idea|doesn'?t know|does not know)\b/,
      /\bask (?:her|him|them)\b/,
      /\b(?:my|our|his|her|their)(?: \w+'?s?)? proposal\b/,
      /\bsaid yes\b/,
    ],
    mention: /propos(?:e|ing|al)/,
    veto: [
      // The proposal happens separately and is not what they are hiring for.
      /\b(?:plan|planning|going|intend) to (?:do|have) (?:my|our|the) proposal\b[^.!?]*\b(?:before|beforehand|prior|earlier|first)\b/,
      /\b(?:couples?|engagement) (?:session|shoot|photos) after\b/,
      // It already happened and was never photographed.
      /\b(?:did ?n[o']?t|didnt|never|unfortunately we did not)\b[^.!?]*\bproposal\b/,
      /\balready (?:proposed|engaged|married)\b/,
    ],
  },

  engagement: {
    request: [
      /\bengagement (?:photo|photos|photoshoot|shoot|session|sessions|portraits|pictures)\b/,
      /\b(?:just |recently )?got engaged\b/,
      /\bengagement (?:photographer|coverage)\b/,
      /\bfianc(?:e|é|ée|ee)\b/,
    ],
    mention: /engagement|engaged/,
  },

  // Multi-hour ceremony coverage. Has no published rate, so recognising it is
  // what stops a 2-4 hour elopement being quoted as a one-hour couples session.
  elopement: {
    request: [
      /\belope(?:ment|ments|ing)?\b/,
      /\bintimate (?:ceremony|wedding|vows)\b/,
      /\bmicro[- ]?wedding\b/,
      /\bofficiant\b/,
      /\bcourthouse wedding\b/,
      /\bvow (?:renewal|exchange)\b/,
    ],
  },

  graduation: {
    request: [
      /\bgrad(?:uation)? (?:photo|photos|photoshoot|shoot|session|portraits|pictures|pics)\b/,
      /\b(?:i|we|she|he) (?:am|are|is)? ?graduat(?:e|ed|ing)\b/,
      /\bgraduating from\b/,
      /\bcap and gown\b/,
      /\bsession type:\s*graduation\b/,
      /\bsenior (?:photos|portraits|pictures)\b/,
    ],
    mention: /\bgrad\b|graduat/,
  },

  family: {
    request: [
      /\bfamil(?:y|ies) (?:session|photos|portraits|shoot|pictures|photoshoot)\b/,
      /\bfamily of \d|\bfamily of (?:two|three|four|five|six|seven|eight|nine|ten)\b/,
      /\b(?:photograph|photos of) (?:my|our|the) family\b/,
      /\bsession type:\s*family\b/,
    ],
    mention: /\b(?:my|our|the|whole|extended) famil/,
  },

  portrait: {
    request: [
      /\b(?:individual|solo|personal|lifestyle) (?:portrait|portraits|photos|session)\b/,
      /\bportrait (?:shoot|session|photos)\b/,
      /\bsession type:\s*individual portrait\b/,
      /\bphotos (?:of|for) (?:just )?(?:me|myself)\b/,
    ],
    mention: /portrait|lifestyle|\bsolo\b/,
  },

  headshot: {
    request: [
      /\bprofessional headshots?\b/,
      /\bheadshots? (?:session|for|photos)\b/,
      /\b(?:need|want|looking for|getting) (?:some )?headshots?\b/,
      /\blinkedin (?:photo|headshot|picture)\b/,
      /\b(?:corporate|business) (?:portrait|headshot)\b/,
    ],
    mention: /headshot|head shot/,
  },

  // An organised shoot for a club, class, or company. Priced by negotiation
  // every time it has come up, so it must reach Chris rather than the group
  // graduation rate: one of these resolved to graduation and would have been
  // quoted over $1,100 against the $600 he actually charged.
  headshot_event: {
    request: [
      /\bheadshot (?:event|day|drive|session for (?:my|our))\b/,
      /\bgroup headshots?\b/,
      /\bheadshots? for (?:my|our) (?:classmates|club|team|staff|students|members|organization|company|association|cohort)\b/,
      /\borganiz(?:e|ing) a headshot\b/,
    ],
  },

  commercial: {
    request: [
      /\bmagazine (?:cover|feature|spread)\b/,
      /\beditorial (?:shoot|photos|feature)\b/,
      /\b(?:commercial|advertising) (?:shoot|photography|session)\b/,
      /\bbrand(?:ing)? (?:shoot|session|campaign|photos)\b/,
      /\bpress (?:kit|photos|feature)\b/,
      /\bmedia opportunity\b/,
      /\bphotography opportunity for\b/,
    ],
  },

  // Request-grade only, with no mention pattern on purpose: "we are opening up
  // to the idea of a party afterwards" is not an event booking.
  event: {
    request: [
      /\bevent (?:coverage|photos|photography|photographer)\b/,
      /\bphotograph(?:ing|er for)? (?:the|our|this|my) event\b/,
      /\b(?:pictures|photos) of (?:this|the|our) event\b/,
      /\bart exhibit\b/, /\bgallery opening\b/, /\bgala\b/,
      /\b(?:class |family )?reunion\b/, /\bconference\b/, /\bnetworking event\b/,
      /\bcompany (?:celebration|party|event|holiday party)\b/,
      /\bbirthday party\b/, /\bbaby shower\b/, /\bquincea(?:ñ|n)era\b/,
      /\bsession type:\s*event\b/,
    ],
  },

  couples: {
    request: [
      /\bcouples? (?:session|shoot|photos|photoshoot|portraits|pictures)\b/,
      /\b(?:anniversary|newlywed|wedding) (?:session|shoot|photos|portraits|pictures)\b/,
      /\bphotos (?:of|for) (?:me and my|my wife|my husband|us as a couple)\b/,
      /\bdate night (?:session|shoot|photos)\b/,
      /\bsession type:\s*couples?\b/,
    ],
    // "a couple looks", "a couple of hours" and "a couple shots" are counts,
    // not relationships. Vetoing them is what kept a solo birthday portrait
    // shoot from being priced as a couples session.
    mention: /\bcouples\b|\bcouple\b|\banniversary\b/,
    veto: [/\ba couple (?:of )?(?:looks?|outfits?|hours?|minutes?|days?|weeks?|months?|shots?|photos?|things?|more|different)\b/],
  },
};

/** Lenient match for the curated dropdown value, which is not prose. */
const DROPDOWN: [RegExp, PlaybookKey][] = [
  [/proposal/i, "proposal"],
  [/engagement/i, "engagement"],
  [/elope/i, "elopement"],
  [/graduat|\bgrad\b/i, "graduation"],
  [/famil/i, "family"],
  [/headshot/i, "headshot"],
  [/commercial|brand/i, "commercial"],
  [/event/i, "event"],
  [/couple/i, "couples"],
  [/portrait|individual|lifestyle/i, "portrait"],
];

export type Classification = {
  /** Best-supported type, or null when nothing matched at all. */
  key: PlaybookKey | null;
  /** Score of the winner, for debugging and for the ambiguity rule. */
  score: number;
  /**
   * True when the message asks request-grade for two unrelated kinds of
   * session. The caller should surface this rather than silently pick one.
   */
  ambiguous: boolean;
  /** The other request-grade type, when ambiguous. */
  alternative: PlaybookKey | null;
};

function scoreMessage(message: string): Map<PlaybookKey, number> {
  const text = message.toLowerCase();
  const scores = new Map<PlaybookKey, number>();
  if (!text.trim()) return scores;

  for (const [key, patterns] of Object.entries(PATTERNS) as [PlaybookKey, Patterns][]) {
    if (patterns.veto?.some((pattern) => pattern.test(text))) continue;
    if (patterns.request.some((pattern) => pattern.test(text))) scores.set(key, REQUEST);
    else if (patterns.mention?.test(text)) scores.set(key, MENTION);
  }
  return scores;
}

/**
 * The dropdown, and the "Session type:" line the estimator prepends to a
 * message, are both explicit choices rather than prose, so they count as
 * request-grade. They lose a tie to a more specific type read from the
 * message, which is how an inquiry filed "Couples Session" that describes a
 * proposal reaches the proposal rate.
 */
function scoreSessionType(sessionType: string): PlaybookKey | null {
  const text = (sessionType ?? "").trim();
  if (!text) return null;
  for (const [pattern, key] of DROPDOWN) if (pattern.test(text)) return key;
  return null;
}

export function classifySession(
  sessionType: string | null | undefined,
  message?: string | null,
): Classification {
  const scores = scoreMessage(message ?? "");

  const fromDropdown = scoreSessionType(sessionType ?? "");
  if (fromDropdown) {
    scores.set(fromDropdown, Math.max(scores.get(fromDropdown) ?? 0, REQUEST));
  }

  if (!scores.size) return { key: null, score: 0, ambiguous: false, alternative: null };

  const ranked = [...scores.entries()].sort(
    (a, b) => b[1] - a[1] || SPECIFICITY[b[0]] - SPECIFICITY[a[0]],
  );
  const [key, score] = ranked[0];

  // Ambiguity is only interesting when the MESSAGE itself asks for two
  // unrelated things. A dropdown that disagrees with the message is the normal
  // case this classifier exists to resolve, not an ambiguity.
  const requested = [...scoreMessage(message ?? "")]
    .filter(([, value]) => value === REQUEST)
    .map(([candidate]) => candidate);
  const conflicting = requested.find((candidate) => GROUPS[candidate] !== GROUPS[key]);

  return {
    key,
    score,
    ambiguous: Boolean(conflicting) && requested.length > 1,
    alternative: conflicting ?? null,
  };
}

/** The resolved playbook key, or null. */
export function resolvePlaybookKey(
  sessionType: string | null | undefined,
  message?: string | null,
): PlaybookKey | null {
  return classifySession(sessionType, message).key;
}
