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
// QUICK EDITS:
//   → Hero height:          change min-height in .port-hero (default: clamp(420px, 56vh, 700px))
//   → Hero overlay darkness: change rgba alpha values in .port-hero::before gradient
//   → Title font size:      change font-size in .port-title (default: clamp(4rem, 10vw, 9rem))
//   → Grid columns:         change repeat(4, ...) in .port-image-wall
//   → Image hover zoom:     change scale(1.07) in .port-figure:hover .port-img
//   → Gallery background:   change background in .port-gallery (#f5f6f4)
//   → Animation speed:      change 0.55s in .port-figure animation
//   → CTA text/button:      find the port-cta section at the bottom of JSX
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio | soloxsnaps",
  description: "Portfolio of Bay Area graduation and family photography by Chris Solorzano.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Portfolio | soloxsnaps",
    description: "Bay Area graduation and family photography by Chris Solorzano.",
    type: "website",
  },
};

const CSS = `
  /* ── SMOOTH PAGE TRANSITIONS when switching categories ─────────────────────
     Uses CSS View Transitions API (Chrome/Safari 2024+) for a cross-fade
     when clicking All / Grads / Families. No JS needed. */
  @view-transition { navigation: auto; }

  /* ── ENTRANCE ANIMATIONS ────────────────────────────────────────────────── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes heroReveal {
    from { opacity: 0; transform: translateY(36px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.97); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ── PAGE WRAPPER ───────────────────────────────────────────────────────── */
  .portfolio-page {
    background: #f5f6f4;
    color: #111;
    padding-top: 0; /* hero handles its own top spacing */
  }

  /* ── HERO SECTION ───────────────────────────────────────────────────────────
     Full-bleed photo background with dark gradient overlay.
     The background-image is set inline on the element (from Supabase).
     Falls back to solid dark if no image. */
  .port-hero {
    position: relative;
    min-height: clamp(420px, 56vh, 700px);
    display: grid;
    align-items: end;
    padding-top: 78px; /* clears the fixed nav */
    background-color: #0c0d0c;
    overflow: hidden;
  }
  .port-hero-photo {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .port-hero-photo img {
    object-position: center 30%;
  }

  /* Dark gradient so text is always readable over any photo */
  .port-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(5, 6, 5, 0.22) 0%,
      rgba(5, 6, 5, 0.55) 50%,
      rgba(5, 6, 5, 0.90) 100%
    );
    z-index: 1;
  }

  /* Subtle grain texture over the hero */
  .port-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 180px;
    opacity: 0.6;
    pointer-events: none;
    z-index: 2;
  }

  /* All hero content sits above the overlays */
  .port-hero-inner {
    position: relative;
    z-index: 3;
    width: min(1500px, calc(100% - 48px));
    margin: 0 auto;
    padding-bottom: 52px;
  }

  /* "PORTFOLIO" label above the title */
  .port-eyebrow {
    margin: 0 0 16px;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    animation: fadeIn 0.6s ease both;
  }

  /* BIG category title — "Grads", "Families", "Selected Work"
     To resize: change clamp(4rem, 10vw, 9rem) */
  .port-title {
    margin: 0 0 16px;
    color: #fff;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(4rem, 10vw, 9rem);
    font-weight: 900;
    line-height: 0.88;
    letter-spacing: -0.03em;
    text-wrap: balance;
    animation: heroReveal 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Category description text */
  .port-description {
    max-width: 440px;
    margin: 0 0 28px;
    color: rgba(255, 255, 255, 0.6);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.65;
    animation: fadeUp 0.6s 0.2s ease both;
  }

  /* Row containing count badge + filter tabs */
  .port-meta-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    animation: fadeUp 0.6s 0.28s ease both;
  }

  /* "XX photos" badge */
  .port-count-badge {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 100px;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  /* Filter tabs row — frosted glass pill container
     To change the frosted glass look: adjust background and backdrop-filter */
  .port-filter-row {
    display: inline-flex;
    gap: 3px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  /* Individual filter tab (All / Grads / Families) */
  .port-filter-link {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 18px;
    border-radius: 100px;
    color: rgba(255, 255, 255, 0.6);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
    transition: background 0.2s ease, color 0.2s ease;
  }
  /* Active tab (current category) and hover state */
  .port-filter-link[aria-current="page"],
  .port-filter-link:hover {
    background: rgba(255, 255, 255, 0.95);
    color: #0c0d0c;
  }

  /* ── GALLERY SECTION ────────────────────────────────────────────────────────
     Light background, tight grid of images.
     To change background color: update #f5f6f4 */
  .port-gallery {
    padding: 28px 20px 110px;
    background: #f5f6f4;
  }

  /* The 4-column image grid.
     To change columns: replace repeat(4, ...) with repeat(3, ...) for 3 cols.
     gap: 7px is the space between photos. */
  .port-image-wall {
    width: min(1500px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
  }

  /* Individual photo container — keeps aspect ratio 4:5 (portrait)
     animation: staggers by column position (4n+1, 4n+2, etc.) */
  .port-figure {
    position: relative;
    aspect-ratio: 4 / 5;
    margin: 0;
    overflow: hidden;
    background: #dde4e0;
    isolation: isolate;
    border-radius: 3px;
    animation: scaleIn 0.55s ease both;
  }
  .port-figure[data-category="families"] .port-img {
    object-position: center 42%;
  }

  /* Stagger entrance by column — columns animate in left to right
     To change stagger timing: update the delay values */
  .port-figure:nth-child(4n + 1) { animation-delay: 0.04s; }
  .port-figure:nth-child(4n + 2) { animation-delay: 0.11s; }
  .port-figure:nth-child(4n + 3) { animation-delay: 0.18s; }
  .port-figure:nth-child(4n + 4) { animation-delay: 0.25s; }

  /* The actual photo — scales up on hover
     To change zoom intensity: update scale(1.07) */
  .port-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    transform: scale(1.02);
    transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.5s ease;
  }
  .port-figure:hover .port-img {
    transform: scale(1.07);
    filter: contrast(1.03) saturate(1.05);
  }

  /* Thin inset border visible on hover */
  .port-figure::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
    transition: box-shadow 0.3s ease;
  }
  .port-figure:hover::after {
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  }

  /* Empty state when no images */
  .port-empty {
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 72px 28px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    color: #6b7b75;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
  }

  /* ── CTA SECTION ─────────────────────────────────────────────────────────────
     Dark bookend at the bottom of the page.
     To change heading text: find port-cta-heading in JSX. */
  .port-cta {
    background: #0c0d0c;
    padding: 96px 28px;
    text-align: center;
  }
  .port-cta-eyebrow {
    margin: 0 0 12px;
    color: rgba(255, 255, 255, 0.4);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .port-cta-heading {
    margin: 0 0 40px;
    color: #fff;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(2.2rem, 5vw, 4.5rem);
    font-weight: 900;
    letter-spacing: -0.025em;
    line-height: 0.95;
  }
  /* CTA button — inherits the site's teal button style */
  .port-cta-link {
    display: inline-flex;
    align-items: center;
    min-height: 52px;
    padding: 0 32px;
    border: 1px solid rgba(154, 185, 178, 0.3);
    border-radius: 8px;
    background: rgba(154, 185, 178, 0.12);
    color: #9ab9b2;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 14px;
    font-weight: 820;
    letter-spacing: 0.04em;
    text-decoration: none;
    text-transform: uppercase;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  }
  .port-cta-link:hover {
    transform: translateY(-2px);
    background: rgba(154, 185, 178, 0.2);
    border-color: rgba(154, 185, 178, 0.5);
    color: #c4d9d5;
  }

  /* ── RESPONSIVE: TABLET (below 980px) ─────────────────────────────────────── */
  @media (max-width: 980px) {
    .port-image-wall {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px;
    }
    /* Re-stagger for 3-column layout */
    .port-figure:nth-child(3n + 1) { animation-delay: 0.04s; }
    .port-figure:nth-child(3n + 2) { animation-delay: 0.11s; }
    .port-figure:nth-child(3n + 3) { animation-delay: 0.18s; }
  }

  /* ── RESPONSIVE: MOBILE (below 760px) ─────────────────────────────────────── */
  @media (max-width: 760px) {
    .port-hero {
      min-height: clamp(360px, 70vw, 520px);
    }
    .port-hero-inner {
      width: min(1500px, calc(100% - 32px));
      padding-bottom: 36px;
    }
    .port-title {
      font-size: clamp(3rem, 14vw, 5rem);
    }
    .port-gallery {
      padding: 20px 12px 82px;
    }
    .port-image-wall {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
    }
    .port-filter-row {
      width: 100%;
      justify-content: center;
    }
    .port-filter-link {
      padding: 0 14px;
      font-size: 11px;
    }
    .port-cta {
      padding: 72px 24px;
    }
    .port-cta-link {
      width: 100%;
      justify-content: center;
    }
  }
`;

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
    <main className="portfolio-page">
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────────
           Full-bleed photo background with dark gradient overlay.
           heroBg is the first photo from the filtered set — auto-matches category.
           To use a fixed image instead: replace heroBg with a hardcoded URL. */}
      <section
        className="port-hero"
        aria-labelledby="portfolio-title"
      >
        {heroBg && heroImage && (
          <div className="port-hero-photo" aria-hidden="true">
            <OptimizedPhoto
              src={heroBg}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        )}
        <div className="port-hero-inner">
          {/* Small eyebrow label — change text here */}
          <p className="port-eyebrow">Portfolio</p>

          {/* Big bold category title — "Grads", "Families", or "Selected Work" */}
          <h1 id="portfolio-title" className="port-title">
            {selected?.name ?? "Selected Work"}
          </h1>

          {/* Category description — comes from Supabase portfolio_categories.description */}
          <p className="port-description">
            {selected?.description ?? "Graduation and family sessions across the Bay Area."}
          </p>

          <div className="port-meta-row">
            {/* Photo count badge — shows how many photos are in the current view */}
            <span className="port-count-badge">
              {filteredImages.length} {filteredImages.length === 1 ? "photo" : "photos"}
            </span>

            {/* Filter tabs — frosted glass pills. Active tab = white fill.
                 Links update the URL: /portfolio?category=grads etc. */}
            <nav className="port-filter-row" aria-label="Portfolio filters">
              <Link
                href="/portfolio"
                className="port-filter-link"
                aria-current={!selectedCategory ? "page" : undefined}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/portfolio?category=${cat.slug}`}
                  className="port-filter-link"
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
           To change grid columns: see .port-image-wall in CSS above. */}
      <section className="port-gallery" aria-label={`${selected?.name ?? "Selected work"} photos`}>
        {filteredImages.length > 0 ? (
          <div className="port-image-wall">
            {filteredImages.map((image) => (
              <figure key={image.id} className="port-figure" data-category={image.category_slug}>
                <OptimizedPhoto
                  src={image.image_url}
                  alt={image.alt}
                  className="port-img"
                  sizes="(max-width: 760px) 50vw, (max-width: 980px) 33vw, 25vw"
                  quality={75}
                />
              </figure>
            ))}
          </div>
        ) : (
          <div className="port-empty">No photos in this category yet.</div>
        )}
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────────
           Dark panel at the bottom. To change text: edit eyebrow, heading, and link. */}
      <section className="port-cta">
        <p className="port-cta-eyebrow">Ready to book?</p>
        {/* Main CTA heading — change this text */}
        <h2 className="port-cta-heading">Like what you see?</h2>
        <Link href="/contact" className="port-cta-link">Inquire now</Link>
      </section>
    </main>
  );
}
