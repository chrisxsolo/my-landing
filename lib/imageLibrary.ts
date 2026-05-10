import { createSupabaseAdminClient } from "./supabaseAdmin";
import {
  buildJournalImageLibraryRows,
  buildPortfolioInsertFromAsset,
  filterMissingLibraryRows,
  getNextPortfolioSortOrder,
  IMAGE_LIBRARY_SOURCE_TYPES,
} from "./imageLibraryShared";

const BLOG_POSTS_TABLE = "blog_posts";
const IMAGE_LIBRARY_TABLE = "image_library";
const PORTFOLIO_IMAGES_TABLE = "portfolio_images";
const PORTFOLIO_CATEGORIES_TABLE = "portfolio_categories";
const DEFAULT_PORTFOLIO_IMAGE_TITLE = "Portfolio image";
const DEFAULT_LIST_LIMIT = 200;
const MAX_LIST_LIMIT = 500;
const JOURNAL_SITE = IMAGE_LIBRARY_SOURCE_TYPES.journal;

type SyncJournalPostImagesToLibraryInput = {
  postId: number;
  postSlug: string;
  postTitle: string;
  coverImageUrl: string | null;
  extraImageUrls: string[];
};

type PromoteImageLibraryAssetToPortfolioInput = {
  assetId: number;
  categorySlug: string;
};

type ListImageLibraryAssetsInput = {
  limit?: number;
  sourceType?: string;
  inPortfolio?: boolean;
  sourcePostId?: number;
};

type BackfillJournalImageLibraryInput = {
  dryRun?: boolean;
};

type ImageLibraryAssetRow = {
  id: number;
  title: string | null;
  alt: string | null;
  image_url: string;
  storage_path: string | null;
  source_type: string;
  source_post_id: number | null;
  source_post_slug: string | null;
  source_role: string;
  in_portfolio: boolean;
  created_at: string;
  updated_at: string;
};

type BlogPostRow = {
  id: number;
  title: string | null;
  slug: string;
  cover_image_url: string | null;
  extra_image_urls: unknown;
};

type PortfolioImageRow = {
  id: number;
  sort_order: number | null;
};

type PortfolioCategoryRow = {
  id: number;
  slug: string;
};

type ExistingLibraryIdentityRow = {
  source_post_id: number;
  source_role: string;
  image_url: string;
};

export type ImageLibraryListItem = ImageLibraryAssetRow & {
  source_post_title: string | null;
};

function getPortfolioImageTitle(asset: Pick<ImageLibraryAssetRow, "title" | "alt">) {
  return asset.title?.trim() || asset.alt?.trim() || DEFAULT_PORTFOLIO_IMAGE_TITLE;
}

function normalizeExtraImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });
}

function normalizeListLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  const rounded = Math.trunc(limit ?? DEFAULT_LIST_LIMIT);
  return Math.min(Math.max(rounded, 1), MAX_LIST_LIMIT);
}

async function getJournalBlogPosts() {
  const supabase = createSupabaseAdminClient();
  const primaryQuery = await supabase
    .from(BLOG_POSTS_TABLE)
    .select("id,title,slug,cover_image_url,extra_image_urls")
    .contains("sites", [JOURNAL_SITE])
    .order("published_at", { ascending: false })
    .returns<BlogPostRow[]>();

  if (!primaryQuery.error) {
    return primaryQuery.data ?? [];
  }

  const fallbackQuery = await supabase
    .from(BLOG_POSTS_TABLE)
    .select("id,title,slug,cover_image_url,extra_image_urls")
    .eq("category", JOURNAL_SITE)
    .order("published_at", { ascending: false })
    .returns<BlogPostRow[]>();

  if (fallbackQuery.error) throw fallbackQuery.error;
  return fallbackQuery.data ?? [];
}

