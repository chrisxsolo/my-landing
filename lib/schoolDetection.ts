// ─────────────────────────────────────────────────────────────────────────────
// Authoritative school normalization for inquiries.
//
// The inquiry `school` column is free text and browser address-autofill loves
// to drop junk like "CA" into it, so nothing that needs a real school (reply
// subjects, ingestion, backfills) may trust that one column. This module owns
// the alias table and detects the school from ALL inquiry text in a fixed
// source-priority order. Display-only groupers (lib/revenue/schools.ts,
// InquiryAnalyticsTab) keep their own key/label systems.
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizedSchool = {
  canonicalName: string;
  displayName: string;
  abbreviation: string;
  confidence: number; // 0..1 — how unambiguous the matched alias is
  matchedFrom: string; // which input produced the match ("school", "message", …)
};

type SchoolDef = {
  canonicalName: string;
  abbreviation: string;
  patterns: { re: RegExp; confidence: number }[];
  // Context that disqualifies the match (e.g. "USF" meaning South Florida).
  reject?: RegExp;
};

// Patterns run against normalizeText() output: lowercase, accents stripped,
// punctuation collapsed to spaces — so aliases here never include commas or
// accents. Order = most specific first; "cal state east bay" must resolve
// before UC Berkeley's bare "cal" alias gets a look.
const SCHOOL_DEFS: SchoolDef[] = [
  {
    canonicalName: "San Jose State University", abbreviation: "SJSU",
    patterns: [
      { re: /\bsjsu\b/, confidence: 1 },
      { re: /\bsan jose state\b/, confidence: 1 },
    ],
  },
  {
    canonicalName: "San Francisco State University", abbreviation: "SFSU",
    patterns: [
      { re: /\bsfsu\b/, confidence: 1 },
      { re: /\bsan francisco state\b/, confidence: 1 },
      { re: /\bsf state\b/, confidence: 1 },
    ],
  },
  {
    canonicalName: "California State University, East Bay", abbreviation: "CSU East Bay",
    patterns: [
      { re: /\bcsueb\b/, confidence: 1 },
      { re: /\b(?:csu|cal state|california state university) east ?bay\b/, confidence: 1 },
      { re: /\beast ?bay\b/, confidence: 0.7 },
    ],
  },
  {
    canonicalName: "University of California, Berkeley", abbreviation: "UC Berkeley",
    patterns: [
      { re: /\b(?:uc|university of california) berkeley\b/, confidence: 1 },
      { re: /\bberkeley\b/, confidence: 0.9 },
      { re: /\bcal bears?\b/, confidence: 0.9 },
      { re: /\bcal\b(?! state| poly| maritime)/, confidence: 0.5 },
    ],
  },
  {
    canonicalName: "University of San Francisco", abbreviation: "USF",
    // Bare "usf" is only the Bay Area school when the text isn't about Tampa.
    reject: /south florida|tampa/,
    patterns: [
      { re: /\buniversity of san francisco\b/, confidence: 1 },
      { re: /\busfca\b/, confidence: 1 },
      { re: /\busf\b/, confidence: 0.7 },
    ],
  },
  {
    canonicalName: "University of California, Santa Cruz", abbreviation: "UC Santa Cruz",
    patterns: [
      { re: /\bucsc\b/, confidence: 1 },
      { re: /\b(?:uc|university of california) santa cruz\b/, confidence: 1 },
      { re: /\bsanta cruz\b/, confidence: 0.8 },
    ],
  },
  {
    canonicalName: "Stanford University", abbreviation: "Stanford",
    patterns: [{ re: /\bstanford\b/, confidence: 1 }],
  },
  {
    canonicalName: "Santa Clara University", abbreviation: "Santa Clara",
    patterns: [
      { re: /\bsanta clara\b/, confidence: 0.9 },
      { re: /\bscu\b/, confidence: 0.7 },
    ],
  },
  {
    canonicalName: "Sacramento State", abbreviation: "Sac State",
    patterns: [
      { re: /\bsacramento state\b/, confidence: 1 },
      { re: /\bsac state\b/, confidence: 1 },
      { re: /\bcsus\b/, confidence: 0.9 },
    ],
  },
  {
    canonicalName: "Chico State", abbreviation: "Chico State",
    patterns: [
      { re: /\bchico state\b/, confidence: 1 },
      { re: /\bcsu ?chico\b/, confidence: 1 },
    ],
  },
  {
    canonicalName: "Fresno State", abbreviation: "Fresno State",
    patterns: [{ re: /\bfresno state\b/, confidence: 1 }],
  },
];

