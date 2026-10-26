// Page keys name one public page that shows matched photos:
//   "grads/<school slug>"        → /grads/<slug>
//   "<guide>/<location slug>"    → /<guide>-guide/locations/<slug>
// The same keys are stored in page_photo_curation, so they must stay stable.
// Pure module — safe for client components.

export const PAGE_PHOTO_CURATION_TABLE = "page_photo_curation";

export const PAGE_KINDS = ["grads", "couples", "family", "portrait"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

const PAGE_KEY = /^(grads|couples|family|portrait)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function schoolPageKey(slug: string): string {
  return `grads/${slug}`;
}

export function guidePageKey(guide: Exclude<PageKind, "grads">, slug: string): string {
  return `${guide}/${slug}`;
}

export function parsePageKey(key: string): { kind: PageKind; slug: string } | null {
  const match = PAGE_KEY.exec(key);
  return match ? { kind: match[1] as PageKind, slug: match[2] } : null;
}

export function isPageKey(value: unknown): value is string {
  return typeof value === "string" && parsePageKey(value) !== null;
}

/** The public URL path a page key renders at. */
export function pagePath(key: string): string | null {
  const parsed = parsePageKey(key);
  if (!parsed) return null;
  return parsed.kind === "grads"
    ? `/grads/${parsed.slug}`
    : `/${parsed.kind}-guide/locations/${parsed.slug}`;
}