async function getExistingImageLibraryRows(postIds: number[]) {
  if (postIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(IMAGE_LIBRARY_TABLE)
    .select("source_post_id,source_role,image_url")
    .in("source_post_id", postIds);

  if (error) throw error;

  return (data ?? []) as ExistingLibraryIdentityRow[];
}

export async function listImageLibraryAssets(input: ListImageLibraryAssetsInput = {}) {
  const supabase = createSupabaseAdminClient();
  const limit = normalizeListLimit(input.limit);

  let query = supabase
    .from(IMAGE_LIBRARY_TABLE)
    .select(
      "id,title,alt,image_url,storage_path,source_type,source_post_id,source_post_slug,source_role,in_portfolio,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.sourceType) {
    query = query.eq("source_type", input.sourceType);
  }

  if (typeof input.inPortfolio === "boolean") {
    query = query.eq("in_portfolio", input.inPortfolio);
  }

  if (typeof input.sourcePostId === "number") {
    query = query.eq("source_post_id", input.sourcePostId);
  }

  const { data: assets, error } = await query.returns<ImageLibraryAssetRow[]>();
  if (error) throw error;

  const postIds = Array.from(
    new Set(
      (assets ?? [])
        .map((asset) => asset.source_post_id)
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  const postTitlesById = new Map<number, string | null>();
  if (postIds.length > 0) {
    const { data: posts, error: postError } = await supabase
      .from(BLOG_POSTS_TABLE)
      .select("id,title")
      .in("id", postIds);

    if (postError) throw postError;

    for (const post of posts ?? []) {
      if (typeof post.id === "number") {
        postTitlesById.set(post.id, typeof post.title === "string" ? post.title : null);
      }
    }
  }

  return (assets ?? []).map((asset) => ({
    ...asset,
    source_post_title: asset.source_post_id ? (postTitlesById.get(asset.source_post_id) ?? null) : null,
  }));
}

export async function syncJournalPostImagesToLibrary(
  input: SyncJournalPostImagesToLibraryInput,
) {
  const supabase = createSupabaseAdminClient();
  const candidateRows = buildJournalImageLibraryRows(input);

  if (candidateRows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(IMAGE_LIBRARY_TABLE)
    .select("source_post_id,source_role,image_url")
    .eq("source_post_id", input.postId);

  if (existingError) throw existingError;

  const rowsToInsert = filterMissingLibraryRows(
    candidateRows,
    (existingRows ?? []) as ExistingLibraryIdentityRow[],
  );

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped: candidateRows.length };
  }

  const { error: insertError } = await supabase.from(IMAGE_LIBRARY_TABLE).upsert(rowsToInsert, {
    onConflict: "source_post_id,source_role,image_url",
    ignoreDuplicates: true,
  });

  if (insertError) throw insertError;

  return {
    inserted: rowsToInsert.length,
    skipped: candidateRows.length - rowsToInsert.length,
  };
}

export async function backfillJournalImageLibrary(input: BackfillJournalImageLibraryInput = {}) {
  const posts = await getJournalBlogPosts();
  const existingRows = await getExistingImageLibraryRows(posts.map((post) => post.id));

  const candidateRows = posts.flatMap((post) =>
    buildJournalImageLibraryRows({
      postId: post.id,
      postSlug: post.slug,
      postTitle: post.title?.trim() || post.slug,
      coverImageUrl: post.cover_image_url,
      extraImageUrls: normalizeExtraImageUrls(post.extra_image_urls),
    }),
  );

  const rowsToInsert = filterMissingLibraryRows(candidateRows, existingRows);

  if (!input.dryRun && rowsToInsert.length > 0) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from(IMAGE_LIBRARY_TABLE).insert(rowsToInsert);
    if (error) throw error;
  }

  return {
    dryRun: input.dryRun === true,
    scannedPosts: posts.length,
    candidateAssets: candidateRows.length,
    insertedAssets: input.dryRun ? 0 : rowsToInsert.length,
    missingAssets: rowsToInsert.length,
    skippedAssets: candidateRows.length - rowsToInsert.length,
  };
}

export async function promoteImageLibraryAssetToPortfolio(
  input: PromoteImageLibraryAssetToPortfolioInput,
) {
  if (!input.categorySlug.trim()) {
    throw new Error("Category slug is required.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: asset, error: assetError } = await supabase
    .from(IMAGE_LIBRARY_TABLE)
    .select("id,title,alt,image_url,in_portfolio")
    .eq("id", input.assetId)
    .maybeSingle<ImageLibraryAssetRow>();

  if (assetError) throw assetError;
  if (!asset) throw new Error("Image library asset not found.");

  const { data: category, error: categoryError } = await supabase
    .from(PORTFOLIO_CATEGORIES_TABLE)
    .select("id,slug")
    .eq("slug", input.categorySlug)
    .maybeSingle<PortfolioCategoryRow>();

  if (categoryError) throw categoryError;
  if (!category) throw new Error("Portfolio category not found.");

  const { data: existingPortfolioImages, error: existingPortfolioError } = await supabase
    .from(PORTFOLIO_IMAGES_TABLE)
    .select("id,sort_order")
    .eq("image_url", asset.image_url)
    .limit(1)
    .returns<PortfolioImageRow[]>();

  if (existingPortfolioError) throw existingPortfolioError;

  const existingPortfolioImage = existingPortfolioImages?.[0] ?? null;

  if (existingPortfolioImage) {
    const { error: updateError } = await supabase
      .from(IMAGE_LIBRARY_TABLE)
      .update({ in_portfolio: true })
      .eq("id", asset.id);

    if (updateError) throw updateError;

    return {
      assetId: asset.id,
      portfolioImageId: existingPortfolioImage.id,
      created: false,
      sortOrder: existingPortfolioImage.sort_order,
    };
  }

  const { data: portfolioRows, error: portfolioRowsError } = await supabase
    .from(PORTFOLIO_IMAGES_TABLE)
    .select("sort_order");

  if (portfolioRowsError) throw portfolioRowsError;

  const sortOrder = getNextPortfolioSortOrder(
    (portfolioRows ?? []) as Array<{ sort_order?: number | null }>,
  );
  const title = getPortfolioImageTitle(asset);
  const alt = asset.alt?.trim() || title;

  const payload = buildPortfolioInsertFromAsset({
    title,
    alt,
    image_url: asset.image_url,
    categorySlug: category.slug,
    categoryId: category.id,
    sortOrder,
  });

  const { data: insertedPortfolioImage, error: insertPortfolioError } = await supabase
    .from(PORTFOLIO_IMAGES_TABLE)
    .insert(payload)
    .select("id,sort_order")
    .single<PortfolioImageRow>();

  if (insertPortfolioError) throw insertPortfolioError;

  const { error: markAssetError } = await supabase
    .from(IMAGE_LIBRARY_TABLE)
    .update({ in_portfolio: true })
    .eq("id", asset.id);

  if (markAssetError) throw markAssetError;

  return {
    assetId: asset.id,
    portfolioImageId: insertedPortfolioImage.id,
    created: true,
    sortOrder: insertedPortfolioImage.sort_order,
  };
}