// Known .edu domains → school, the weakest detection source.
const EDU_DOMAIN_ABBREVIATIONS: Record<string, string> = {
  "sjsu.edu": "SJSU", "sfsu.edu": "SFSU", "usfca.edu": "USF",
  "berkeley.edu": "UC Berkeley", "csueastbay.edu": "CSU East Bay",
  "ucsc.edu": "UC Santa Cruz", "stanford.edu": "Stanford", "scu.edu": "Santa Clara",
  "csus.edu": "Sac State", "csuchico.edu": "Chico State", "csufresno.edu": "Fresno State",
};

// School-field values that carry no school information — state codes (browser
// address-autofill fills the free-text school input with "CA"), generic words,
// and placeholders. These must never win over a real match from another field.
const US_STATE_ABBREVIATIONS = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il",
  "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt",
  "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri",
  "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
]);
const GENERIC_SCHOOL_VALUES = new Set([
  "california", "bay area", "campus", "college", "university", "school",
  "grad", "graduation", "n a", "na", "none", "tbd", "other",
]);

// Lowercase, strip accents ("José" → "jose"), collapse punctuation to spaces.
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map one free-text value to a known school, or null if unrecognized. */
export function normalizeSchool(input: string | null | undefined): NormalizedSchool | null {
  if (!input) return null;
  const text = normalizeText(input);
  if (!text || US_STATE_ABBREVIATIONS.has(text) || GENERIC_SCHOOL_VALUES.has(text)) return null;
  for (const def of SCHOOL_DEFS) {
    if (def.reject?.test(text)) continue;
    for (const { re, confidence } of def.patterns) {
      if (re.test(text)) {
        return {
          canonicalName: def.canonicalName,
          displayName: def.canonicalName,
          abbreviation: def.abbreviation,
          confidence,
          matchedFrom: "input",
        };
      }
    }
  }
  return null;
}

/** Whether a school-field value is plausibly a real school (even an unknown one). */
export function isUsableSchoolFieldValue(value: string | null | undefined): boolean {
  const text = normalizeText(value ?? "");
  if (text.length < 2) return false;
  return !US_STATE_ABBREVIATIONS.has(text) && !GENERIC_SCHOOL_VALUES.has(text);
}

/** Known .edu email domain → school. */
export function detectSchoolFromEmail(email: string | null | undefined): NormalizedSchool | null {
  const domain = email?.match(/@([\w.-]+\.edu)\b/i)?.[1]?.toLowerCase();
  if (!domain) return null;
  const abbreviation = EDU_DOMAIN_ABBREVIATIONS[domain];
  const def = SCHOOL_DEFS.find(d => d.abbreviation === abbreviation);
  if (!def) return null;
  return {
    canonicalName: def.canonicalName,
    displayName: def.canonicalName,
    abbreviation: def.abbreviation,
    confidence: 0.9,
    matchedFrom: "email",
  };
}

export type InquirySchoolSource = {
  school?: string | null;
  location?: string | null;
  message?: string | null;
  session_type?: string | null;
  date_in_mind?: string | null;
  email?: string | null;
};

/**
 * Detect the school from every field an inquiry carries, in decreasing
 * trustworthiness: explicit school field → original message → location →
 * remaining metadata → .edu email domain. A junk school value ("CA") simply
 * fails to normalize, so it can never shadow a real match further down.
 */
export function detectSchoolFromInquiry(inquiry: InquirySchoolSource): NormalizedSchool | null {
  const sources: [string, string | null | undefined][] = [
    ["school", inquiry.school],
    ["message", inquiry.message],
    ["location", inquiry.location],
    ["metadata", [inquiry.session_type, inquiry.date_in_mind].filter(Boolean).join(" ")],
  ];
  for (const [matchedFrom, text] of sources) {
    const match = normalizeSchool(text);
    if (match) return { ...match, matchedFrom };
  }
  return detectSchoolFromEmail(inquiry.email);
}

