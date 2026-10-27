// School registry for the Content Engine (2026-10-25). Two kinds of school:
//
// - Built-in: the SCHOOL_SLUGS in taxonomy.ts. Each one backs a real
//   /grads/<slug> page, campus gallery, and (some) a campus-spots guide.
// - Custom: added from Session facts and stored in content_engine_schools.
//   A custom school is a session fact the AI writes about — it never gets a
//   school page, gallery placement, or campus-spots placement, so adding one
//   can't publish anything.
//
// Pure module (no DB): the picker uses it for search and duplicate hints, the
// server uses the same functions to validate before inserting.
import { SCHOOL_SLUGS, isSchoolSlug, type SchoolSlug } from "@/lib/contentEngine/taxonomy";

export const CUSTOM_SCHOOLS_TABLE = "content_engine_schools";

export interface SchoolOption {
  slug: string;
  name: string;
  shortName: string | null;
  aliases: string[];
  /** Built-in schools have a /grads page; custom schools never do. */
  builtIn: boolean;
}

interface BuiltInSchool { name: string; shortName: string; aliases: string[] }

// `name` must equal schoolDetection's canonicalName (the email auto-fill maps
// one to the other); aliases are what people actually type.
export const BUILT_IN_SCHOOLS: Record<SchoolSlug, BuiltInSchool> = {
  csueb: {
    name: "California State University, East Bay", shortName: "CSU East Bay",
    aliases: ["CSUEB", "Cal State East Bay"],
  },
  "santa-clara": { name: "Santa Clara University", shortName: "Santa Clara", aliases: ["SCU"] },
  "sf-state": { name: "San Francisco State University", shortName: "SF State", aliases: ["SFSU"] },
  sjsu: { name: "San Jose State University", shortName: "SJSU", aliases: ["San Jose State"] },
  stanford: { name: "Stanford University", shortName: "Stanford", aliases: [] },
  "uc-berkeley": {
    name: "University of California, Berkeley", shortName: "UC Berkeley",
    aliases: ["Berkeley", "UCB"],
  },
  usf: { name: "University of San Francisco", shortName: "USF", aliases: ["USFCA", "USF Dons"] },
};

export const BUILT_IN_SCHOOL_OPTIONS: SchoolOption[] = SCHOOL_SLUGS.map((slug) => ({
  slug, ...BUILT_IN_SCHOOLS[slug], builtIn: true,
}));

export function builtInSchool(slug: string): SchoolOption | null {
  return isSchoolSlug(slug) ? BUILT_IN_SCHOOL_OPTIONS.find((s) => s.slug === slug) ?? null : null;
}

/** What a person reads: "UC Berkeley", or the full name when there's no short one. */
export function schoolLabel(school: Pick<SchoolOption, "name" | "shortName">): string {
  return school.shortName || school.name;
}

// ── Matching ─────────────────────────────────────────────────────────────────
// A match key is the set of meaningful words in a name, with common
// abbreviations spelled out and filler words dropped, so these all agree:
//   "UC Law SF" · "UC Law San Francisco" ·
//   "University of California College of the Law, San Francisco"
// A trailing "in <city>" ("Samuel Merritt University in Oakland") is dropped
// too, and a well-known former name resolves to the current one (UC Hastings →
// UC Law SF), so inquiry spellings land on the school already saved.

const EXPANSIONS: Record<string, string[]> = {
  uc: ["university", "california"],
  csu: ["california", "state", "university"],
  cal: ["california"],
  ca: ["california"],
  sf: ["san", "francisco"],
  sj: ["san", "jose"],
  uop: ["university", "pacific"],
};
const FILLER = new Set(["of", "the", "at", "and", "in", "college", "university", "school", "campus"]);
// The longest place name "in" may introduce at the end: "in San Rafael".
const TRAILING_PLACE_MAX_WORDS = 3;

