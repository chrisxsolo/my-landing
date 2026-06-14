// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO PAGE  →  soloxsnaps.com/portfolio
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero        — full-bleed photo background, big bold title, frosted filter tabs
//   2. Intro band  — "what to expect" framing for the current category
//   3. Highlights  — CURATED grid (capped at CURATED_LIMIT, featured-first)
//   4. School links— grads only: links to per-campus landing pages
//   5. Proof       — client testimonials matched to the current category
//   6. CTA pair    — Check availability + category-aware pricing
//
// CURATION:
//   The grid is intentionally capped (see CURATED_LIMIT). Photos arrive
//   featured-first then by sort_order, so promote your best work via the
//   "Featured" checkbox in the admin Portfolio tab to surface it here.
//
// HOW IMAGES WORK:
//   All photos come from Supabase → Table: "portfolio_images"
//   Category filter tabs come from Supabase → Table: "portfolio_categories"
//   The hero background auto-matches the selected category's first image.
//
// STYLES: Portfolio.module.css (next to this file).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData } from "@/lib/professionalData";
import {
  getFeaturedTestimonials,
  getFeaturedTestimonialsForCategory,
  type FeaturedTestimonial,
} from "@/lib/testimonialsData";
import { getPortfolioCategoryContent } from "@/lib/portfolioCategoryContent";
import { getPortfolioCaseStudies } from "@/lib/portfolioCaseStudies";
import CategoryProof from "@/app/(professional)/portfolio/_components/CategoryProof";
import PortfolioSchoolLinks from "@/app/(professional)/portfolio/_components/PortfolioSchoolLinks";
import PortfolioSchoolFilter from "@/app/(professional)/portfolio/_components/PortfolioSchoolFilter";
import CaseStudies from "@/app/(professional)/portfolio/_components/CaseStudies";
import PortfolioCtaPair from "@/app/(professional)/portfolio/_components/PortfolioCtaPair";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";
import ContentEventBeacon from "@/app/components/ContentEventBeacon";

export const dynamic = "force-dynamic";

