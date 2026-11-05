// SoloXSnaps → PixiSet Autofill: contract pricing, school names and date
// formatting. Contract previews still price in the browser; invoices are
// priced by /api/extension/invoice-draft and never by this file.

// ── SCHOOL NAME EXPANSION ─────────────────────────────────────────────────────
const SCHOOL_FULL_NAMES = {
  "uc-berkeley":  "UC Berkeley",
  "sjsu":         "San Jose State University",
  "sf-state":     "San Francisco State University",
  "usf":          "University of San Francisco",
  "csueb":        "California State University, East Bay",
  "santa-clara":  "Santa Clara University",
  "stanford":     "Stanford University",
};

function detectSchoolKey(schoolText = "") {
  const s = schoolText.toLowerCase();
  if (s.includes("berkeley"))                          return "uc-berkeley";
  if (s.includes("san jose") || s.includes("sjsu"))   return "sjsu";
  if (s.includes("sf state") || s.includes("san francisco state")) return "sf-state";
  if (s.includes("usf") || s.includes("university of san francisco")) return "usf";
  if (s.includes("east bay") || s.includes("csueb"))  return "csueb";
  if (s.includes("santa clara"))                       return "santa-clara";
  if (s.includes("stanford") || s.includes("palo alto")) return "stanford";
  return null;
}

function expandSchoolName(schoolText = "") {
  const key = detectSchoolKey(schoolText);
  return key ? SCHOOL_FULL_NAMES[key] ?? schoolText : schoolText;
}

// ── DATE FORMATTING ──────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// "July 24th" / "7/24" / "2026-07-24" → "July 24th, 2026".
// Missing year resolves to the next occurrence of that month+day.
// Returns null when the text isn't a parseable date (e.g. "sometime this week").
function formatSessionDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  let year = null, month = null, day = null;

  const iso   = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(text);
  const named = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/.exec(text);

  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else if (slash) {
    month = +slash[1]; day = +slash[2];
    year = slash[3] ? (+slash[3] < 100 ? 2000 + +slash[3] : +slash[3]) : null;
  } else if (named) {
    const idx = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(named[1].toLowerCase()));
    if (idx >= 0) {
      month = idx + 1; day = +named[2];
      year = named[3] ? +named[3] : null;
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year == null) {
    const now = new Date();
    year = now.getFullYear();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (new Date(year, month - 1, day) < today) year += 1;
  }
  return `${MONTH_NAMES[month - 1]} ${ordinal(day)}, ${year}`;
}

// ── PRICING (mirrors lib/pricingCatalog.ts) ──────────────────────────────────
// Graduation is two individual packages, not an hourly rate: the 30-minute
// mini and the 60-minute session. The contract preview fills the package the
// inquiry names (detectGradDurationMinutes) and leaves the price unresolved
// when one graduate named none, exactly as the server does; a price agreed in
// the email thread always wins.
// tests/unit/pricingConsistency.test.ts fails if these drift from the site.
const GRAD_PACKAGE_PRICES = { mini: 325, standard: 425 };
const GRAD_PACKAGE_MINUTES = { mini: 30, standard: 60 };
// Each started 30 minutes past the included time, for one graduate and for
// a group alike (lib/pricing.ts extraTimeCharge).
const ADDON_EXTRA_30_MIN = 100;
// Per graduate. The rate covers the group's included time (60 min for two,
// the 90-minute minimum for three or more). Nine or more: no automatic price.
const GROUP_RATES_PER_PERSON = { 2: 350, 3: 325, 4: 300, 5: 275, 6: 250, 7: 250, 8: 250 };
const GROUP_MAX_PEOPLE = 8;
const GROUP_MINIMUM_SIZE = 3;
const GROUP_MINIMUM_MINUTES = 90;
// Travel = round-trip miles x $0.70 rounded up to $5, plus tolls, with that
// total rounded to the nearest $5, or the business-approved fee where one
// exists (lib/travelFee.ts, SJSU = $75).
// tests/unit/travelFee.test.ts fails if these drift from the site.
const TRAVEL_FEES = {
  "sf-state": 0, "usf": 0, "sf-other": 0,
  "uc-berkeley": 45, "csueb": 65, "sjsu": 75, "santa-clara": 65, "stanford": 50,
};

// Flat per-session rates for non-graduation services
const SERVICE_FLAT_RATES = {
  "family":          350, // Family Session (30 min)
  "extended-family": 500, // Extended Family Session (60 min)
  "couples":         450, // 1-Hour Couples Session
  "engagement":      650,
  "proposal":        750,
  "elopement":       950, // Elopement & Courthouse Ceremony, 2-hour base. A
                          // floor Chris edits when the coverage runs longer.
  "maternity":       500, // Maternity Session (60 min, partner + kids included)
};

const SERVICE_LABELS = {
  "family":          "Family Session",
  "extended-family": "Extended Family Session",
  "couples":         "Couples Session",
  "engagement":      "Engagement Session",
  "proposal":        "Proposal Session",
  "elopement":       "Elopement & Courthouse Ceremony",
  "maternity":       "Maternity Session",
  "graduation":      "Graduation Session",
};