// Former names people still write. Every old spelling maps onto the current
// school's spelling, so one key comes out of all of them.
const RENAMED_SCHOOLS: { formerly: string[]; now: string }[] = [
  {
    formerly: ["UC Hastings", "Hastings College of the Law", "UC Hastings College of the Law", "Hastings Law"],
    now: "UC Law SF",
  },
];

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** "samuel merritt university in oakland" → "samuel merritt university". */
function dropTrailingPlace(tokens: string[]): string[] {
  const at = tokens.lastIndexOf("in");
  const trailing = tokens.length - at - 1;
  if (at < 1 || trailing < 1 || trailing > TRAILING_PLACE_MAX_WORDS) return tokens;
  return tokens.slice(0, at);
}

function rawMatchKey(text: string): string {
  const tokens = dropTrailingPlace(words(text))
    .flatMap((w) => EXPANSIONS[w] ?? [w])
    .filter((w) => !FILLER.has(w));
  return [...new Set(tokens)].sort().join(" ");
}

const RENAMED_KEYS = new Map<string, string>(
  RENAMED_SCHOOLS.flatMap(({ formerly, now }) => formerly.map((old) => [rawMatchKey(old), rawMatchKey(now)] as const)),
);

export function schoolMatchKey(text: string): string {
  const key = rawMatchKey(text);
  return RENAMED_KEYS.get(key) ?? key;
}

function keysOf(school: { name: string; shortName?: string | null; aliases?: string[]; slug?: string }): string[] {
  const texts = [
    school.name, school.shortName ?? "", ...(school.aliases ?? []), (school.slug ?? "").replace(/-/g, " "),
  ];
  return texts.map(schoolMatchKey).filter(Boolean);
}

/** Whether free text names this school (slug, name, short name or alias). */
export function schoolMatchesText(school: SchoolOption, text: string): boolean {
  const key = schoolMatchKey(text);
  return school.slug === text.trim().toLowerCase() || (key !== "" && keysOf(school).includes(key));
}

export interface SchoolCandidate { name: string; shortName: string | null; slug: string; aliases?: string[] }

/** An existing school this candidate would duplicate (same slug or same key), or null. */
export function findDuplicateSchool(
  candidate: SchoolCandidate, schools: readonly SchoolOption[],
): SchoolOption | null {
  const candidateKeys = new Set(keysOf(candidate));
  for (const school of schools) {
    if (school.slug === candidate.slug) return school;
    if (keysOf(school).some((k) => candidateKeys.has(k))) return school;
  }
  return null;
}

// A one-word key ("stanford", or "california" from the "Cal" alias) sits inside
// too many names to suggest anything; two words ("samuel merritt") are specific —
// unless they are all places or regions ("san francisco", "uc berkeley" →
// "berkeley california"), which half the Bay Area's schools share.
const SIMILAR_MIN_WORDS = 2;
const PLACE_WORDS = new Set([
  "san", "francisco", "jose", "oakland", "berkeley", "california", "state", "bay", "east", "north", "south",
  "west", "santa", "clara", "cruz", "hayward", "sacramento", "davis", "city", "area", "county",
]);

/** The shorter key names something specific and every word of it appears in the longer one. */
function keysOverlap(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a.split(" "), b.split(" ")] : [b.split(" "), a.split(" ")];
  if (shorter.length < SIMILAR_MIN_WORDS || shorter.every((w) => PLACE_WORDS.has(w))) return false;
  const have = new Set(longer);
  return shorter.every((w) => have.has(w));
}

/**
 * An existing school this candidate probably means — one name is a subset of
 * the other ("Samuel Merritt" vs "Samuel Merritt University, Oakland"). A
 * suggestion, not a block: the admin can confirm it is a different school.
 */
export function findSimilarSchool(
  candidate: SchoolCandidate, schools: readonly SchoolOption[],
): SchoolOption | null {
  const candidateKeys = keysOf(candidate);
  return schools.find((school) =>
    keysOf(school).some((k) => candidateKeys.some((c) => keysOverlap(c, k)))) ?? null;
}

export type SchoolMatch = { school: SchoolOption; kind: "duplicate" | "similar" };

