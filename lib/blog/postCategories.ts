// Display categories for the /blog filter bar. Nothing here is stored: each
// post's category is derived at render time, in this order —
//   1. explicit category tags on the post (`sites` / legacy `category`),
//   2. the Content Engine session's service_type (for engine-published journals),
//   3. keywords in the title + slug (detectPostService).
// Tags are normalized ("grad", "graduation-photography" → Graduation), and an
// unrecognised tag becomes its own category, so new services show up in the
// filter bar without a code change.
import type { ServiceType } from "@/lib/contentEngine/taxonomy";
import { detectPostService } from "@/lib/blog/postService";

export type PostCategory = { slug: string; label: string };
export type CategoryFilter = PostCategory & { count: number };

type CategoryDef = PostCategory & { services: readonly ServiceType[]; aliases: readonly string[] };

// Display order of the filter pills. Unknown tags sort after these, by label.
const CATEGORY_DEFS: readonly CategoryDef[] = [
  { slug: "graduation", label: "Graduation", services: ["grads"], aliases: ["grad", "grads", "graduation", "graduations", "graduate", "commencement"] },
  { slug: "couples", label: "Couples", services: ["couples"], aliases: ["couple", "couples", "engagement", "engagements", "anniversary"] },
  { slug: "proposals", label: "Proposals", services: [], aliases: ["proposal", "proposals"] },
  { slug: "elopements", label: "Elopements", services: [], aliases: ["elope", "elopement", "elopements"] },
  { slug: "family", label: "Family", services: ["families"], aliases: ["family", "families"] },
  { slug: "maternity", label: "Maternity", services: ["maternity"], aliases: ["maternity"] },
  { slug: "portraits", label: "Portraits", services: ["portraits"], aliases: ["portrait", "portraits", "headshot", "headshots"] },
  { slug: "prom", label: "Prom", services: ["prom"], aliases: ["prom"] },
  { slug: "events", label: "Events", services: ["events"], aliases: ["event", "events"] },
];

// `sites` also holds the site a post is published to — those are not categories.
const SITE_TAGS = new Set(["professional", "journal"]);
const TRAILING_NOISE = /(^|\s+)(photography|photos?|sessions?|shoots?)$/;

// Couples-family sessions that read as a more specific kind of shoot.
const COUPLES_SUBTYPES: readonly [RegExp, string][] = [
  [/\bproposals?\b/i, "proposals"],
  [/\belop(?:e|ed|ement|ements)\b/i, "elopements"],
];

const DEF_BY_SLUG = new Map(CATEGORY_DEFS.map((d) => [d.slug, d]));
const DEF_BY_ALIAS = new Map(CATEGORY_DEFS.flatMap((d) => d.aliases.map((a) => [a, d] as const)));

function toPublic(def: CategoryDef): PostCategory {
  return { slug: def.slug, label: def.label };
}

function titleCase(words: string): string {
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Graduation-Photography" → Graduation; "boudoir_photos" → Boudoir (new); site tags → null. */
export function normalizeCategoryTag(raw: string): PostCategory | null {
  const words = raw.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words || SITE_TAGS.has(words)) return null;
  const core = words.replace(TRAILING_NOISE, "");
  if (!core) return null;
  const known = DEF_BY_ALIAS.get(core);
  if (known) return toPublic(known);
  return { slug: core.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), label: titleCase(core) };
}

export function categoryForService(service: ServiceType | null): PostCategory | null {
  if (!service) return null;
  const def = CATEGORY_DEFS.find((d) => d.services.includes(service));
  return def ? toPublic(def) : null;
}

export type CategorizablePost = {
  title: string;
  slug: string;
  category?: string | null;
  sites?: string[] | null;
};

/** The categories a post belongs to (usually one; [] when it can't be told). */
export function resolvePostCategories(post: CategorizablePost, engineService: ServiceType | null): PostCategory[] {
  const tags = [...(post.sites ?? []), post.category ?? ""];
  const explicit = tags.map(normalizeCategoryTag).filter((c): c is PostCategory => c !== null);
  if (explicit.length > 0) {
    return explicit.filter((c, i) => explicit.findIndex((o) => o.slug === c.slug) === i);
  }

  const text = `${post.title} ${post.slug}`;
  const base = categoryForService(engineService ?? detectPostService(text));
  if (!base) return [];
  if (base.slug !== "couples") return [base];
  const subtype = COUPLES_SUBTYPES.find(([re]) => re.test(text))?.[1];
  const def = subtype ? DEF_BY_SLUG.get(subtype) : undefined;
  return [def ? toPublic(def) : base];
}

/** Filter pills for every category that has at least one post, in display order. */
export function buildCategoryFilters(postCategories: readonly PostCategory[][]): CategoryFilter[] {
  const counts = new Map<string, CategoryFilter>();
  for (const cats of postCategories) {
    for (const cat of cats) {
      const prev = counts.get(cat.slug);
      counts.set(cat.slug, { ...cat, count: (prev?.count ?? 0) + 1 });
    }
  }
  const rank = (slug: string) => {
    const i = CATEGORY_DEFS.findIndex((d) => d.slug === slug);
    return i === -1 ? CATEGORY_DEFS.length : i;
  };
  return [...counts.values()].sort((a, b) => rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label));
}
