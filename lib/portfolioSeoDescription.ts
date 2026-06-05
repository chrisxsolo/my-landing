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
] as const;

export type GradSchoolOption = (typeof GRAD_SCHOOL_OPTIONS)[number];
export type GradLocationOption = (typeof GRAD_LOCATION_OPTIONS)[number];

export type PortfolioSeoTagsInput = {
  school?: unknown;
  location?: unknown;
  goldenHour?: unknown;
};

export type PortfolioSeoTags = {
  school: GradSchoolOption | null;
  location: GradLocationOption | null;
  goldenHour: boolean;
};

export type PortfolioSeoDescription = {
  title: string;
  alt: string;
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

export function normalizePortfolioSeoTags(input: PortfolioSeoTagsInput): PortfolioSeoTags {
  return {
    school: isAllowedValue(GRAD_SCHOOL_OPTIONS, input.school) ? input.school : null,
    location: isAllowedValue(GRAD_LOCATION_OPTIONS, input.location) ? input.location : null,
    goldenHour: input.goldenHour === true,
  };
}

export function buildPortfolioSeoDescription(input: PortfolioSeoTagsInput): PortfolioSeoDescription {
  const tags = normalizePortfolioSeoTags(input);
  const school = tags.school ?? "Bay Area";
  const lightPrefix = tags.goldenHour ? "Golden hour " : "";

  if (tags.location === "On campus") {
    return {
      title: `${school} on-campus grad portrait`,
      alt: trimToLength(`${lightPrefix}${school} graduation portrait taken on campus in the Bay Area`, 125),
    };
  }

  if (tags.location) {
    return {
      title: `${school} grad portrait at ${tags.location}`,
      alt: trimToLength(`${lightPrefix}${school} graduation portrait at ${tags.location} in the Bay Area`, 125),
    };
  }

  return {
    title: `${school} graduation portrait`,
    alt: trimToLength(`${lightPrefix}${school} graduation portrait by soloxsnaps in the Bay Area`, 125),
  };
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
