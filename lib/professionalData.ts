import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";
import {
  getPhotoAlt,
  getPhotoTitle,
  normalizePortfolioCategorySlug,
} from "@/lib/photoMetadata";
import {
  NAV_CONFIG_SETTING_KEY,
  DEFAULT_NAV_CONFIG,
  parseNavConfig,
  type NavConfig,
} from "@/lib/navConfig";

export type PortfolioCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export type PortfolioImage = {
  id: number;
  title: string;
  alt: string;
  image_url: string;
  category_id: number | null;
  category_slug: string;
  category_name: string;
  featured: boolean;
  hero_carousel: boolean;
  sort_order: number;
  created_at: string | null;
  location?: string | null;
  school?: string | null;
  content_hash?: string | null;
};

export type BlogPost = {
  id: number;
  title: string;
  body: string;
  published_at: string;
  slug: string;
  cover_image_url: string | null;
  extra_image_urls: string[];
  category?: "professional" | "journal" | string | null;
  sites?: string[] | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_image_url?: string | null;
  cover_image_alt?: string | null;
  extra_image_alts?: string[] | null;
};

// Exactly the columns normalizeImage reads — avoids select("*") pulling future
// columns (e.g. updated_at) the public pages never use.
const PORTFOLIO_IMAGE_COLUMNS =
  "id,title,alt,image_url,category_id,category_slug,featured,sort_order,created_at,hero_carousel,school";

// Blog listing/sitemap never render the full article, so omit the heavy `body`
// column. /blog/[slug] uses getBlogPostBySlug, which still selects everything.
export type BlogPostSummary = Omit<BlogPost, "body">;

const BLOG_SUMMARY_COLUMNS =
  "id,title,published_at,slug,cover_image_url,extra_image_urls,category,sites,meta_description,meta_keywords,og_image_url,cover_image_alt,extra_image_alts";

type RawCategory = Partial<PortfolioCategory> & {
  order?: number;
};

type RawPortfolioImage = Partial<PortfolioImage> & {
  order?: number;
  caption?: string | null;
};

const FALLBACK_PROFILE_IMAGE =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/chris-portrait.jpg";

const VISIBLE_PORTFOLIO_SLUGS = ["grads", "families"];

export const FALLBACK_CATEGORIES: PortfolioCategory[] = [
  {
    id: 1,
    name: "Grads",
    slug: "grads",
    description: "Clean Bay Area graduation portraits with a soft editorial feel.",
    sort_order: 1,
    active: true,
  },
  {
    id: 2,
    name: "Families",
    slug: "families",
    description: "Warm family sessions for the people and moments you want to keep.",
    sort_order: 2,
    active: true,
  },
  {
    id: 3,
    name: "Couples",
    slug: "couples",
    description: "Guided Bay Area couples sessions with natural movement and clear direction.",
    sort_order: 3,
    active: true,
  },
];

const FALLBACK_IMAGES: PortfolioImage[] = [
  {
    id: 1,
    title: "Chris Solorzano portrait",
    alt: "Portrait of Chris Solorzano",
    image_url: FALLBACK_PROFILE_IMAGE,
    category_id: 2,
    category_slug: "families",
    category_name: "Families",
    featured: true,
    hero_carousel: true,
    sort_order: 1,
    created_at: null,
  },
];

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.message?.toLowerCase().includes("category");
}

function normalizeCategory(raw: RawCategory, index: number): PortfolioCategory {
  const slug = normalizePortfolioCategorySlug(raw.slug);
  const fallback = FALLBACK_CATEGORIES.find((item) => item.slug === slug);

  return {
    id: Number(raw.id ?? index + 1),
    name: fallback?.name ?? raw.name ?? "Portfolio",
    slug,
    description: raw.description ?? fallback?.description ?? null,
    sort_order: fallback?.sort_order ?? Number(raw.sort_order ?? raw.order ?? index + 1),
    active: fallback?.active ?? raw.active ?? true,
  };
}

function getVisiblePortfolioCategories(categories: PortfolioCategory[]) {
  return categories.filter(
    (category) => category.active && VISIBLE_PORTFOLIO_SLUGS.includes(category.slug),
  );
}

function normalizeImage(
  raw: RawPortfolioImage,
  index: number,
  categories: PortfolioCategory[]
): PortfolioImage {
  const categorySlug = normalizePortfolioCategorySlug(raw.category_slug ?? categories[0]?.slug);
  const category = categories.find((item) => item.slug === categorySlug);
  const title = getPhotoTitle({
    title: raw.title ?? raw.caption,
    categorySlug,
  });

  return {
    id: Number(raw.id ?? index + 1),
    title,
    alt: getPhotoAlt({
      alt: raw.alt,
      title,
      categorySlug,
    }),
    image_url: raw.image_url ?? "",
    category_id: raw.category_id ?? category?.id ?? null,
    category_slug: categorySlug,
    category_name: category?.name ?? categorySlug,
    featured: raw.featured ?? index < 6,
    hero_carousel: raw.hero_carousel ?? false,
    sort_order: Number(raw.sort_order ?? raw.order ?? index + 1),
    created_at: raw.created_at ?? null,
    school: raw.school ?? null,
  };
}

export async function getPortfolioCategories() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("portfolio_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return getVisiblePortfolioCategories(FALLBACK_CATEGORIES);
    }

    const normalized = data
      .map((item, index) => normalizeCategory(item, index))
      .filter((category) => category.active);

    const merged = getVisiblePortfolioCategories(FALLBACK_CATEGORIES)
      .map((fallback) => normalized.find((category) => category.slug === fallback.slug) ?? fallback);

    return merged;
  } catch (error) {
    console.error("Failed to load portfolio categories", error);
    return getVisiblePortfolioCategories(FALLBACK_CATEGORIES);
  }
}

