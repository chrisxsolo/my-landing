export const GRAD_SCHOOL_OPTIONS = [
  "USF",
  "UC Berkeley",
  "SF State",
  "UC Law",
  "SJSU",
  "CSUEB",
  "Stanford",
  "Santa Clara",
] as const;

export const GRAD_LOCATION_OPTIONS = [
  "On campus",
  "Legion of Honor",
  "Rose Garden",
  "Palace of Fine Arts",
  "City Hall",
  "Baker Beach",
  "Golden Gate Bridge",
  "Lands End",
  "Japanese Tea Garden",
  "Sather Gate",
  "Treasure Island",
] as const;

export const GRAD_SESSION_OPTIONS = ["Solo", "Couple", "Friends", "Family"] as const;
export const GRAD_DEGREE_OPTIONS = ["Bachelor's", "Master's", "PhD", "Law", "MBA", "Nursing"] as const;
export const GRAD_YEAR_OPTIONS = ["2026", "2025"] as const;
export const GRAD_ATTIRE_OPTIONS = ["Cap & gown", "Cultural attire", "Sash/stole", "Regalia", "Scrubs"] as const;

export type GradSchoolOption = (typeof GRAD_SCHOOL_OPTIONS)[number];
export type GradLocationOption = (typeof GRAD_LOCATION_OPTIONS)[number];
export type GradSessionOption = (typeof GRAD_SESSION_OPTIONS)[number];
export type GradDegreeOption = (typeof GRAD_DEGREE_OPTIONS)[number];
export type GradYearOption = (typeof GRAD_YEAR_OPTIONS)[number];
export type GradAttireOption = (typeof GRAD_ATTIRE_OPTIONS)[number];

export type PortfolioSeoTagsInput = {
  school?: unknown;
  location?: unknown;
  session?: unknown;
  degree?: unknown;
  year?: unknown;
  attire?: unknown;
  goldenHour?: unknown;
};

export type PortfolioSeoTags = {
  school: GradSchoolOption | null;
  location: GradLocationOption | null;
  session: GradSessionOption | null;
  degree: GradDegreeOption | null;
  year: GradYearOption | null;
  attire: GradAttireOption | null;
  goldenHour: boolean;
};

export type PortfolioSeoDescription = {
  title: string;
  alt: string;
};

// Phrase fragments woven into the generated title/alt. Empty string = nothing added.
const SESSION_WORD: Record<GradSessionOption, string> = {
  Solo: "",
  Couple: "couple's ",
  Friends: "friends' ",
  Family: "family ",
};

const DEGREE_WORD: Record<GradDegreeOption, string> = {
  "Bachelor's": "",
  "Master's": "master's ",
  PhD: "PhD ",
  Law: "law school ",
  MBA: "MBA ",
  Nursing: "nursing ",
};

const ATTIRE_PHRASE: Record<GradAttireOption, string> = {
  "Cap & gown": "in cap and gown",
  "Cultural attire": "in cultural attire",
  "Sash/stole": "with sash and stole",
  Regalia: "in full regalia",
  Scrubs: "in nursing scrubs",
};

function isAllowedValue<T extends readonly string[]>(options: T, value: unknown): value is T[number] {
  return typeof value === "string" && options.includes(value as T[number]);
}

function trimToLength(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  const shortened = value.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return shortened.slice(0, lastSpace > 20 ? lastSpace : maxLength).trim();
}

function capitalize(value: string) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function squashSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePortfolioSeoTags(input: PortfolioSeoTagsInput): PortfolioSeoTags {
  return {
    school: isAllowedValue(GRAD_SCHOOL_OPTIONS, input.school) ? input.school : null,
    location: isAllowedValue(GRAD_LOCATION_OPTIONS, input.location) ? input.location : null,
    session: isAllowedValue(GRAD_SESSION_OPTIONS, input.session) ? input.session : null,
    degree: isAllowedValue(GRAD_DEGREE_OPTIONS, input.degree) ? input.degree : null,
    year: isAllowedValue(GRAD_YEAR_OPTIONS, input.year) ? input.year : null,
    attire: isAllowedValue(GRAD_ATTIRE_OPTIONS, input.attire) ? input.attire : null,
    goldenHour: input.goldenHour === true,
  };
}

function locationSuffix(location: GradLocationOption | null) {
  if (!location) return "";
  return location === "On campus" ? "on campus" : `at ${location}`;
}

export function buildPortfolioSeoDescription(input: PortfolioSeoTagsInput): PortfolioSeoDescription {
  const tags = normalizePortfolioSeoTags(input);
  const school = tags.school ?? "Bay Area";
  const who = tags.session ? SESSION_WORD[tags.session] : "";
  const level = tags.degree ? DEGREE_WORD[tags.degree] : "";
  const lightPrefix = tags.goldenHour ? "Golden hour " : "";

  const subject = squashSpaces(`${who}${school} ${level}grad portrait`);
  const place = locationSuffix(tags.location);
  const title = capitalize(trimToLength(squashSpaces(`${subject} ${place}`), 72));

  const altParts = [
    `${lightPrefix}${who}${school} ${level}graduation portrait`,
    place,
    tags.attire ? ATTIRE_PHRASE[tags.attire] : "",
    "in the Bay Area",
    tags.year ? `— Class of ${tags.year}` : "",
  ].filter(Boolean);
  const alt = capitalize(trimToLength(squashSpaces(altParts.join(" ")), 125));

  return { title, alt };
}

export function normalizeAiPortfolioSeoDescription(
  input: Partial<PortfolioSeoDescription>,
  fallback: PortfolioSeoDescription,
): PortfolioSeoDescription {
  const title = input.title?.trim();
  const alt = input.alt?.trim();

  return {
    title: title ? trimToLength(title, 72) : fallback.title,
    alt: alt ? trimToLength(alt, 125) : fallback.alt,
  };
}
