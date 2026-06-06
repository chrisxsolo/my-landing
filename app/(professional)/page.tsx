import type { CSSProperties } from "react";
import type { Metadata } from "next";
import HomeConversionSections from "@/app/components/HomeConversionSections";
import HomeFinalCTA from "@/app/components/HomeFinalCTA";
import HomeHero from "@/app/components/HomeHero";
import HomepageFAQ from "@/app/components/HomepageFAQ";
import HomeStorySections from "@/app/components/HomeStorySections";
import Testimonials from "@/app/components/Testimonials";
import { FAQS } from "@/app/(professional)/faq/faqData";
import { C } from "@/lib/colors";
import { buildFeaturedSessions, resolveHomepageImages } from "@/lib/homepageData";
import {
  getBlogPostSummaries,
  getPortfolioData,
  getSiteSettings,
} from "@/lib/professionalData";
import { getApprovedTestimonials } from "@/lib/testimonialsData";
import styles from "@/app/(professional)/home.module.css";

export const revalidate = 3600;

const title = "Bay Area Graduation & Couples Photographer | SoloXSnaps";
const description =
  "SoloXSnaps provides graduation, couples, and portrait photography throughout San Francisco and the Bay Area with clear posing guidance, transparent pricing, and private online galleries.";
const CHRIS_PORTRAIT = "/images/about/chris-solorzano-photographer.webp";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "Bay Area graduation photographer",
    "Bay Area couples photographer",
    "San Francisco photographer",
    "graduation photography Bay Area",
    "Chris Solorzano photographer",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "SoloXSnaps",
    images: [{ url: CHRIS_PORTRAIT, alt: "San Francisco photographer Chris Solorzano" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [CHRIS_PORTRAIT] },
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
  "--home-shadow-lg": C.shadowWarmLg,
} as CSSProperties;

function getHomepageFaqItems() {
  const allItems = FAQS.flatMap((group) => group.items);
  const questions = [
    "I'm not photogenic / I hate being on camera. Will that be a problem?",
    "How do I book a session?",
    "What if the weather is bad?",
    "How long until I receive my photos?",
    "Can extended family or extra people join?",
  ];
  return questions.flatMap((question) => allItems.filter((item) => item.q === question));
}

async function getHomepageTestimonials() {
  try {
    return await getApprovedTestimonials(3);
  } catch (error) {
    console.error("Failed to load approved homepage testimonials", error);
    return [];
  }
}

export default async function ProfessionalHomePage() {
  const [{ images }, settings, posts, approvedTestimonials] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
    getBlogPostSummaries("professional"),
    getHomepageTestimonials(),
  ]);
  const home = resolveHomepageImages(settings, images, CHRIS_PORTRAIT);
  const featuredSessions = buildFeaturedSessions(posts, images, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "SoloXSnaps Photography",
    url: "https://www.soloxsnaps.com",
    image: home.heroPrimary.image_url,
    founder: { "@type": "Person", name: "Chris Solorzano" },
    areaServed: ["San Francisco", "Bay Area", "San Jose", "Oakland", "Berkeley"],
    serviceType: ["Graduation photography", "Couples photography", "Portrait photography"],
    sameAs: ["https://www.instagram.com/soloxsnaps"],
  };

  return (
    <main className={styles.page} style={COLOR_VARS}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <HomeHero primaryImage={home.heroPrimary} secondaryImage={home.heroSecondary} />
      <HomeStorySections
        cardGrads={home.cardGrads}
        cardCouples={home.cardCouples}
        cardPortrait={home.cardPortrait}
        storyImages={home.storyImages}
        featuredSessions={featuredSessions}
      />
      <HomeConversionSections couplesGallery={home.couplesGallery} aboutPortrait={home.aboutPortrait} />
      <HomepageFAQ items={getHomepageFaqItems()} />
      <Testimonials
        title="Real people, clearly guided from the first frame."
        items={approvedTestimonials.map((testimonial) => ({
          quote: testimonial.message,
          name: testimonial.display_name,
          context: testimonial.session_type ?? "SoloXSnaps session",
        }))}
      />
      <HomeFinalCTA image={home.finalCta} />
    </main>
  );
}