function detectServiceType(inq) {
  // Email-detected type wins if it's one we price
  const fromEmail = String(inq._serviceType || "").toLowerCase();
  if (SERVICE_FLAT_RATES[fromEmail] != null || fromEmail === "graduation") return fromEmail;

  const t = `${inq.session_type || ""} ${inq.message || ""}`.toLowerCase().replace(/-/g, " ");
  if (t.includes("elope") || t.includes("courthouse")) return "elopement";
  // Before couples and family: partner and kids are part of the maternity package.
  if (t.includes("matern"))          return "maternity";
  if (t.includes("proposal"))        return "proposal";
  if (t.includes("engagement"))      return "engagement";
  if (t.includes("couple") || t.includes("anniversary")) return "couples";
  if (t.includes("extended family")) return "extended-family";
  if (t.includes("family"))          return "family";
  return "graduation";
}

// ── DURATION PARSER (mirrors lib/pricing.ts detectGraduationDurationMinutes) ──
// Content scripts cannot import TypeScript, so this is the same parser in plain
// JS; tests/unit/graduationDurationParser.test.ts runs both on the same cases.
const HOURS_WORD = { a: 1, an: 1, one: 1, full: 1, two: 2, three: 3 };
const MINUTES_WORD = { thirty: 30, forty: 40, sixty: 60, ninety: 90 };
const HOUR_RE = String.raw`(?:hours?|hrs?)`;
const MINUTE_RE = String.raw`(?:minutes?|mins?)`;
const HOUR_COUNT_RE = String.raw`(\d+(?:\.\d+)?|one|two|three|full|an?)`;
const MINUTE_COUNT_RE = String.raw`(\d+|thirty|forty|sixty|ninety)`;
const hoursOf = raw => HOURS_WORD[raw] ?? Number(raw);
const minutesOfWord = raw => MINUTES_WORD[raw] ?? Number(raw);

// Compound forms first, so "1 hour 30 minutes" is one 90-minute phrase.
const DURATION_PATTERNS = [
  { re: new RegExp(String.raw`\b${HOUR_COUNT_RE}\s*-?\s*${HOUR_RE}\s*(?:and|plus|&|\+)?\s*${MINUTE_COUNT_RE}\s*-?\s*${MINUTE_RE}\b`, "y"),
    minutes: m => hoursOf(m[1]) * 60 + minutesOfWord(m[2]) },
  { re: new RegExp(String.raw`\b(?:(?:an?|one|1)\s+)?${HOUR_RE}\s+and\s+a\s+half\b`, "y"), minutes: () => 90 },
  { re: new RegExp(String.raw`\b(?:one|1)\s*(?:and\s+a\s+half|1/2|½)\s*${HOUR_RE}\b`, "y"), minutes: () => 90 },
  { re: new RegExp(String.raw`\bhalf\s*(?:an?\s*)?(?:hour|hr)\b`, "y"), minutes: () => 30 },
  { re: new RegExp(String.raw`\b${HOUR_COUNT_RE}\s*-?\s*${HOUR_RE}\b`, "y"), minutes: m => Math.round(hoursOf(m[1]) * 60) },
  { re: new RegExp(String.raw`\b${MINUTE_COUNT_RE}\s*-?\s*${MINUTE_RE}\b`, "y"), minutes: m => minutesOfWord(m[1]) },
  { re: /\bmini\b/y, minutes: () => GRAD_PACKAGE_MINUTES.mini },
];
const SESSION_WORDS = /\b(?:sessions?|length|coverage|package|shoot|photoshoot|book(?:ing)?|mini|photos?|portraits?|slot)\b/g;
const UNRELATED_WORDS = /\b(?:deliver(?:y|ed|ing|s)?|turnaround|gallery|edits?|editing|reply|respond|within|early|late|before|after|ahead|prior|arrive|arrival|drive|driving|away|commute|notice|days?|weeks?)\b/g;

function durationMentions(clause) {
  const found = [];
  let at = 0;
  while (at < clause.length) {
    const hit = DURATION_PATTERNS.map(p => { p.re.lastIndex = at; return { p, m: p.re.exec(clause) }; }).find(x => x.m);
    if (hit) {
      found.push({ minutes: hit.p.minutes(hit.m), start: at, end: at + hit.m[0].length });
      at += Math.max(1, hit.m[0].length);
    } else {
      at += 1;
    }
  }
  return found;
}

function nearestDistance(clause, mention, words) {
  let best = Infinity;
  for (const m of clause.matchAll(words)) {
    const wordStart = m.index, wordEnd = wordStart + m[0].length;
    if (wordEnd <= mention.start) best = Math.min(best, mention.start - wordEnd);
    else if (wordStart >= mention.end) best = Math.min(best, wordStart - mention.end);
    else best = 0;
  }
  return best;
}

