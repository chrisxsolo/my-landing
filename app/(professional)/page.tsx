import type { CSSProperties } from "react";
import type { Metadata } from "next";
import HomeAboutExperience from "@/app/components/HomeAboutExperience";
import HomeFeaturedWork from "@/app/components/HomeFeaturedWork";
import HomeFinalCTA from "@/app/components/HomeFinalCTA";
import HomeHero from "@/app/components/HomeHero";
import HomeServices from "@/app/components/HomeServices";
import HomeTestimonials from "@/app/components/HomeTestimonials";
import { C } from "@/lib/colors";
import {
  FEATURED_SESSION_SETTING_KEYS,
  buildFeaturedSessions,
  resolveHomepageImages,
} from "@/lib/homepageData";
import { getJournalServicesByPostId } from "@/lib/blog/journalServices";
import { resolvePostCategories } from "@/lib/blog/postCategories";
import {
  getBlogPostSummaries,
  getPortfolioData,
  getSiteSettings,
} from "@/lib/professionalData";
import { getFeaturedTestimonials, pickBalancedTestimonials } from "@/lib/testimonialsData";
import styles from "@/app/(professional)/home.module.css";
import pageStyles from "@/app/(professional)/HomePage.module.css";

export const revalidate = 3600;

// Short enough to show in full in search results (~60 chars with the suffix);
// the H1 carries the full "San Francisco & Bay Area" phrasing.
const PAGE_TITLE = "San Francisco Graduation & Couples Photographer";
const SOCIAL_TITLE = `${PAGE_TITLE} | SoloXSnaps`;
const description =
  "Graduation and couples photographer in San Francisco and the Bay Area, plus family and maternity sessions. Guided posing and transparent pricing.";
const CHRIS_PORTRAIT = "/images/about/chris-solorzano-photographer.webp";
const HOME_ABOUT_PORTRAIT = "/images/about/chris-solorzano-sunset-beach.webp";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "Bay Area graduation photographer",
    "Bay Area couples photographer",
    "San Francisco graduation photographer",
    "San Francisco couples photographer",
    "San Francisco photographer",
    "graduation photography Bay Area",
    "Chris Solorzano photographer",
  ],
  openGraph: {
    title: SOCIAL_TITLE,
    description,
    type: "website",
    siteName: "SoloXSnaps",
    images: [{ url: CHRIS_PORTRAIT, alt: "San Francisco photographer Chris Solorzano" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description,
    images: [CHRIS_PORTRAIT],
  },
};

const COLOR_VARS = {
  "--home-ink": C.ink,
  "--home-muted": C.muted,
  "--home-dim": C.mutedSoft,
  "--home-page": C.proPage,
  "--home-paper": C.white,
  "--home-surface": C.proAccentSoft,
  "--home-accent": C.proAccent,
  "--home-accent-dark": C.proAccentDark,
  "--home-accent-soft": C.proAccentSoft,
  "--home-border": C.proBorder,
  "--home-shadow": C.proShadow,
  "--home-film": C.proFilmEdge,
  "--home-shadow-lg": C.shadowWarmLg,
} as CSSProperties;

async function getHomepageTestimonials() {
  try {
    return await getFeaturedTestimonials(12);
  } catch (error) {
    console.error("Failed to load featured homepage testimonials", error);
    return [];
  }
}

export default async function ProfessionalHomePage() {
  const [{ images }, settings, posts, featuredTestimonials, servicesByPostId] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
    getBlogPostSummaries("professional"),
    getHomepageTestimonials(),
    getJournalServicesByPostId(),
  ]);
  const home = resolveHomepageImages(settings, images, HOME_ABOUT_PORTRAIT);
  const featuredSessions = buildFeaturedSessions(posts, images, 2, {
    categorize: (post) =>
      resolvePostCategories(post, servicesByPostId[String(post.id)] ?? null).map((category) => category.slug),
    pinnedSlugs: {
      grads: settings[FEATURED_SESSION_SETTING_KEYS.grads],
      couples: settings[FEATURED_SESSION_SETTING_KEYS.couples],
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "SoloXSnaps Photography",
    url: "https://www.soloxsnaps.com",
    image: home.heroPrimary.image_url,
    founder: { "@type": "Person", name: "Chris Solorzano" },
    areaServed: ["San Francisco", "Bay Area", "San Jose", "Oakland", "Berkeley"],
    serviceType: [
      "Graduation photography",
      "Couples photography",
      "Family photography",
      "Maternity photography",
      "Portrait photography",
    ],
    sameAs: ["https://www.instagram.com/soloxsnaps"],
  };

  return (
    <main className={`${styles.page} ${pageStyles.fullBleed}`} style={COLOR_VARS}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <HomeHero slides={home.heroSlides} />
      <HomeServices
        cardGrads={home.cardGrads}
        cardCouples={home.cardCouples}
        cardPortrait={home.cardPortrait}
      />
      <HomeFeaturedWork images={home.storyImages} featuredSessions={featuredSessions} />
      <HomeAboutExperience aboutPortrait={home.aboutPortrait} />
      <HomeTestimonials testimonials={pickBalancedTestimonials(featuredTestimonials, 3)} />
      <HomeFinalCTA image={home.finalCta} />
    </main>
  );
}
