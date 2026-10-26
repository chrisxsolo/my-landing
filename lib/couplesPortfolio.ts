// Server-side read model for the couples portfolio (/portfolio/couples and the
// couples guide). Photos come from portfolio_images (category "couples",
// published only) through the cached getPortfolioData(), in the order set in the
// admin Couples Portfolio tab (sort_order). The hero is the photo marked
// category_hero, falling back to the first Featured photo, then the first photo.

import { getPortfolioData, type PortfolioImage } from "@/lib/professionalData";
import { COUPLES_CATEGORY_SLUG } from "@/lib/couplesRoutes";

export {
  COUPLES_BOOKING_PATH,
  COUPLES_CATEGORY_SLUG,
  COUPLES_GUIDE_PATH,
  COUPLES_PORTFOLIO_PATH,
  COUPLES_PRICING_PATH,
} from "@/lib/couplesRoutes";

// Used when a photo has no recorded size (portrait 4:5 is the most common frame).
export const DEFAULT_PHOTO_RATIO = { width: 4, height: 5 };

export type CouplesPortfolioPhoto = {
  id: number;
  image_url: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  session_label: string | null;
};

export type CouplesPortfolio = {
  hero: CouplesPortfolioPhoto | null;
  photos: CouplesPortfolioPhoto[];
};

function toPhoto(image: PortfolioImage): CouplesPortfolioPhoto {
  const hasSize = Boolean(image.width && image.height);
  return {
    id: image.id,
    image_url: image.image_url,
    alt: image.alt,
    title: image.title,
    width: hasSize ? Number(image.width) : DEFAULT_PHOTO_RATIO.width,
    height: hasSize ? Number(image.height) : DEFAULT_PHOTO_RATIO.height,
    session_label: image.session_label ?? null,
  };
}

function byAdminOrder(a: PortfolioImage, b: PortfolioImage) {
  return a.sort_order - b.sort_order || a.id - b.id;
}

export async function getCouplesPortfolio(): Promise<CouplesPortfolio> {
  const { images } = await getPortfolioData();
  const couples = images
    .filter((image) => image.category_slug === COUPLES_CATEGORY_SLUG && image.image_url)
    .sort(byAdminOrder);
  const heroImage =
    couples.find((image) => image.category_hero) ??
    couples.find((image) => image.featured) ??
    couples[0] ??
    null;
  return {
    hero: heroImage ? toPhoto(heroImage) : null,
    photos: couples.map(toPhoto),
  };
}