function classifyMention(clause, mention) {
  const tied = nearestDistance(clause, mention, SESSION_WORDS);
  const unrelated = nearestDistance(clause, mention, UNRELATED_WORDS);
  if (tied === Infinity && unrelated === Infinity) return "neutral";
  return tied <= unrelated ? "tied" : "unrelated";
}

// The length the inquiry names in minutes, or null when it names none or two
// that disagree. Session wording outranks delivery/availability spans.
function detectGradDurationMinutes(text) {
  const found = [];
  for (const clause of String(text ?? "").toLowerCase().split(/[!?;\n]+|\.(?!\d)/)) {
    for (const mention of durationMentions(clause)) found.push({ minutes: mention.minutes, kind: classifyMention(clause, mention) });
  }
  const tied = found.filter(f => f.kind === "tied");
  const counted = tied.length ? tied : found.filter(f => f.kind === "neutral");
  const distinct = [...new Set(counted.map(f => f.minutes))];
  return distinct.length === 1 ? distinct[0] : null;
}

// Minutes a group's per-graduate rate already covers (lib/pricing.ts includedMinutesFor).
function includedMinutesFor(people) {
  return people >= GROUP_MINIMUM_SIZE ? GROUP_MINIMUM_MINUTES : GRAD_PACKAGE_MINUTES.standard;
}

// The extension for each started half hour past the included time; a shorter
// length never discounts (lib/pricing.ts extraTimeCharge).
function extraTimeCharge(minutes, includedMinutes) {
  const extraHalfHours = Math.max(0, Math.ceil((minutes - includedMinutes) / 30));
  return extraHalfHours * ADDON_EXTRA_30_MIN;
}

function namedGradMinutes(inquiry) {
  return detectGradDurationMinutes(`${inquiry.session_type || ""} ${inquiry.message || ""}`);
}

// One graduate's session price from the length the inquiry names (mirrors
// lib/pricing.ts graduationSessionPrice for one person), or null when no
// package was chosen: the preview then asks instead of picking the hour.
function individualGradPrice(inquiry) {
  const minutes = namedGradMinutes(inquiry);
  if (minutes === null) return null;
  if (minutes <= GRAD_PACKAGE_MINUTES.mini) return GRAD_PACKAGE_PRICES.mini;
  return GRAD_PACKAGE_PRICES.standard + extraTimeCharge(minutes, GRAD_PACKAGE_MINUTES.standard);
}

// A group of two to eight: the per-graduate rate covers the included time,
// plus the extension for each started half hour the inquiry names past it
// (mirrors lib/pricing.ts graduationSessionPrice for a group). No named
// length, or a shorter one, is the included-time base.
function groupGradPrice(inquiry, people) {
  const included = includedMinutesFor(people);
  const minutes = namedGradMinutes(inquiry) ?? included;
  return GROUP_RATES_PER_PERSON[people] * people + extraTimeCharge(minutes, included);
}

const PACKAGE_REVIEW_HINT = "No package chosen: the inquiry does not say whether this is the 30-minute mini ($325) or the 1-hour session ($425). Enter the total once it is agreed.";
const MANUAL_QUOTE_HINT = `Nine or more graduates are quoted by hand; the rate card stops at ${GROUP_MAX_PEOPLE}. Enter the agreed total.`;

function calcPrice(inquiry) {
  const service = detectServiceType(inquiry);
  const people = parseInt(inquiry.people || "1") || 1;
  let sessionBase, travelFee = null, schoolKey = null, reviewHint = null;

  if (SERVICE_FLAT_RATES[service] != null) {
    sessionBase = SERVICE_FLAT_RATES[service];
  } else {
    if (people <= 1) {
      sessionBase = individualGradPrice(inquiry);
      if (sessionBase == null) reviewHint = PACKAGE_REVIEW_HINT;
    } else if (people <= GROUP_MAX_PEOPLE) {
      sessionBase = groupGradPrice(inquiry, people);
    } else {
      sessionBase = null; // quoted by hand; the preview is left for Chris to fill
      reviewHint = MANUAL_QUOTE_HINT;
    }
    // The thread's shoot location (kept apart from the school) decides first.
    schoolKey = detectSchoolKey(inquiry._location || inquiry.school || inquiry.message || "");
    if (schoolKey != null && TRAVEL_FEES[schoolKey] != null) travelFee = TRAVEL_FEES[schoolKey];
  }

  // A price quoted/agreed in the email thread overrides the calculator
  const agreed = Number.isFinite(inquiry._agreedTotal) ? inquiry._agreedTotal : null;
  if (agreed != null) { sessionBase = agreed; travelFee = null; reviewHint = null; }
  const subtotal = sessionBase == null ? null : sessionBase + (travelFee ?? 0);
  const deposit  = subtotal == null ? null : subtotal / 2;

  return {
    sessionBase, travelFee,
    subtotal, deposit, remaining: subtotal == null ? null : subtotal - deposit,
    people, schoolKey, service, priceFromEmail: agreed != null, reviewHint,
  };
}

// "$425.00"; an unpriced figure (a group quoted by hand) renders empty.
function fmt(n) { return n == null ? "" : `$${Number(n).toFixed(2)}`; }
