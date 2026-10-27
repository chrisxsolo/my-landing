// Which service a blog post is about, read from its title + slug, and the
// site links that belong under that kind of post. Deterministic keyword
// matching — the same approach as detectSchoolLink. Used by the public post
// page (links below the article) and by the Content Engine (related posts).
import type { ServiceType } from "@/lib/contentEngine/taxonomy";

export interface SiteLink {
  label: string;
  href: string;
}

// Order matters: a "maternity family session" is maternity, a "grad couple"
// shoot is a grad session.
const SERVICE_MATCHERS: readonly [ServiceType, RegExp][] = [
  ["grads", /\bgrad(?:s|uat\w*)?\b|class[\s-]of[\s-]\d{4}|commencement|cap[\s-]and[\s-]gown/i],
  ["maternity", /\bmaternity\b/i],
  ["couples", /\bcouples?\b|\bengagement\b|\bproposal\b|\banniversary\b|\belop(?:e|ement)\b/i],
  ["families", /\bfamil(?:y|ies)\b/i],
  ["portraits", /\bportraits?\b|\bheadshots?\b/i],
  ["prom", /\bprom\b/i],
];

export function detectPostService(text: string): ServiceType | null {
  return SERVICE_MATCHERS.find(([, re]) => re.test(text))?.[0] ?? null;
}

// Category slugs (lib/blog/postCategories) that map onto a service's links.
// Proposals and elopements are couples-family sessions for linking purposes.
const CATEGORY_SERVICE: Record<string, ServiceType> = {
  graduation: "grads",
  couples: "couples",
  proposals: "couples",
  elopements: "couples",
  family: "families",
  maternity: "maternity",
  portraits: "portraits",
  prom: "prom",
  events: "events",
};

export type ServiceSignals = {
  /** Category tags saved on the post (`sites` / legacy `category`). */
  categoryTags?: readonly (string | null | undefined)[];
  /** Service of the Content Engine session the post was published from. */
  engineService?: ServiceType | null;
  /** Normalizes a tag to a display category slug (normalizeCategoryTag). */
  tagToCategory?: (tag: string) => string | null;
  /** Title + slug, for legacy posts with nothing structured. */
  text: string;
};

/**
 * The service a published post is about, most reliable signal first:
 * 1. an explicit category tag saved on the post,
 * 2. the Content Engine session it came from,
 * 3. keywords in its title and slug (legacy posts).
 * A title that merely mentions a "couple" can't override structured data.
 */
export function resolvePostService(signals: ServiceSignals): ServiceType | null {
  const tagged = (signals.categoryTags ?? [])
    .map((tag) => (tag && signals.tagToCategory ? signals.tagToCategory(tag) : null))
    .map((slug) => (slug ? CATEGORY_SERVICE[slug] : undefined))
    .find((service): service is ServiceType => Boolean(service));
  return tagged ?? signals.engineService ?? detectPostService(signals.text);
}

const CLOSING: readonly SiteLink[] = [
  { label: "Check availability", href: "/availability" },
  { label: "Contact", href: "/contact" },
];

const SERVICE_LINKS: Partial<Record<ServiceType, readonly SiteLink[]>> = {
  grads: [
    { label: "Graduation pricing", href: "/pricing/grads" },
    { label: "Graduation photo guide", href: "/grad-guide" },
    { label: "Bay Area campus spots", href: "/grad-guide/campus-spots" },
  ],
  couples: [
    { label: "Couples portfolio", href: "/portfolio/couples" },
    { label: "Couples photography guide", href: "/couples-guide" },
    { label: "Couples pricing", href: "/pricing/couples" },
  ],
  families: [
    { label: "Family photo guide", href: "/family-guide" },
    { label: "Family pricing", href: "/pricing/families" },
  ],
  maternity: [
    { label: "Maternity pricing", href: "/pricing/maternity" },
    { label: "Family photo guide", href: "/family-guide" },
  ],
  portraits: [
    { label: "Portrait location guide", href: "/portrait-guide" },
    { label: "Pricing", href: "/pricing" },
  ],
};

const DEFAULT_LINKS: readonly SiteLink[] = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * Links shown below a post: the school page (grad posts), the place the
 * session was shot when it has a published entry in the location library,
 * then its service's guide + pricing, then booking.
 */
export function exploreLinksFor(
  service: ServiceType | null, schoolLink: SiteLink | null, locationLink: SiteLink | null = null,
): SiteLink[] {
  const own = (service && SERVICE_LINKS[service]) || DEFAULT_LINKS;
  const school = service === "grads" && schoolLink ? [schoolLink] : [];
  const location = locationLink && !school.some((l) => l.href === locationLink.href) ? [locationLink] : [];
  return [...school, ...location, ...own, ...CLOSING];
}
