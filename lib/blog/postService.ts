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

/** Links shown below a post: its service's guide + pricing, then booking. */
export function exploreLinksFor(service: ServiceType | null, schoolLink: SiteLink | null): SiteLink[] {
  const own = (service && SERVICE_LINKS[service]) || DEFAULT_LINKS;
  const school = service === "grads" && schoolLink ? [schoolLink] : [];
  return [...school, ...own, ...CLOSING];
}
