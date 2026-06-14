// Per-category framing for the /portfolio page. This is honest, *generic* copy
// about what a session in each category is like (typical locations, light,
// session feel) — NOT per-client case-study content, which is deferred until
// real session details exist. Keyed by the normalized portfolio category slug
// produced by normalizePortfolioCategorySlug ("grads" | "families" | "couples").

export type PortfolioDetail = { label: string; value: string };

export type PortfolioCategoryContent = {
  eyebrow: string;
  heading: string;
  body: string;
  details: PortfolioDetail[];
  pricingHref: string;
  pricingLabel: string;
};

// Shown when no category is selected ("All" / Selected Work).
export const DEFAULT_PORTFOLIO_CONTENT: PortfolioCategoryContent = {
  eyebrow: "What to expect",
  heading: "A curated look at recent work",
  body: "A relaxed, fully guided experience from the first message to the final gallery — graduation and family sessions photographed across the Bay Area.",
  details: [
    { label: "Where", value: "Campuses, parks & coastline across the Bay Area" },
    { label: "Best light", value: "Golden hour or soft overcast" },
    { label: "The feel", value: "Calm, directed, never stiff" },
  ],
  pricingHref: "/pricing",
  pricingLabel: "View pricing",
};

export const PORTFOLIO_CATEGORY_CONTENT: Record<string, PortfolioCategoryContent> = {
  grads: {
    eyebrow: "Graduation sessions",
    heading: "Grad portraits that actually look like you",
    body: "Cap-and-gown and outfit-change sessions at your campus landmarks or a favorite Bay Area spot. I direct every pose, so you can relax and the photos still feel natural.",
    details: [
      { label: "Where", value: "On campus or iconic Bay Area locations" },
      { label: "Best light", value: "Golden hour for warm, soft tones" },
      { label: "What's included", value: "Posing direction, outfit changes, full edited gallery" },
    ],
    pricingHref: "/pricing/grads",
    pricingLabel: "View grad pricing",
  },
  families: {
    eyebrow: "Family sessions",
    heading: "Warm family photos you'll actually print",
    body: "Easygoing sessions built around your family's pace — kids lead, I follow, and you walk away with the real moments alongside a few classic everyone-looking frames.",
    details: [
      { label: "Where", value: "Parks, beaches, or your own home" },
      { label: "Best light", value: "Golden hour, especially with little ones" },
      { label: "The feel", value: "Playful and unhurried, never forced" },
    ],
    pricingHref: "/pricing",
    pricingLabel: "View pricing",
  },
  couples: {
    eyebrow: "Couples sessions",
    heading: "Couples sessions with natural movement",
    body: "Guided prompts and gentle direction that get you laughing and moving together, so the photos feel like the two of you — not a stiff pose-and-hold.",
    details: [
      { label: "Where", value: "Coastline, gardens, and city spots" },
      { label: "Best light", value: "Golden hour glow" },
      { label: "The feel", value: "Connected, candid, easy" },
    ],
    pricingHref: "/pricing",
    pricingLabel: "View pricing",
  },
};

export function getPortfolioCategoryContent(slug?: string | null): PortfolioCategoryContent {
  if (!slug) return DEFAULT_PORTFOLIO_CONTENT;
  return PORTFOLIO_CATEGORY_CONTENT[slug] ?? DEFAULT_PORTFOLIO_CONTENT;
}

// Single source of truth for grad schools that have a live /grads/<slug> route
// (e.g. "UC Law" from GRAD_SCHOOL_OPTIONS has no page, so it's omitted). The
// `slug` is what gets stored in portfolio_images.school and used in the
// ?school= filter; the per-school landing links derive from it.
export type GradSchool = { slug: string; label: string };

export const GRAD_SCHOOLS: GradSchool[] = [
  { slug: "uc-berkeley", label: "UC Berkeley" },
  { slug: "sjsu", label: "SJSU" },
  { slug: "usf", label: "USF" },
  { slug: "sf-state", label: "SF State" },
  { slug: "csueb", label: "CSU East Bay" },
  { slug: "stanford", label: "Stanford" },
  { slug: "santa-clara", label: "Santa Clara" },
];

export function gradSchoolLabel(slug?: string | null): string | null {
  if (!slug) return null;
  return GRAD_SCHOOLS.find((school) => school.slug === slug)?.label ?? null;
}

// Grad school links → existing per-school landing pages, derived from GRAD_SCHOOLS.
export type GradSchoolLink = { label: string; href: string };

export const GRAD_SCHOOL_LINKS: GradSchoolLink[] = GRAD_SCHOOLS.map((school) => ({
  label: school.label,
  href: `/grads/${school.slug}`,
}));
