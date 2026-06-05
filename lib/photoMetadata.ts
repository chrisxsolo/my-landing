export const PORTFOLIO_CATEGORY_SLUG_ALIASES: Record<string, string> = {
  family: "families",
  graduation: "grads",
  portraits: "families",
};

const CATEGORY_ALT_TEXT: Record<string, string> = {
  couples: "Bay Area couples portrait by soloxsnaps",
  families: "Bay Area family portrait by soloxsnaps",
  grads: "Bay Area graduation portrait by soloxsnaps",
};

const CATEGORY_TITLES: Record<string, string> = {
  couples: "Couples portrait",
  families: "Family portrait",
  grads: "Graduation portrait",
};

type PhotoTextInput = {
  alt?: string | null;
  title?: string | null;
  categorySlug?: string | null;
};

type PhotoTitleInput = {
  title?: string | null;
  categorySlug?: string | null;
};

type ImageCandidate = {
  image_url?: string | null;
};

export function normalizePortfolioCategorySlug(slug?: string | null) {
  if (!slug) return "portfolio";
  return PORTFOLIO_CATEGORY_SLUG_ALIASES[slug] ?? slug;
}

export function isFilenameLikeText(value?: string | null) {
  const text = value?.trim();
  if (!text) return true;

  return (
    /\.(jpe?g|png|webp|heic|avif)$/i.test(text) ||
    /^DSC\d+/i.test(text) ||
    /^IMG[_-]?\d+/i.test(text)
  );
}

export function getPhotoAlt({ alt, title, categorySlug }: PhotoTextInput) {
  if (alt && !isFilenameLikeText(alt)) return alt.trim();
  if (title && !isFilenameLikeText(title)) return title.trim();

  const normalizedSlug = normalizePortfolioCategorySlug(categorySlug);
  return CATEGORY_ALT_TEXT[normalizedSlug] ?? "Bay Area portrait session by soloxsnaps";
}

export function getPhotoTitle({ title, categorySlug }: PhotoTitleInput) {
  if (title && !isFilenameLikeText(title)) return title.trim();

  const normalizedSlug = normalizePortfolioCategorySlug(categorySlug);
  return CATEGORY_TITLES[normalizedSlug] ?? "Portfolio image";
}

export function selectDistinctImageUrl(
  candidates: ImageCandidate[],
  usedUrls: Array<string | null | undefined>,
  fallback?: string | null
) {
  const used = new Set(usedUrls.filter(Boolean));
  const distinct = candidates.find((image) => image.image_url && !used.has(image.image_url));

  return distinct?.image_url ?? fallback ?? candidates.find((image) => image.image_url)?.image_url ?? null;
}
