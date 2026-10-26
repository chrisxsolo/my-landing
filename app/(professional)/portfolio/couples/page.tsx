// ─────────────────────────────────────────────────────────────────────────────
// COUPLES PORTFOLIO  →  soloxsnaps.com/portfolio/couples
// ─────────────────────────────────────────────────────────────────────────────
// Photos: portfolio_images (category "couples", published) in the order set in
// Admin → Couples Portfolio, where the hero, order, sessions, and publishing are
// managed. Sections: hero → approach → gallery → locations → journal → proof → CTA.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import ContentEventBeacon from "@/app/components/ContentEventBeacon";
import CategoryProof from "@/app/(professional)/portfolio/_components/CategoryProof";
import portfolioStyles from "@/app/(professional)/portfolio/Portfolio.module.css";
import { C } from "@/lib/colors";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { getFeaturedTestimonialsForCategory } from "@/lib/testimonialsData";
import { getJournalPostsForCategory } from "@/lib/blog/categoryPosts";
import { COUPLES_JOURNAL_CATEGORY } from "@/lib/couplesGuide/journal";
import { getFeaturedCouplesLocations } from "@/lib/couplesGuide/featuredLocations";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import {
  COUPLES_BOOKING_PATH,
  COUPLES_GUIDE_PATH,
  COUPLES_PORTFOLIO_PATH,
  COUPLES_PRICING_PATH,
  getCouplesPortfolio,
} from "@/lib/couplesPortfolio";
import CouplesGallery from "./CouplesGallery";
import CouplesLocationCards from "./CouplesLocationCards";
import styles from "./CouplesPortfolio.module.css";

// ISR: refreshed hourly, or immediately when admin saves call /api/admin/revalidate.
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const TITLE = "Bay Area Couples Photographer | Couples Portfolio";
const DESCRIPTION =
  "Natural, playful couples photography across San Francisco and the Bay Area by Chris Solorzano — candid moments, movement-based posing, and golden-hour sessions from the Presidio to Shark Fin Cove.";

const STARTING_PRICE = Math.min(
  ...Object.values(PRICING_CATALOG.couples.packages).map((pkg) => pkg.price),
);

const APPROACH = [
  {
    title: "Candid, in-between moments",
    text: "Most of a gallery happens between the poses — the laugh after a bad joke, the glance you didn't know I caught.",
  },
  {
    title: "Movement over stiff posing",
    text: "Walking, spinning, chasing each other down the beach. Prompts keep you moving, so the photos feel alive instead of held.",
  },
  {
    title: "Bright, true-to-life color",
    text: "Clean, warm edits that look like the best version of the evening you actually had.",
  },
  {
    title: "Bay Area backdrops",
    text: "Tree-lined Presidio paths, garden columns, and coastal sea stacks — I help you choose the spot that fits the two of you.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const { hero } = await getCouplesPortfolio();
  const images = hero ? [{ url: hero.image_url, alt: hero.alt }] : undefined;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: COUPLES_PORTFOLIO_PATH },
    keywords: [
      "Bay Area couples photographer",
      "San Francisco couples photographer",
      "Bay Area couples photography",
      "couples photoshoot San Francisco",
      "romantic couples photography Bay Area",
    ],
    openGraph: {
      title: `${TITLE} | SoloXSnaps`,
      description: DESCRIPTION,
      url: COUPLES_PORTFOLIO_PATH,
      type: "website",
      siteName: "soloxsnaps",
      images,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: images?.map((i) => i.url) },
  };
}

