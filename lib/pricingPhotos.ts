import { selectDistinctImageUrl } from "@/lib/photoMetadata";
import type { PortfolioImage } from "@/lib/professionalData";

type Settings = Record<string, string | null>;
type Photo = Pick<PortfolioImage, "category_slug" | "image_url" | "title" | "alt">;

export const PRICING_PHOTO_SIZES = {
  card: "(max-width: 860px) 100vw, 33vw",
  hero: "100vw",
  package: "(max-width: 940px) 90vw, 42vw",
  secondary: "(max-width: 940px) 90vw, 38vw",
} as const;

const GROUP_GRAD_IMAGE_URL =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/portfolio/1775960037598.jpeg";

export function getFamilyPricingPhotos(images: Photo[], settings: Settings) {
  const family = images.filter((image) => image.category_slug === "families");
  const sessionImage = settings.pricing_family_session_image || family[1]?.image_url || family[0]?.image_url || null;
  const extendedImage = settings.pricing_family_extended_image || family[2]?.image_url || family[0]?.image_url || null;
  return { sessionImage, extendedImage, heroImage: selectDistinctImageUrl(family, [sessionImage, extendedImage], sessionImage) };
}

export function getGradPricingPhotos(images: Photo[], settings: Settings) {
  const grads = images.filter((image) => image.category_slug === "grads");
  const packageImage = settings.pricing_grad_standard_image || grads[1]?.image_url || grads[0]?.image_url || null;
  const groupImage = settings.pricing_grad_group_image
    || grads.find((image) => image.image_url === GROUP_GRAD_IMAGE_URL)?.image_url
    || grads.find((image) => `${image.title} ${image.alt}`.toLowerCase().includes("group"))?.image_url
    || grads[6]?.image_url || packageImage;
  return { packageImage, groupImage, heroImage: selectDistinctImageUrl(grads, [packageImage, groupImage], packageImage) };
}

export function getCouplesPricingPhoto(images: Photo[], settings: Settings) {
  return settings.pricing_couples_standard_image
    || images.find((image) => image.category_slug === "couples")?.image_url
    || images[0]?.image_url || null;
}

// Elopement photos only. There is no elopement category in the library yet, so
// this deliberately returns null rather than borrowing from the portfolio at
// large: a graduation portrait on the elopement rates page misrepresents the
// service. The page renders its own treatment when a slot is null, and the two
// site_settings overrides are how real photographs get added later.
export function getElopementPricingPhotos(images: Photo[], settings: Settings) {
  const elopements = images.filter((image) => image.category_slug === "elopements");
  const packageImage = settings.pricing_elopement_package_image || elopements[1]?.image_url || elopements[0]?.image_url || null;
  const heroImage = settings.pricing_elopement_hero_image
    || (elopements.length ? selectDistinctImageUrl(elopements, [packageImage], packageImage) : null);
  return { packageImage, heroImage };
}

export function getEventPricingPhotos(images: Photo[], settings: Settings) {
  const events = images.filter((image) => image.category_slug === "events");
  const primaryImage = settings.pricing_event_primary_image || events[0]?.image_url || null;
  const secondaryImage = settings.pricing_event_secondary_image || events[1]?.image_url || primaryImage;
  return { primaryImage, secondaryImage };
}

export function getPricingCardPhotos(images: Photo[], settings: Settings): Record<string, string | null> {
  return {
    grads: images.find((image) => image.category_slug === "grads")?.image_url ?? null,
    families: settings.pricing_card_families_image
      ?? images.find((image) => image.category_slug === "families")?.image_url ?? null,
    couples: images.find((image) => image.category_slug === "couples")?.image_url
      ?? settings.pricing_couples_standard_image ?? null,
    elopements: getElopementPricingPhotos(images, settings).heroImage,
  };
}

export type PricingPhotoRequest = { src: string; sizes: string; quality: 85 | 90 };
export type PricingPhotoManifest = Record<string, PricingPhotoRequest[]>;

function photo(src: string | null, sizes: string, quality: 85 | 90 = 85): PricingPhotoRequest[] {
  return src ? [{ src, sizes, quality }] : [];
}

// Use the same selection, responsive sizes, and quality as the displayed photos
// so a warmed image is reusable instead of downloading a second variant on click.
export function getPricingPhotoManifest(images: Photo[], settings: Settings): PricingPhotoManifest {
  const sizes = PRICING_PHOTO_SIZES;
  const family = getFamilyPricingPhotos(images, settings);
  const grads = getGradPricingPhotos(images, settings);
  const events = getEventPricingPhotos(images, settings);
  const elopements = getElopementPricingPhotos(images, settings);
  return {
    "/pricing": Object.values(getPricingCardPhotos(images, settings)).flatMap((src) => photo(src, sizes.card)),
    "/pricing/families": [
      ...photo(family.heroImage, sizes.hero, 90),
      ...photo(family.sessionImage, sizes.package), ...photo(family.extendedImage, sizes.secondary),
    ],
    "/pricing/grads": [
      ...photo(grads.heroImage, sizes.hero, 90),
      ...photo(grads.packageImage, sizes.package), ...photo(grads.groupImage, sizes.secondary),
    ],
    "/pricing/couples": photo(getCouplesPricingPhoto(images, settings), sizes.hero, 90),
    "/pricing/elopements": [
      ...photo(elopements.heroImage, sizes.hero, 90),
      ...photo(elopements.packageImage, sizes.package),
    ],
    "/pricing/events": [
      ...photo(events.primaryImage, sizes.hero, 90),
      ...photo(events.primaryImage, sizes.package), ...photo(events.secondaryImage, sizes.secondary),
    ],
  };
}
