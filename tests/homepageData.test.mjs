import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFeaturedSessions,
  pickDistinctCategoryImages,
  resolveHomepageImages,
} from "../lib/homepageData.ts";

const IMAGES = [
  { id: 1, image_url: "grad-a.jpg", alt: "Grad A", category_slug: "grads", hero_carousel: false },
  { id: 2, image_url: "grad-b.jpg", alt: "Grad B", category_slug: "grads", hero_carousel: false },
  { id: 3, image_url: "couple-a.jpg", alt: "Couple A", category_slug: "couples", hero_carousel: false },
  { id: 4, image_url: "family-a.jpg", alt: "Family A", category_slug: "families", hero_carousel: false },
];

const FALLBACK_PORTRAIT = "/images/about/chris.webp";

test("pickDistinctCategoryImages prioritizes a category and never repeats a URL", () => {
  const selected = pickDistinctCategoryImages(IMAGES, "grads", 3);

  assert.deepEqual(
    selected.map((image) => image.image_url),
    ["grad-a.jpg", "grad-b.jpg", "couple-a.jpg"],
  );
});

test("buildFeaturedSessions uses published posts before working school fallbacks", () => {
  const posts = [
    {
      title: "UC Berkeley Graduation Portrait Session",
      slug: "berkeley-grad-session",
      cover_image_url: "berkeley.jpg",
      cover_image_alt: "UC Berkeley graduate",
      meta_description: "A complete graduation session at UC Berkeley.",
    },
  ];

  const sessions = buildFeaturedSessions(posts, IMAGES, 3);

  assert.equal(sessions.length, 3);
  assert.equal(sessions[0].href, "/blog/berkeley-grad-session");
  assert.equal(sessions[0].imageUrl, "berkeley.jpg");
  assert.ok(sessions.slice(1).every((session) => session.href.startsWith("/grads/")));
  assert.equal(new Set(sessions.map((session) => session.href)).size, 3);
});

test("resolveHomepageImages auto-picks by category when no settings are set", () => {
  const home = resolveHomepageImages({}, IMAGES, FALLBACK_PORTRAIT);

  assert.equal(home.heroPrimary.image_url, "grad-a.jpg");
  assert.equal(home.heroSecondary.image_url, "couple-a.jpg");
  assert.equal(home.cardGrads.image_url, "grad-a.jpg");
  assert.equal(home.cardCouples.image_url, "couple-a.jpg");
  assert.equal(home.cardPortrait.image_url, "family-a.jpg");
  assert.equal(home.aboutPortrait.image_url, FALLBACK_PORTRAIT);
});

test("hero slides open with curated graduation work and balance service categories", () => {
  const images = [
    { id: 1, image_url: "grad-1.jpg", alt: "Grad 1", category_slug: "grads", hero_carousel: true },
    { id: 2, image_url: "grad-2.jpg", alt: "Grad 2", category_slug: "grads", hero_carousel: true },
    { id: 3, image_url: "grad-3.jpg", alt: "Grad 3", category_slug: "grads", hero_carousel: true },
    { id: 4, image_url: "couple-1.jpg", alt: "Couple 1", category_slug: "couples", hero_carousel: false },
    { id: 5, image_url: "couple-2.jpg", alt: "Couple 2", category_slug: "couples", hero_carousel: false },
    { id: 6, image_url: "family-1.jpg", alt: "Family 1", category_slug: "families", hero_carousel: false },
  ];
  const home = resolveHomepageImages(
    { home_hero_primary: "legacy-family-frame.jpg" },
    images,
    FALLBACK_PORTRAIT,
  );

  assert.deepEqual(
    home.heroSlides.map((image) => image.category_slug),
    ["grads", "couples", "grads", "families", "couples", "grads"],
  );
  assert.equal(home.heroSlides[0].image_url, "grad-1.jpg");
});

test("resolveHomepageImages prefers explicit settings, then legacy keys", () => {
  const home = resolveHomepageImages(
    {
      home_hero_primary: "custom-hero.jpg",
      home_card_portrait: "custom-portrait.jpg",
      home_cover_grads: "legacy-grad.jpg", // legacy fallback for the grad card
      home_about_portrait: "custom-chris.jpg",
    },
    IMAGES,
    FALLBACK_PORTRAIT,
  );

  assert.equal(home.heroPrimary.image_url, "custom-hero.jpg");
  assert.equal(home.cardGrads.image_url, "legacy-grad.jpg");
  assert.equal(home.cardPortrait.image_url, "custom-portrait.jpg");
  assert.equal(home.aboutPortrait.image_url, "custom-chris.jpg");
});

test("resolveHomepageImages fills group overrides and avoids repeating URLs", () => {
  const home = resolveHomepageImages(
    { home_couples_1: "pinned-couple.jpg" },
    IMAGES,
    FALLBACK_PORTRAIT,
  );

  assert.equal(home.couplesGallery[0].image_url, "pinned-couple.jpg");
  // Remaining auto-filled slots must not repeat the pinned override.
  assert.ok(home.couplesGallery.slice(1).every((image) => image.image_url !== "pinned-couple.jpg"));
  assert.equal(new Set(home.couplesGallery.map((image) => image.image_url)).size, home.couplesGallery.length);
});

test("resolveHomepageImages never throws on an empty portfolio", () => {
  const home = resolveHomepageImages({}, [], FALLBACK_PORTRAIT);

  assert.equal(home.heroPrimary.image_url, FALLBACK_PORTRAIT);
  assert.ok(home.storyImages.length <= 1); // only the global portrait fallback, at most
  assert.equal(home.couplesGallery.length, 0);
  assert.equal(home.aboutPortrait.image_url, FALLBACK_PORTRAIT);
});