function pageVars(): CSSProperties {
  return {
    "--cp-page": C.proPage,
    "--cp-ink": C.ink,
    "--cp-ink-soft": C.inkSoft,
    "--cp-muted": C.muted,
    "--cp-white": C.white,
    "--cp-white-22": C.white_22,
    "--cp-white-82": C.white_82,
    "--cp-accent": C.proAccent,
    "--cp-accent-dark": C.proAccentDark,
    "--cp-accent-soft": C.proAccentSoft,
    "--cp-accent-border": C.proAccentBorder,
    "--cp-border": C.proBorder,
    "--cp-shadow": C.proShadow,
    "--cp-film": C.proFilmEdge,
  } as CSSProperties;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function CouplesPortfolioPage() {
  const [{ hero, photos }, locations, posts, testimonials] = await Promise.all([
    getCouplesPortfolio(),
    getFeaturedCouplesLocations(),
    getJournalPostsForCategory(COUPLES_JOURNAL_CATEGORY),
    getFeaturedTestimonialsForCategory("couples", 3),
  ]);
  const stories = posts.slice(0, 3);

  const galleryLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Bay Area Couples Photography Portfolio",
    description: DESCRIPTION,
    url: `${SITE_URL}${COUPLES_PORTFOLIO_PATH}`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    mainEntity: {
      "@type": "ImageGallery",
      associatedMedia: photos.slice(0, 24).map((photo) => ({
        "@type": "ImageObject",
        contentUrl: photo.image_url,
        caption: photo.alt,
        creator: { "@type": "Person", name: "Chris Solorzano" },
      })),
    },
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Portfolio", path: "/portfolio" },
    { name: "Couples", path: COUPLES_PORTFOLIO_PATH },
  ]);

  return (
    <main className={styles.page} style={pageVars()}>
      <ContentEventBeacon contentType="portfolio" contentId="portfolio-couples" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(galleryLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <section className={portfolioStyles.portHero} aria-labelledby="couples-portfolio-title">
        {hero && (
          <div className={portfolioStyles.portHeroPhoto} aria-hidden="true">
            <OptimizedPhoto src={hero.image_url} alt="" sizes="100vw" priority quality={90} />
          </div>
        )}
        <div className={portfolioStyles.portHeroInner}>
          <p className={portfolioStyles.portEyebrow}>
            <Link href="/portfolio" style={{ color: "inherit" }}>Portfolio</Link> · Couples
          </p>
          <h1 id="couples-portfolio-title" className={styles.heroTitle}>Bay Area Couples Photography</h1>
          <p className={styles.heroText}>
            Capturing genuine connections, playful moments, and everything that makes your relationship uniquely yours.
          </p>
          <div className={styles.heroActions}>
            <Link href={COUPLES_BOOKING_PATH} className={styles.btnPrimary}>Book a Couples Session</Link>
            <Link href={COUPLES_GUIDE_PATH} className={styles.btnGhost}>Read the couples guide</Link>
          </div>
        </div>
      </section>

      <section className={styles.intro} aria-labelledby="couples-intro">
        <p className={styles.kicker}>How I photograph couples</p>
        <h2 id="couples-intro" className={styles.heading}>Photos that feel like the two of you</h2>
        <p className={styles.lead}>
          No modeling experience needed. I guide you the whole way with simple, playful prompts, then get out of the way
          for the real moments. Want to know how a session flows? The{" "}
          <Link href={COUPLES_GUIDE_PATH} className={styles.inlineLink}>Bay Area couples photography guide</Link>{" "}
          covers locations, outfits, timing, and posing.
        </p>
      </section>

      <section aria-labelledby="couples-gallery">
        <div className={styles.galleryMeta}>
          <h2 id="couples-gallery" className={styles.subheading}>Recent couples sessions</h2>
          <span className={styles.galleryCount}>{photos.length} photos · tap any photo to view full screen</span>
        </div>
        <div className={styles.galleryWrap}>
          <CouplesGallery photos={photos} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="couples-approach">
        <h2 id="couples-approach" className={styles.subheading} style={{ marginBottom: 18 }}>What to expect from a session</h2>
        <ul className={styles.approach}>
          {APPROACH.map((item) => (
            <li key={item.title} className={styles.approachItem}>
              <h3 className={styles.approachTitle}>{item.title}</h3>
              <p className={styles.approachText}>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <CouplesLocationCards locations={locations} />

      {stories.length > 0 && (
        <section className={styles.section} aria-labelledby="couples-stories">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>From the journal</p>
            <h2 id="couples-stories" className={styles.heading}>Couples session stories</h2>
          </div>
          <div className={styles.journal}>
            {stories.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className={styles.journalCard}>
                <span className={styles.journalTitle}>{post.title}</span>
                <span className={styles.journalMeta}>
                  {formatDate(post.published_at)}
                  {post.meta_description ? ` — ${post.meta_description}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <CategoryProof testimonials={testimonials} />

      <section className={styles.cta} aria-labelledby="couples-cta">
        <h2 id="couples-cta" className={styles.ctaHeading}>Ready to Capture Your Story Together?</h2>
        <p className={styles.ctaText}>
          Whether you&rsquo;re celebrating an anniversary, documenting a special moment, or simply want beautiful photos
          together, I&rsquo;d love to help bring your vision to life.
        </p>
        <div className={styles.ctaActions}>
          <Link href={COUPLES_BOOKING_PATH} className={styles.btnPrimary}>Book Your Couples Session</Link>
          <Link href={COUPLES_PRICING_PATH} className={styles.btnGhost}>See couples pricing</Link>
        </div>
        <p className={styles.ctaNote}>
          Couples sessions start at {formatCurrency(STARTING_PRICE)}.{" "}
          <Link href="/availability">Check available dates</Link>
        </p>
      </section>
    </main>
  );
}
