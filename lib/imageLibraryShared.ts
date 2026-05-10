export const IMAGE_LIBRARY_SOURCE_TYPES = {
  journal: "journal",
} as const;

export const IMAGE_LIBRARY_SOURCE_ROLES = {
  cover: "cover",
  gallery: "gallery",
} as const;

export type ImageLibrarySourceType =
  (typeof IMAGE_LIBRARY_SOURCE_TYPES)[keyof typeof IMAGE_LIBRARY_SOURCE_TYPES];

export type ImageLibrarySourceRole =
  (typeof IMAGE_LIBRARY_SOURCE_ROLES)[keyof typeof IMAGE_LIBRARY_SOURCE_ROLES];

export type JournalImageLibraryRow = {
  title: string;
  alt: string;
  image_url: string;
  source_type: ImageLibrarySourceType;
  source_post_id: number;
  source_post_slug: string;
  source_role: ImageLibrarySourceRole;
  in_portfolio: false;
};

export type BuildJournalImageLibraryRowsInput = {
  postId: number;
  postSlug: string;
  postTitle: string;
  coverImageUrl: string | null;
  extraImageUrls: string[];
};

export type PortfolioInsertFromAssetInput = {
  title: string;
  alt: string;
  image_url: string;
  categorySlug: string;
  categoryId: number | null;
  sortOrder: number;
};

export type PortfolioInsertPayload = {
  title: string;
  alt: string;
  image_url: string;
  category_id: number | null;
  category_slug: string;
  featured: false;
  sort_order: number;
};

export type ImageLibraryKeyInput = {
  source_post_id: number;
  source_role: ImageLibrarySourceRole | string;
  image_url: string;
};

export type ImageLibraryRowIdentity = {
  source_post_id: number;
  source_role: ImageLibrarySourceRole | string;
  image_url: string;
};

export type PortfolioSortOrderRow = {
  sort_order?: number | null;
};

export function imageLibraryKey(input: ImageLibraryKeyInput) {
  return `${input.source_post_id}::${input.source_role}::${input.image_url}`;
}

export function filterMissingLibraryRows<T extends ImageLibraryRowIdentity>(
  candidates: T[],
  existing: ImageLibraryRowIdentity[],
) {
  const existingKeys = new Set(existing.map((row) => imageLibraryKey(row)));
  const seenCandidateKeys = new Set<string>();

  return candidates.filter((row) => {
    const key = imageLibraryKey(row);
    if (existingKeys.has(key) || seenCandidateKeys.has(key)) return false;
    seenCandidateKeys.add(key);
    return true;
  });
}

export function getNextPortfolioSortOrder(rows: PortfolioSortOrderRow[]) {
  const highestSortOrder = rows.reduce((maxSortOrder, row) => {
    return Math.max(maxSortOrder, Number(row.sort_order ?? 0));
  }, 0);

  return highestSortOrder + 1;
}

export function buildJournalImageLibraryRows(
  input: BuildJournalImageLibraryRowsInput,
): JournalImageLibraryRow[] {
  const rows: JournalImageLibraryRow[] = [];

  if (input.coverImageUrl) {
    rows.push({
      title: `${input.postTitle} cover`,
      alt: `${input.postTitle} cover`,
      image_url: input.coverImageUrl,
      source_type: IMAGE_LIBRARY_SOURCE_TYPES.journal,
      source_post_id: input.postId,
      source_post_slug: input.postSlug,
      source_role: IMAGE_LIBRARY_SOURCE_ROLES.cover,
      in_portfolio: false,
    });
  }

  for (const imageUrl of input.extraImageUrls) {
    rows.push({
      title: input.postTitle,
      alt: input.postTitle,
      image_url: imageUrl,
      source_type: IMAGE_LIBRARY_SOURCE_TYPES.journal,
      source_post_id: input.postId,
      source_post_slug: input.postSlug,
      source_role: IMAGE_LIBRARY_SOURCE_ROLES.gallery,
      in_portfolio: false,
    });
  }

  return rows;
}

export function buildPortfolioInsertFromAsset(
  input: PortfolioInsertFromAssetInput,
): PortfolioInsertPayload {
  return {
    title: input.title,
    alt: input.alt,
    image_url: input.image_url,
    category_id: input.categoryId,
    category_slug: input.categorySlug,
    featured: false,
    sort_order: input.sortOrder,
  };
}
