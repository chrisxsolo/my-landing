import type { BlogPostSummary, PortfolioImage } from "@/lib/professionalData";

type HomepageImage = Pick<PortfolioImage, "id" | "image_url" | "alt" | "category_slug">;

export type FeaturedSession = {
  title: string;
  location: string;
  description: string;
  href: string;
  imageUrl: string;
  imageAlt: string;
};

const SCHOOL_FALLBACKS = [
  {
    title: "UC Berkeley Graduation Session",
    location: "Berkeley, California",
    description: "Sather Gate, the Campanile, and Memorial Glade in one guided campus route.",
    href: "/grads/uc-berkeley",
  },
  {
    title: "San Jose State Graduation Session",
    location: "San Jose, California",
    description: "A complete session built around Tower Hall, the quad, and downtown campus light.",
    href: "/grads/sjsu",
  },
  {
    title: "San Francisco State Graduation Session",
    location: "San Francisco, California",
    description: "Campus portraits with the option to add a nearby San Francisco location.",
    href: "/grads/sf-state",
  },
  {
    title: "University of San Francisco Graduation Session",
    location: "San Francisco, California",
    description: "St. Ignatius, Lone Mountain, and clean architectural portraits across campus.",
    href: "/grads/usf",
  },
] as const;

const DEFAULT_ALT = {
  grads: "Bay Area graduation portrait by Chris Solorzano",
  couples: "Bay Area couples portrait by Chris Solorzano",
  families: "Bay Area family portrait by Chris Solorzano",
  any: "Bay Area portrait by Chris Solorzano",
} as const;

const ABOUT_PORTRAIT_ALT =
  "San Francisco photographer Chris Solorzano in a natural outdoor setting";

// Every resolved image slot the redesigned homepage renders. Components receive
// these directly instead of re-deriving images from the raw portfolio.
export type HomepageImages = {
  heroPrimary: HomepageImage;
  heroSecondary: HomepageImage;
  cardGrads: HomepageImage;
  cardCouples: HomepageImage;
  cardPortrait: HomepageImage;
  storyImages: HomepageImage[];
  couplesGallery: HomepageImage[];
  finalCta: HomepageImage;
  aboutPortrait: { image_url: string; alt: string };
};

function dedupeByUrl(images: HomepageImage[]): HomepageImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (!image.image_url || seen.has(image.image_url)) return false;
    seen.add(image.image_url);
    return true;
  });
}