function isGraduationInquiry(inquiry: InquirySchoolSource): boolean {
  return (inquiry.session_type ?? "").toLowerCase().includes("grad");
}

const GRADUATION_LABEL = "Graduation";

// Subject label for each kind of session, most specific first — the rank is
// what lets a signal in the message refine a vaguer session_type ("Individual
// Portrait" + a message about the couple's anniversary → Couples Session).
const SESSION_LABEL_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bgrad(uation|uating|uate|s)?\b/, label: GRADUATION_LABEL },
  { re: /\bpropos(al|e|ing)\b/, label: "Proposal" },
  { re: /\bengage(ment|d)\b/, label: "Engagement" },
  { re: /\b(couples?|partner|boyfriend|girlfriend|fiance|anniversary)\b/, label: "Couples Session" },
  { re: /\b(family|families|maternity|newborn)\b/, label: "Family Session" },
  { re: /\b(events?|party|birthday|corporate)\b/, label: "Event Coverage" },
  { re: /\b(individual|solo|personal|lifestyle|headshot|portraits?)\b/, label: "Portrait Session" },
];

/** Rank of a label in SESSION_LABEL_PATTERNS; lower = more specific. */
function labelRank(label: string): number {
  return SESSION_LABEL_PATTERNS.findIndex((p) => p.label === label);
}

function detectSessionLabel(text: string | null | undefined): string | null {
  const normalized = normalizeText(text ?? "");
  if (!normalized) return null;
  return SESSION_LABEL_PATTERNS.find((p) => p.re.test(normalized))?.label ?? null;
}

/**
 * The session label to headline the subject with. The dropdown value is the
 * starting point, but the client's own message wins when it names something
 * more specific — the form only offers six types and address autofill or a
 * mismatched pick shouldn't send "Portrait Session" to a couple.
 */
function resolveSessionLabel(inquiry: InquirySchoolSource): string | null {
  const fromType = detectSessionLabel(inquiry.session_type);
  const fromMessage = detectSessionLabel(inquiry.message);
  if (!fromType) return fromMessage;
  if (!fromMessage) return fromType;
  return labelRank(fromMessage) < labelRank(fromType) ? fromMessage : fromType;
}

/**
 * Deterministic reply subject for an inquiry: "<session> Inquiry", with
 * graduation inquiries naming the campus ("SJSU Graduation Inquiry") whenever
 * any inquiry field identifies the school.
 */
export function buildInquiryReplySubject(inquiry: InquirySchoolSource): string {
  const label = resolveSessionLabel(inquiry);
  if (label === GRADUATION_LABEL) {
    const school = detectSchoolFromInquiry(inquiry);
    return school ? `${school.abbreviation} Graduation Inquiry` : "Graduation Inquiry";
  }
  return `${label ?? "Photography"} Inquiry`;
}

export type SubjectSource = "generated" | "manual";

/**
 * Subject to show in a compose UI: a manually edited subject is never
 * overwritten; otherwise regenerate from the latest inquiry data.
 */
export function getComposeSubject(
  inquiry: InquirySchoolSource,
  existing?: { subject?: string | null; subjectSource?: SubjectSource | null },
): string {
  if (existing?.subjectSource === "manual" && existing.subject?.trim()) return existing.subject;
  return buildInquiryReplySubject(inquiry);
}

/**
 * Value the persisted `school` column should hold, used at ingestion and by
 * the backfill script. A recognized school is stored under its canonical name;
 * a junk value ("CA") is replaced by a detection from the other fields
 * (graduation inquiries only — for other sessions a campus mention is usually
 * just a location); an unknown-but-plausible school ("UCLA") is kept as typed.
 */
export function resolveInquirySchoolField(inquiry: InquirySchoolSource): string | null {
  const raw = inquiry.school?.trim() || null;
  const fromField = normalizeSchool(raw);
  if (fromField) return fromField.displayName;
  if (raw && isUsableSchoolFieldValue(raw)) return raw;
  if (isGraduationInquiry(inquiry)) {
    const detected = detectSchoolFromInquiry({ ...inquiry, school: null });
    if (detected) return detected.displayName;
  }
  return raw;
}
