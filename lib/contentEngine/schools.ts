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
  usf: { name: "University of San Francisco", shortName: "USF", aliases: ["USFCA"] },
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

const EXPANSIONS: Record<string, string[]> = {
  uc: ["university", "california"],
  csu: ["california", "state", "university"],
  cal: ["california"],
  sf: ["san", "francisco"],
  sj: ["san", "jose"],
};
const FILLER = new Set(["of", "the", "at", "and", "in", "college", "university", "school", "campus"]);

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

export function schoolMatchKey(text: string): string {
  const tokens = words(text).flatMap((w) => EXPANSIONS[w] ?? [w]).filter((w) => !FILLER.has(w));
  return [...new Set(tokens)].sort().join(" ");
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

export interface SchoolCandidate { name: string; shortName: string | null; slug: string }

/** An existing school this candidate would duplicate, or null. */
export function findDuplicateSchool(
  candidate: SchoolCandidate, schools: readonly SchoolOption[],
): SchoolOption | null {
  const candidateKeys = new Set(keysOf({ name: candidate.name, shortName: candidate.shortName }));
  for (const school of schools) {
    if (school.slug === candidate.slug) return school;
    if (keysOf(school).some((k) => candidateKeys.has(k))) return school;
  }
  return null;
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

export type NewSchoolResult =
  | { ok: true; value: SchoolCandidate }
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
  return { ok: true, value: { name, shortName, slug } };
}