// Resolves every homepage image slot from admin-editable site_settings, falling
// back to the matching legacy cover key and then to an auto-picked portfolio
// image, so unset slots keep the current behavior. Synthetic ids are negative to
// avoid colliding with real portfolio_images ids used as React keys.
export function resolveHomepageImages(
  settings: Record<string, string | null>,
  images: HomepageImage[],
  aboutPortraitFallback: string,
): HomepageImages {
  let nextId = -1;
  const id = () => nextId--;
  const make = (url: string, alt: string, categorySlug: string): HomepageImage => ({
    id: id(),
    image_url: url,
    alt,
    category_slug: categorySlug,
  });

  const all = images.filter((image) => image.image_url);
  const pool = (slug: string) => all.filter((image) => image.category_slug === slug);
  const grads = pool("grads");
  const couples = pool("couples");
  const families = pool("families");
  const fallback = grads[0] ?? all[0] ?? make(aboutPortraitFallback, DEFAULT_ALT.any, "");

  // First populated setting key wins; otherwise the first pool image; otherwise
  // the global fallback so a slot is never empty.
  const slot = (keys: string[], categoryPool: HomepageImage[], alt: string, slug: string) => {
    for (const key of keys) {
      const url = settings[key];
      if (url) return make(url, alt, slug);
    }
    return categoryPool[0] ?? fallback;
  };

  // Each override fills its own position; remaining positions draw from the auto
  // pool, skipping URLs already placed in the group so photos don't repeat.
  const group = (keys: string[], autoPool: HomepageImage[], alt: string, slug: string) => {
    const used = new Set<string>();
    const placed = keys.map((key) => {
      const url = settings[key];
      if (!url) return null;
      used.add(url);
      return make(url, alt, slug);
    });
    let cursor = 0;
    return placed
      .map((entry) => {
        if (entry) return entry;
        while (cursor < autoPool.length && used.has(autoPool[cursor].image_url)) cursor++;
        const pick = autoPool[cursor++];
        if (pick) used.add(pick.image_url);
        return pick ?? null;
      })
      .filter((entry): entry is HomepageImage => entry !== null);
  };

  const heroPrimary = slot(["home_hero_primary", "home_cover_grads"], grads, DEFAULT_ALT.grads, "grads");
  const heroSecondary = slot(["home_hero_secondary", "pricing_couples_standard_image"], couples, DEFAULT_ALT.couples, "couples");
  const cardGrads = slot(["home_card_grads", "home_cover_grads"], grads, DEFAULT_ALT.grads, "grads");
  const cardCouples = slot(["home_card_couples", "pricing_couples_standard_image"], couples, DEFAULT_ALT.couples, "couples");
  const cardPortrait = slot(["home_card_portrait", "home_cover_families"], families, DEFAULT_ALT.families, "families");

  const storyPool = dedupeByUrl([cardGrads, ...grads, cardCouples, ...couples, cardPortrait, ...families, ...all]);
  const storyImages = group(
    ["home_story_1", "home_story_2", "home_story_3", "home_story_4", "home_story_5", "home_story_6"],
    storyPool,
    DEFAULT_ALT.any,
    "",
  );

  const couplesGallery = group(
    ["home_couples_1", "home_couples_2", "home_couples_3"],
    dedupeByUrl([...couples, ...all]),
    DEFAULT_ALT.couples,
    "couples",
  );

  const finalCta = settings.home_final_cta
    ? make(settings.home_final_cta, DEFAULT_ALT.any, "")
    : storyPool.find((image) => image.image_url !== heroPrimary.image_url) ?? heroPrimary;

  const aboutPortrait = {
    image_url: settings.home_about_portrait || aboutPortraitFallback,
    alt: ABOUT_PORTRAIT_ALT,
  };

  return {
    heroPrimary,
    heroSecondary,
    cardGrads,
    cardCouples,
    cardPortrait,
    storyImages,
    couplesGallery,
    finalCta,
    aboutPortrait,
  };
}

export function pickDistinctCategoryImages(
  images: HomepageImage[],
  categorySlug: string,
  count: number,
) {
  const prioritized = [
    ...images.filter((image) => image.category_slug === categorySlug),
    ...images.filter((image) => image.category_slug !== categorySlug),
  ];
  const seen = new Set<string>();

  return prioritized.filter((image) => {
    if (!image.image_url || seen.has(image.image_url)) return false;
    seen.add(image.image_url);
    return true;
  }).slice(0, count);
}

export function buildFeaturedSessions(
  posts: BlogPostSummary[],
  images: HomepageImage[],
  count = 3,
): FeaturedSession[] {
  const availableImages = pickDistinctCategoryImages(images, "grads", count + SCHOOL_FALLBACKS.length);
  const published = posts
    .filter((post) => post.slug && post.title)
    .slice(0, count)
    .map((post, index) => ({
      title: post.title,
      location: "Bay Area",
      description: post.meta_description ?? "See the complete session from wide portraits to the final close-ups.",
      href: `/blog/${post.slug}`,
      imageUrl: post.cover_image_url ?? availableImages[index]?.image_url ?? "",
      imageAlt: post.cover_image_alt ?? availableImages[index]?.alt ?? post.title,
    }))
    .filter((session) => session.imageUrl);

  const usedHrefs = new Set(published.map((session) => session.href));
  const usedImages = new Set(published.map((session) => session.imageUrl));
  const fallbackImages = availableImages.filter((image) => !usedImages.has(image.image_url));
  const fallbacks = SCHOOL_FALLBACKS
    .filter((session) => !usedHrefs.has(session.href))
    .map((session, index) => ({
      ...session,
      imageUrl: fallbackImages[index]?.image_url ?? availableImages[index]?.image_url ?? "",
      imageAlt: fallbackImages[index]?.alt ?? `${session.title} by SoloXSnaps`,
    }))
    .filter((session) => session.imageUrl);

  return [...published, ...fallbacks].slice(0, count);
}
