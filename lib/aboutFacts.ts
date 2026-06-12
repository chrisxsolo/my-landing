// lib/aboutFacts.ts
// Content + constants for the personal sections of /about: the rotating facts
// card and the photography-journey timeline. Fact defaults live here; admin
// text overrides live in site_settings and photos live in about_photos.
// No server or Next imports — safe for client components, API routes, and tests.

export const ABOUT_PHOTOS_BUCKET = "about-photos";
export const ABOUT_PHOTOS_TABLE = "about_photos";

export type AboutFact = {
  slug: string;
  title: string;
  body: string;
};

export type AboutFactContent = Pick<AboutFact, "title" | "body">;

// Default display order. A custom order can be saved from the Darkroom tab
// (site_settings key ABOUT_FACT_ORDER_KEY); see orderAboutFacts below.
export const ABOUT_FACTS: readonly AboutFact[] = [
  {
    slug: "running",
    title: "Runner's high, ocean views",
    body: "You'll usually find me looping Lake Merced or running the coast from the SF Zoo up to Sutro Baths — easily my favorite stretch in the city. It doubles as location scouting; some of my best session spots showed up mid-run.",
  },
  {
    slug: "mt-tam",
    title: "Across the bridge to Mount Tam",
    body: "When I want big views, I head across the Golden Gate to hike Mount Tamalpais. The camera always comes along — sunrise above the fog line never gets old.",
  },
  {
    slug: "burritos",
    title: "Powered by El Farolito",
    body: "I keep a running, citywide ranking of San Francisco burritos, and I take the research seriously. After years of field testing across every neighborhood, El Farolito holds the crown. Always accepting challengers.",
  },
  {
    slug: "skateboard",
    title: "Scouting on four wheels",
    body: "I ride my electric skateboard all over San Francisco hunting for photo spots you wouldn't normally think of. Half of my favorite shoot locations started as a random detour on the board.",
  },
];

// site_settings key holding the admin-saved fact order (JSON array of slugs).
export const ABOUT_FACT_ORDER_KEY = "about_fact_order";
export const ABOUT_FACT_CONTENT_KEY = "about_fact_content";
export const ABOUT_FACT_TITLE_MAX_LENGTH = 100;
export const ABOUT_FACT_BODY_MAX_LENGTH = 800;

export type AboutFactContentCheck =
  | { ok: true; content: AboutFactContent }
  | { ok: false; error: string };

export function validateAboutFactContent(value: unknown): AboutFactContentCheck {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Enter a headline and description." };
  }
  const { title, body } = value as { title?: unknown; body?: unknown };
  if (typeof title !== "string" || !title.trim()) {
    return { ok: false, error: "Fact headline is required." };
  }
  if (typeof body !== "string" || !body.trim()) {
    return { ok: false, error: "Fact description is required." };
  }
  if (title.trim().length > ABOUT_FACT_TITLE_MAX_LENGTH) {
    return { ok: false, error: `Fact headline must be ${ABOUT_FACT_TITLE_MAX_LENGTH} characters or fewer.` };
  }
  if (body.trim().length > ABOUT_FACT_BODY_MAX_LENGTH) {
    return { ok: false, error: `Fact description must be ${ABOUT_FACT_BODY_MAX_LENGTH} characters or fewer.` };
  }
  return { ok: true, content: { title: title.trim(), body: body.trim() } };
}

export function resolveAboutFacts(storedContent: unknown): readonly AboutFact[] {
  if (!storedContent || typeof storedContent !== "object" || Array.isArray(storedContent)) return ABOUT_FACTS;
  const overrides = storedContent as Record<string, unknown>;
  return ABOUT_FACTS.map((fact) => {
    const check = validateAboutFactContent(overrides[fact.slug]);
    return check.ok ? { ...fact, ...check.content } : fact;
  });
}

/**
 * Apply a stored slug order to a fact list. Tolerates anything: unknown slugs
 * are dropped, missing facts are appended in default order, and a non-array
 * (no saved order yet, corrupt JSON) returns the default order unchanged.
 */
export function orderAboutFacts(
  storedOrder: unknown,
  facts: readonly AboutFact[] = ABOUT_FACTS,
): readonly AboutFact[] {
  if (!Array.isArray(storedOrder)) return facts;
  const bySlug = new Map(facts.map((f) => [f.slug, f]));
  const ordered: AboutFact[] = [];
  for (const slug of storedOrder) {
    const fact = typeof slug === "string" ? bySlug.get(slug) : undefined;
    if (fact && !ordered.includes(fact)) ordered.push(fact);
  }
  for (const fact of facts) {
    if (!ordered.includes(fact)) ordered.push(fact);
  }
  return ordered;
}

export type AboutTimelineEntry = {
  year: string;
  title: string;
  body: string;
};

export const ABOUT_TIMELINE: readonly AboutTimelineEntry[] = [
  {
    year: "2019",
    title: "The first camera",
    body: "Picked up my first real camera right after graduating high school. What hooked me was the quality — realizing a photo could make a moment look even better than it did in person.",
  },
  {
    year: "2022",
    title: "Going all in on grads",
    body: "Started shooting graduation sessions for real — learning the campuses, the light, and how to direct people who had never been photographed before.",
  },
  {
    year: "2023",
    title: "The season that proved it",
    body: "My first big season: at least one grad session every single day through April, May, and the back half of June. Somewhere in that stretch I realized this is exactly what I want to be doing.",
  },
  {
    year: "2026",
    title: "Sharpening the experience",
    body: "Now it's about refining everything — the planning, the sessions, the delivery — using every lesson from the seasons before to make the client experience better each year.",
  },
];

const VALID_FACT_SLUGS = new Set(ABOUT_FACTS.map((f) => f.slug));

export function isValidAboutFactSlug(slug: unknown): slug is string {
  return typeof slug === "string" && VALID_FACT_SLUGS.has(slug);
}

/** Map of fact slug → uploaded photo, as consumed by the public page. */
export type AboutPhotoMap = Record<string, { url: string; alt: string }>;
