import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  getPhotoAlt,
  getPhotoTitle,
  normalizePortfolioCategorySlug,
} from "@/lib/photoMetadata";

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
    description: "Couples sessions, held quietly for a future portfolio section.",
    sort_order: 3,
    active: false,
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
      return FALLBACK_CATEGORIES.filter((category) => category.active);
    }

    const normalized = data
      .map((item, index) => normalizeCategory(item, index))
      .filter((category) => category.active && VISIBLE_PORTFOLIO_SLUGS.includes(category.slug));

    const merged = FALLBACK_CATEGORIES
      .filter((category) => category.active)
      .map((fallback) => normalized.find((category) => category.slug === fallback.slug) ?? fallback);

    return merged;
  } catch (error) {
    console.error("Failed to load portfolio categories", error);
    return FALLBACK_CATEGORIES.filter((category) => category.active);
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
      .select("*")
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

export async function getPortfolioData() {
  const categories = await getPortfolioCategories();
  const images = await getPortfolioImages(categories);

  return { categories, images };
}

export async function getSiteSettings(): Promise<Record<string, string | null>> {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.from("site_settings").select("key,value");
    if (!data) return {};
    return data.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {} as Record<string, string | null>);
  } catch {
    return {};
  }
}

export async function getBlogPostsByCategory(category: "professional" | "journal") {
  try {
    const supabase = createSupabaseServerClient();
    // Try sites array column first (supports cross-posting)
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .contains("sites", [category])
      .order("published_at", { ascending: false });

    if (error) {
      // Fall back to legacy single-category column
      const fallback = await supabase
        .from("blog_posts")
        .select("*")
        .eq("category", category)
        .order("published_at", { ascending: false });
      if (fallback.error && !isMissingColumnError(fallback.error)) {
        console.error(`Failed to load ${category} posts`, fallback.error);
      }
      return (fallback.data ?? []) as BlogPost[];
    }

    return (data ?? []) as BlogPost[];
  } catch (error) {
    console.error(`Failed to load ${category} posts`, error);
    return [];
  }
}

export async function getBlogPostBySlug(category: "professional" | "journal", slug: string) {
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
}
