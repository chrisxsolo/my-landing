// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO PAGE  →  soloxsnaps.com/portfolio
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero     — full-bleed photo background, big bold title, frosted filter tabs
//   2. Gallery  — 4-column image grid with staggered entrance animations
//   3. CTA      — dark bottom panel "Like what you see?"
//
// HOW IMAGES WORK:
//   All photos come from Supabase → Table: "portfolio_images"
//   Category filter tabs come from Supabase → Table: "portfolio_categories"
//   The hero background auto-matches the selected category's first image.
//
// STYLES: Portfolio.module.css (next to this file). Selector notes:
//   → Hero height:          .portHero min-height (default: clamp(420px, 56vh, 700px))
//   → Hero overlay darkness: .portHero::before gradient rgba alpha values
//   → Title font size:      .portTitle font-size (default: clamp(4rem, 10vw, 9rem))
//   → Grid columns:         .portImageWall repeat(4, ...)
//   → Image hover zoom:     .portFigure:hover .portImg scale(1.07)
//   → Gallery background:   .portGallery background (#f5f6f4)
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData } from "@/lib/professionalData";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";
import ContentEventBeacon from "@/app/components/ContentEventBeacon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Portfolio of Bay Area graduation and family photography by Chris Solorzano.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Portfolio | soloxsnaps",
    description: "Bay Area graduation and family photography by Chris Solorzano.",
    type: "website",
  },
};

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  // ── DATA FETCHING ───────────────────────────────────────────────────────────
  // categories → the filter tabs (All, Grads, Families, etc.) from Supabase
  // images     → all portfolio photos from Supabase
  const { categories, images } = await getPortfolioData();
  const requestedCategory = (await searchParams).category;
  const selected = categories.find((category) => category.slug === requestedCategory);
  if (requestedCategory && !selected) redirect("/portfolio");
  const selectedCategory = selected?.slug;

  // Filter images to the selected category, or show all
  const filteredImages = selectedCategory
    ? images.filter((img) => img.category_slug === selectedCategory)
    : images;

  // Hero background = first image of the current filtered set
  // This auto-updates when you switch categories — grads shows a grad photo, etc.
  const heroBg = filteredImages[0]?.image_url ?? null;
  const heroImage = filteredImages[0] ?? null;

  return (
    <main className={styles.portfolioPage}>
      <ContentEventBeacon contentType="portfolio" contentId="portfolio" />
      {/* ── HERO ──────────────────────────────────────────────────────────────
           Full-bleed photo background with dark gradient overlay.
           heroBg is the first photo from the filtered set — auto-matches category.
           To use a fixed image instead: replace heroBg with a hardcoded URL. */}
      <section
        className={styles.portHero}
        aria-labelledby="portfolio-title"
      >
        {heroBg && heroImage && (
          <div className={styles.portHeroPhoto} aria-hidden="true">
            <OptimizedPhoto
              src={heroBg}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
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
            {selected?.description ?? "Graduation and family sessions across the Bay Area."}
          </p>

          <div className={styles.portMetaRow}>
            {/* Photo count badge — shows how many photos are in the current view */}
            <span className={styles.portCountBadge}>
              {filteredImages.length} {filteredImages.length === 1 ? "photo" : "photos"}
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

      {/* ── IMAGE GRID ────────────────────────────────────────────────────────
           4-column grid (2-col on mobile). Each image is aspect-ratio 4:5.
           Images stagger in by column on page load / category switch.
           To change grid columns: see .portImageWall in Portfolio.module.css. */}
      <section className={styles.portGallery} aria-label={`${selected?.name ?? "Selected work"} photos`}>
        {filteredImages.length > 0 ? (
          <div className={styles.portImageWall}>
            {filteredImages.map((image) => (
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

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────────
           Dark panel at the bottom. To change text: edit eyebrow, heading, and link. */}
      <section className={styles.portCta}>
        <p className={styles.portCtaEyebrow}>Ready to book?</p>
        {/* Main CTA heading — change this text */}
        <h2 className={styles.portCtaHeading}>Like what you see?</h2>
        <Link href="/contact" className={styles.portCtaLink}>Inquire now</Link>
      </section>
    </main>
  );
}
