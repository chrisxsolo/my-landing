// lib/aboutFacts.ts
// Content + constants for the personal sections of /about: the rotating facts
// card and the photography-journey timeline. Fact/timeline TEXT is hardcoded
// here (same convention as the rest of the About copy); fact PHOTOS live in the
// about_photos table and are managed from the Darkroom "About Page" tab.
// No server or Next imports — safe for client components, API routes, and tests.

export const ABOUT_PHOTOS_BUCKET = "about-photos";
export const ABOUT_PHOTOS_TABLE = "about_photos";

export type AboutFact = {
  slug: string;
  title: string;
  body: string;
};

export const ABOUT_FACTS: readonly AboutFact[] = [
  {
    slug: "burritos",
    title: "Powered by El Farolito",
    body: "I keep a running, citywide ranking of San Francisco burritos, and I take the research seriously. After years of field testing across every neighborhood, El Farolito holds the crown. Always accepting challengers.",
  },
  {
    slug: "running",
    title: "Runner's high, ocean views",
    body: "You'll usually find me looping Lake Merced or running the coast from the SF Zoo up to Sutro Baths — easily my favorite stretch in the city. It doubles as location scouting; some of my best session spots showed up mid-run.",
  },
  {
    slug: "skateboard",
    title: "Scouting on four wheels",
    body: "I ride my electric skateboard all over San Francisco hunting for photo spots you wouldn't normally think of. Half of my favorite shoot locations started as a random detour on the board.",
  },
  {
    slug: "mt-tam",
    title: "Across the bridge to Mount Tam",
    body: "When I want big views, I head across the Golden Gate to hike Mount Tamalpais. The camera always comes along — sunrise above the fog line never gets old.",
  },
];

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