/** Exact duplicate first (a hard block), then a look-alike (a suggestion). */
export function matchSchoolCandidate(
  candidate: SchoolCandidate, schools: readonly SchoolOption[],
): SchoolMatch | null {
  const duplicate = findDuplicateSchool(candidate, schools);
  if (duplicate) return { school: duplicate, kind: "duplicate" };
  const similar = findSimilarSchool(candidate, schools);
  return similar ? { school: similar, kind: "similar" } : null;
}

/** Search for the picker: substring over every name, then whole-key match. */
export function filterSchools(schools: readonly SchoolOption[], query: string): SchoolOption[] {
  const q = words(query).join(" ");
  if (!q) return [...schools];
  const qKey = schoolMatchKey(query);
  return schools.filter((s) => {
    const haystack = words([s.name, s.shortName ?? "", ...s.aliases, s.slug].join(" ")).join(" ");
    return haystack.includes(q) || (qKey !== "" && keysOf(s).includes(qKey));
  });
}

// ── New-school input ─────────────────────────────────────────────────────────

const SLUG_EXPANSIONS: Record<string, string[]> = { sf: ["san", "francisco"], sj: ["san", "jose"] };
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_CHARS = /^[\p{L}\p{N} .,'’&()/-]+$/u;
export const SCHOOL_SLUG_MAX = 80;
const NAME_MAX = 160;
const SHORT_NAME_MAX = 60;

/** "UC Law SF" → "uc-law-san-francisco". Built from the short name when given. */
export function suggestSchoolSlug(name: string, shortName: string | null): string {
  const source = shortName?.trim() || name;
  const parts = words(source).flatMap((w) => SLUG_EXPANSIONS[w] ?? [w]);
  let slug = "";
  for (const part of parts) {
    const next = slug ? `${slug}-${part}` : part;
    if (next.length > SCHOOL_SLUG_MAX) break;
    slug = next;
  }
  return slug;
}

const tidy = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

const ALIASES_MAX = 10;

type AliasesResult = { ok: true; aliases: string[] } | { ok: false; error: string };

/** Other spellings ("UC Hastings"), as an array or one comma-separated string. */
function validateAliases(input: unknown): AliasesResult {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const aliases = [...new Set(raw.map(tidy).filter(Boolean))];
  if (aliases.length > ALIASES_MAX) return { ok: false, error: `at most ${ALIASES_MAX} other names` };
  const bad = aliases.find((a) => a.length > SHORT_NAME_MAX || !NAME_CHARS.test(a));
  if (bad) return { ok: false, error: `other name "${bad}" is too long or has characters that aren't allowed` };
  return { ok: true, aliases };
}

export type NewSchoolResult =
  | { ok: true; value: Required<SchoolCandidate> }
  | { ok: false; error: string };

/** Server-side (and form-side) validation of an Add School submission. */
export function validateNewSchool(input: Record<string, unknown>): NewSchoolResult {
  const name = tidy(input.name);
  const shortName = tidy(input.shortName) || null;
  if (name.length < 2) return { ok: false, error: "school name is required" };
  if (name.length > NAME_MAX) return { ok: false, error: `school name must be ${NAME_MAX} characters or fewer` };
  if (!NAME_CHARS.test(name)) return { ok: false, error: "school name has characters that aren't allowed" };
  if (!schoolMatchKey(name)) return { ok: false, error: "school name needs more than generic words" };
  if (shortName && shortName.length > SHORT_NAME_MAX) {
    return { ok: false, error: `short name must be ${SHORT_NAME_MAX} characters or fewer` };
  }
  if (shortName && !NAME_CHARS.test(shortName)) {
    return { ok: false, error: "short name has characters that aren't allowed" };
  }
  const slug = tidy(input.slug).toLowerCase() || suggestSchoolSlug(name, shortName);
  if (!KEBAB.test(slug) || slug.length < 2 || slug.length > SCHOOL_SLUG_MAX) {
    return { ok: false, error: "slug must be lowercase words joined by hyphens (e.g. uc-law-san-francisco)" };
  }
  const aliases = validateAliases(input.aliases);
  if (!aliases.ok) return aliases;
  return { ok: true, value: { name, shortName, slug, aliases: aliases.aliases } };
}