async function getGradPhotoFallback(categories: PortfolioCategory[]) {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("grad_photos")
      .select("id,image_url,caption,created_at")
      .order("created_at", { ascending: false })
      .limit(18);

    if (error || !data || data.length === 0) {
      return FALLBACK_IMAGES;
    }

    const graduation = categories.find((item) => item.slug === "grads");

    return data.map((item, index) =>
      normalizeImage(
        {
          id: item.id,
          title: item.caption || "Graduation portrait",
          alt: item.caption || "Bay Area graduation portrait by Chris Solorzano",
          image_url: item.image_url,
          category_id: graduation?.id ?? null,
          category_slug: graduation?.slug ?? "grads",
          featured: index < 9,
          sort_order: index + 1,
          created_at: item.created_at,
        },
        index,
        categories
      )
    );
  } catch (error) {
    console.error("Failed to load grad photo fallback", error);
    return FALLBACK_IMAGES;
  }
}

export async function getPortfolioImages(categories: PortfolioCategory[]) {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("portfolio_images")
      .select(PORTFOLIO_IMAGE_COLUMNS)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return getGradPhotoFallback(categories);
    }

    return data
      .map((item, index) => normalizeImage(item, index, categories))
      .filter((item) => item.image_url && categories.some((category) => category.slug === item.category_slug));
  } catch (error) {
    console.error("Failed to load portfolio images", error);
    return getGradPhotoFallback(categories);
  }
}

// Cached: every public page reads this on render; without the cache each
// visit to a dynamic route (e.g. /portfolio) paid two Supabase round-trips.
export const getPortfolioData = cachePublicContent(async () => {
  const categories = await getPortfolioCategories();
  const images = await getPortfolioImages(categories);

  return { categories, images };
}, ["portfolio-data"]);

// Reads the admin-editable primary nav from site_settings. Always returns a
// valid NavConfig — parseNavConfig falls back to DEFAULT_NAV_CONFIG on a missing
// row or malformed JSON, so ProNav can render before the admin ever saves.
export const getNavConfig = cachePublicContent(async (): Promise<NavConfig> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", NAV_CONFIG_SETTING_KEY)
      .maybeSingle();
    return data?.value ? parseNavConfig(data.value) : DEFAULT_NAV_CONFIG;
  } catch {
    return DEFAULT_NAV_CONFIG;
  }
}, ["nav-config"]);

export const getSiteSettings = cachePublicContent(async (): Promise<Record<string, string | null>> => {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.from("site_settings").select("key,value");
    if (!data) return {};
    return data.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {} as Record<string, string | null>);
  } catch {
    return {};
  }
}, ["site-settings"]);

// Lists posts for a category without the heavy `body` column — for the listing
// grid and sitemap, which only need metadata + cover images. /blog/[slug] uses
// getBlogPostBySlug, which still selects the full row including body.
export const getBlogPostSummaries = cachePublicContent(async (category: "professional" | "journal") => {
  try {
    const supabase = createSupabaseServerClient();
    // Try sites array column first (supports cross-posting)
    const { data, error } = await supabase
      .from("blog_posts")
      .select(BLOG_SUMMARY_COLUMNS)
      .contains("sites", [category])
      .order("published_at", { ascending: false });

    if (error) {
      // Fall back to legacy single-category column
      const fallback = await supabase
        .from("blog_posts")
        .select(BLOG_SUMMARY_COLUMNS)
        .eq("category", category)
        .order("published_at", { ascending: false });
      if (fallback.error && !isMissingColumnError(fallback.error)) {
        console.error(`Failed to load ${category} post summaries`, fallback.error);
      }
      return (fallback.data ?? []) as unknown as BlogPostSummary[];
    }

    return (data ?? []) as unknown as BlogPostSummary[];
  } catch (error) {
    console.error(`Failed to load ${category} post summaries`, error);
    return [];
  }
}, ["blog-post-summaries"]);

// Generalized version of getBlogPostSummaries for an arbitrary category tag
// (e.g. "family-photography"). Tries the `sites` array first (cross-posting),
// then falls back to the legacy single `category` column. Returns [] on error so
// category archive pages always render.
export const getBlogPostSummariesForCategory = cachePublicContent(async (category: string) => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select(BLOG_SUMMARY_COLUMNS)
      .contains("sites", [category])
      .order("published_at", { ascending: false });

    if (error) {
      const fallback = await supabase
        .from("blog_posts")
        .select(BLOG_SUMMARY_COLUMNS)
        .eq("category", category)
        .order("published_at", { ascending: false });
      if (fallback.error && !isMissingColumnError(fallback.error)) {
        console.error(`Failed to load ${category} post summaries`, fallback.error);
      }
      return (fallback.data ?? []) as unknown as BlogPostSummary[];
    }

    return (data ?? []) as unknown as BlogPostSummary[];
  } catch (error) {
    console.error(`Failed to load ${category} post summaries`, error);
    return [];
  }
}, ["blog-post-summaries-for-category"]);

export const getBlogPostBySlug = cachePublicContent(async (category: "professional" | "journal", slug: string) => {
  try {
    const supabase = createSupabaseServerClient();
    // Try sites array column first (supports cross-posting)
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .contains("sites", [category])
      .single();

    if (error) {
      // Fall back to legacy single-category column
      const fallback = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("category", category)
        .single();
      if (fallback.error && !isMissingColumnError(fallback.error)) {
        console.error(`Failed to load ${category} post ${slug}`, fallback.error);
      }
      return fallback.data ? (fallback.data as BlogPost) : null;
    }

    return data as BlogPost;
  } catch (error) {
    console.error(`Failed to load ${category} post ${slug}`, error);
    return null;
  }
}, ["blog-post-by-slug"]);