// Max photos shown per view — keeps the page to curated proof, not a 100-image
// wall. The audit's target is "your best 24–36"; 30 sits in the middle.
const CURATED_LIMIT = 30;

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Portfolio of Bay Area graduation and couples photography by Chris Solorzano, with family and portrait sessions also featured.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Portfolio | soloxsnaps",
    description: "Bay Area graduation and couples photography by Chris Solorzano.",
    type: "website",
  },
};

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; school?: string }>;
}) {
  // ── DATA FETCHING ───────────────────────────────────────────────────────────
  // categories → the filter tabs (All, Grads, Families, etc.) from Supabase
  // images     → all portfolio photos from Supabase (featured-first, sort_order)
  const { categories, images } = await getPortfolioData();
  const params = await searchParams;
  const requestedCategory = params.category;
  const selected = categories.find((category) => category.slug === requestedCategory);
  if (requestedCategory && !selected) redirect("/portfolio");
  const selectedCategory = selected?.slug;

  // Grad school sub-filter — only meaningful on the grads view. Slugs that
  // actually have tagged photos drive the chip row; an unknown ?school is ignored.
  const isGrads = selectedCategory === "grads";
  const availableSchoolSlugs = isGrads
    ? Array.from(
        new Set(images.filter((img) => img.category_slug === "grads" && img.school).map((img) => img.school as string)),
      )
    : [];
  const activeSchool =
    isGrads && params.school && availableSchoolSlugs.includes(params.school) ? params.school : undefined;

  // ── CURATION ──────────────────────────────────────────────────────────────
  // Selected category: cap that category to CURATED_LIMIT (after any school filter).
  // "All" view: take an even share from each visible category so both grads and
  // families are represented, then cap the combined set at CURATED_LIMIT.
  let categoryImages = selectedCategory
    ? images.filter((img) => img.category_slug === selectedCategory)
    : images;
  if (activeSchool) categoryImages = categoryImages.filter((img) => img.school === activeSchool);
  const totalInView = categoryImages.length;

  let displayImages = categoryImages.slice(0, CURATED_LIMIT);
  if (!selectedCategory) {
    const perCategory = Math.max(1, Math.ceil(CURATED_LIMIT / Math.max(categories.length, 1)));
    displayImages = categories
      .flatMap((cat) => images.filter((img) => img.category_slug === cat.slug).slice(0, perCategory))
      .slice(0, CURATED_LIMIT);
  }

  // Hero background = first image of the curated set — auto-matches category.
  const heroImage = displayImages[0] ?? null;
  const heroBg = heroImage?.image_url ?? null;

  // ── COPY + PROOF + CASE STUDIES ───────────────────────────────────────────
  const content = getPortfolioCategoryContent(selectedCategory);
  const testimonials: FeaturedTestimonial[] = selectedCategory
    ? await getFeaturedTestimonialsForCategory(selectedCategory, 3)
    : await getFeaturedTestimonials(3);
  const caseStudies = await getPortfolioCaseStudies(selectedCategory);

  return (
    <main className={styles.portfolioPage}>
      <ContentEventBeacon contentType="portfolio" contentId="portfolio" />

      {/* ── HERO ──────────────────────────────────────────────────────────────
           Full-bleed photo background with dark gradient overlay.
           heroBg is the first photo from the curated set — auto-matches category. */}
      <section className={styles.portHero} aria-labelledby="portfolio-title">
        {heroBg && heroImage && (
          <div className={styles.portHeroPhoto} aria-hidden="true">
            <OptimizedPhoto src={heroBg} alt="" sizes="100vw" priority quality={90} />
          </div>
        )}
        <div className={styles.portHeroInner}>
          {/* Small eyebrow label — change text here */}
          <p className={styles.portEyebrow}>Portfolio</p>

          {/* Big bold category title — "Grads", "Families", or "Selected Work" */}
          <h1 id="portfolio-title" className={styles.portTitle}>
            {selected?.name ?? "Selected Work"}
          </h1>

          {/* Category description — comes from Supabase portfolio_categories.description */}
          <p className={styles.portDescription}>
            {selected?.description ?? "Graduation, couples, and family sessions across the Bay Area."}
          </p>

          <div className={styles.portMetaRow}>
            {/* Honest curation badge — e.g. "Curated · 30 of 78" */}
            <span className={styles.portCountBadge}>
              {displayImages.length < totalInView
                ? `Curated · ${displayImages.length} of ${totalInView}`
                : `${displayImages.length} ${displayImages.length === 1 ? "photo" : "photos"}`}
            </span>

            {/* Filter tabs — frosted glass pills. Active tab = white fill.
                 Links update the URL: /portfolio?category=grads etc. */}
            <nav className={styles.portFilterRow} aria-label="Portfolio filters">
              <Link
                href="/portfolio"
                className={styles.portFilterLink}
                aria-current={!selectedCategory ? "page" : undefined}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/portfolio?category=${cat.slug}`}
                  className={styles.portFilterLink}
                  aria-current={selectedCategory === cat.slug ? "page" : undefined}
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>

      {/* ── INTRO BAND ────────────────────────────────────────────────────────
           Honest, generic "what to expect" framing for the current category. */}
      <section className={styles.portIntro} aria-label="What to expect">
        <div className={styles.portIntroInner}>
          <div className={styles.portIntroLead}>
            <p className={styles.portIntroEyebrow}>{content.eyebrow}</p>
            <h2 className={styles.portIntroHeading}>{content.heading}</h2>
            <p className={styles.portIntroBody}>{content.body}</p>
          </div>
          <dl className={styles.portIntroDetails}>
            {content.details.map((detail) => (
              <div key={detail.label} className={styles.portIntroDetail}>
                <dt className={styles.portIntroDetailLabel}>{detail.label}</dt>
                <dd className={styles.portIntroDetailValue}>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── GRAD SCHOOL FILTER ────────────────────────────────────────────────
           Filters the wall by campus. Renders nothing until photos are tagged. */}
      {isGrads && (
        <PortfolioSchoolFilter availableSlugs={availableSchoolSlugs} activeSchool={activeSchool} />
      )}

      {/* ── CURATED HIGHLIGHTS GRID ─────────────────────────────────────────
           4-column grid (2-col on mobile), aspect-ratio 4:5, staggered entrance. */}
      <section className={styles.portGallery} aria-label={`${selected?.name ?? "Selected work"} photos`}>
        {displayImages.length > 0 ? (
          <div className={styles.portImageWall}>
            {displayImages.map((image) => (
              <figure key={image.id} className={styles.portFigure} data-category={image.category_slug}>
                <OptimizedPhoto
                  src={image.image_url}
                  alt={image.alt}
                  className={styles.portImg}
                  sizes="(max-width: 760px) 50vw, (max-width: 980px) 33vw, 25vw"
                  quality={75}
                />
              </figure>
            ))}
          </div>
        ) : (
          <div className={styles.portEmpty}>No photos in this category yet.</div>
        )}
      </section>

      {/* ── CASE STUDIES (renders nothing when none are active) ────────────── */}
      <CaseStudies
        studies={caseStudies}
        pricingHref={content.pricingHref}
        pricingLabel={content.pricingLabel}
      />

      {/* ── GRAD SCHOOL LINKS (grads only) ─────────────────────────────────── */}
      {selectedCategory === "grads" && <PortfolioSchoolLinks />}

      {/* ── CLIENT PROOF (renders nothing when none match) ─────────────────── */}
      <CategoryProof testimonials={testimonials} />

      {/* ── CTA PAIR ──────────────────────────────────────────────────────── */}
      <PortfolioCtaPair pricingHref={content.pricingHref} pricingLabel={content.pricingLabel} />
    </main>
  );
}
