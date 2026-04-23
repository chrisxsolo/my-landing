// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE  →  soloxsnaps.com
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero Carousel   — full-width sliding photo carousel (unchanged)
//   2. Services section — frosted glass cards: Grads, Families, Contact
//   3. Editorial       — stacked photos + "Clean galleries" copy
//   4. Session system  — 4-item frosted glass stat grid
//   5. CTA panel       — frosted glass "Lock the date" panel
//   6. Instagram strip — 8 thumbnail photos
//
// QUICK EDITS:
//   → Hero carousel photos:   Supabase → portfolio_images → set hero_carousel = true
//   → Service card text:      find portfolioSections.map() in JSX — edit copy/subline
//   → Session system stats:   find the [["01", "Direction", ...], ...] array in JSX
//   → CTA heading/copy:       find the home-cta section near the bottom of JSX
//   → Instagram count:        change .slice(0, 8) to show more/fewer thumbnails
//   → Instagram handle text:  search "@soloxsnaps" in JSX
//   → Visible service slugs:  edit visiblePortfolioSlugs below
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings, type PortfolioCategory, type PortfolioImage } from "@/lib/professionalData";
import HeroCarousel from "@/app/components/HeroCarousel";

export const dynamic = "force-dynamic";

const title = "soloxsnaps | Bay Area Graduation and Family Photographer";
const description =
  "Bay Area graduation and family photography by Chris Solorzano. Clean direction, warm portraits, and galleries built around real milestones.";

// ── FALLBACK IMAGE ────────────────────────────────────────────────────────────
const profileImage =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";

// ── VISIBLE SERVICE CARDS ─────────────────────────────────────────────────────
// Controls which portfolio categories appear as cards in the services section.
// Values must match the `slug` column in Supabase portfolio_categories.
const visiblePortfolioSlugs = ["grads", "families"];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "Bay Area graduation photographer",
    "San Francisco graduation photographer",
    "Bay Area family photographer",
    "soloxsnaps",
    "Chris Solorzano photography",
  ],
  openGraph: { title, description, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title, description },
};

type CoverImage = Pick<PortfolioImage, "image_url" | "alt">;

function getCoverForCategory(
  category: PortfolioCategory,
  images: PortfolioImage[],
  fallback: PortfolioImage | undefined,
  index: number
) {
  return images.find((img) => img.category_slug === category.slug) ?? images[index] ?? fallback;
}

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .home-page {
    background: transparent;
    color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .home-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── SHARED TYPOGRAPHY ───────────────────────────────────────────────────── */
  .home-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .home-title {
    margin: 0;
    color: #101412;
    font-size: clamp(2rem, 4.5vw, 3.4rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 0.98;
    text-wrap: balance;
  }
  .home-copy {
    margin: 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.75;
    text-wrap: pretty;
  }

  /* ── BUTTONS ──────────────────────────────────────────────────────────────── */
  .home-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .home-link--green {
    border: 1px solid rgba(112, 139, 133, 0.22);
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 8px 24px rgba(112, 139, 133, 0.05);
  }
  .home-link--green:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 12px 28px rgba(112, 139, 133, 0.07);
  }
  .home-link--ghost {
    border: 1px solid rgba(18, 24, 22, 0.11);
    background: rgba(255, 255, 255, 0.72);
    color: #101412;
  }
  .home-link--ghost:hover {
    transform: translateY(-1px);
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(18, 24, 22, 0.06);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     SERVICES SECTION — frosted glass cards on gradient mesh bg
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-services {
    background:
      radial-gradient(ellipse 70% 60% at 10% 20%, rgba(162, 210, 196, 0.14) 0%, transparent 60%),
      radial-gradient(ellipse 50% 55% at 90% 80%, rgba(130, 185, 175, 0.10) 0%, transparent 55%),
      #f5f6f4;
    padding: 56px 0 64px;
  }
  .home-services-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    margin-bottom: 24px;
  }
  .home-services-header .home-copy { max-width: 400px; }

  /* 3-column card grid (stays 3-col until narrow mobile) */
  .home-card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  /* Overlay photo card */
  .home-card {
    display: block;
    position: relative;
    overflow: hidden;
    aspect-ratio: 4 / 5;
    border-radius: 12px;
    background: #101412;
    color: #ffffff;
    text-decoration: none;
    box-shadow: 0 8px 28px rgba(18, 24, 22, 0.10);
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease;
  }
  .home-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 48px rgba(18, 24, 22, 0.18);
  }
  .home-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.22) 42%, transparent 68%);
    pointer-events: none;
    z-index: 1;
  }

  /* Card photo — fills entire card */
  .home-card-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: #dfe8e4;
  }
  .home-card-media img {
    width: 100%; height: 100%;
    display: block; object-fit: cover;
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .home-card:hover .home-card-media img { transform: scale(1.05); }

  .home-card-body {
    position: absolute;
    bottom: 36px;
    left: 0; right: 0;
    padding: 0 16px;
    z-index: 2;
  }
  .home-card-kicker { margin: 0 0 4px; color: rgba(255,255,255,0.65); font-size: 10px; font-weight: 820; letter-spacing: 0.08em; text-transform: uppercase; }
  .home-card h3 {
    margin: 0;
    color: #ffffff;
    font-size: 20px;
    font-weight: 860;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    line-height: 1;
  }
  .home-card p { display: none; }
  .home-card-footer {
    position: absolute;
    bottom: 0;
    left: 0; right: 0;
    padding: 8px 16px 14px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    color: rgba(255,255,255,0.72);
    font-size: 10px;
    font-weight: 820;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    z-index: 2;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     EDITORIAL SECTION — white bg, stacked photos + copy
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-editorial {
    background: #ffffff;
    padding: 88px 0 96px;
    border-top: 1px solid rgba(18, 24, 22, 0.06);
  }
  .home-editorial-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 52px;
    align-items: end;
  }
  .home-editorial-copy { display: grid; gap: 26px; }
  .home-editorial-media { position: relative; min-height: 560px; }

  .home-stacked-photo {
    position: absolute;
    overflow: hidden;
    border-radius: 12px;
    background: #dfe8e4;
    box-shadow: 0 14px 40px rgba(18, 24, 22, 0.1);
  }
  .home-stacked-photo img { width: 100%; height: 100%; display: block; object-fit: cover; }
  .home-stacked-photo[data-size="large"] { inset: 0 0 42px 98px; }
  .home-stacked-photo[data-size="small"] {
    left: 0; bottom: 0; width: 46%; aspect-ratio: 4 / 5;
    border: 8px solid #ffffff;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     SESSION SYSTEM — gradient mesh bg, frosted glass 4-item grid
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-proof {
    background:
      radial-gradient(ellipse 60% 70% at 80% 15%, rgba(130, 185, 175, 0.12) 0%, transparent 55%),
      radial-gradient(ellipse 55% 50% at 15% 90%, rgba(162, 210, 196, 0.10) 0%, transparent 55%),
      #f5f6f4;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18, 24, 22, 0.06);
  }
  .home-proof-header { margin-bottom: 30px; }

  /* 5-column grid: intro cell + 4 stat cells */
  .home-proof-grid {
    display: grid;
    grid-template-columns: 1.08fr repeat(4, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 14px;
    background: rgba(18, 24, 22, 0.09);
    box-shadow: 0 8px 32px rgba(18, 24, 22, 0.06);
  }
  .home-proof-intro, .home-proof-item {
    min-height: 148px;
    padding: 22px;
    background: #ffffff;
  }
  .home-proof-intro {
    display: grid;
    align-content: space-between;
    border-right: 1px solid rgba(18, 24, 22, 0.09);
    background: rgba(247, 250, 248, 0.92);
  }
  .home-proof-eyebrow { margin: 0 0 28px; color: #667f79; font-size: 12px; font-weight: 820; }
  .home-proof-title {
    margin: 0;
    color: #101412;
    font-size: 22px;
    font-weight: 860;
    letter-spacing: -0.01em;
    line-height: 1.08;
    text-wrap: balance;
  }
  .home-proof-item {
    display: grid;
    align-content: space-between;
    gap: 24px;
    border-right: 1px solid rgba(18, 24, 22, 0.09);
    transition: background 0.18s ease;
  }
  .home-proof-item:last-child { border-right: 0; }
  .home-proof-item:hover { background: #ffffff; }
  .home-proof-number { color: rgba(18, 24, 22, 0.2); font-size: 13px; font-weight: 820; }
  .home-proof-item h3 {
    display: block; margin: 0 0 6px;
    color: #101412; font-size: 17px; font-weight: 860; letter-spacing: -0.01em; line-height: 1.05;
  }
  .home-proof-item p { display: block; margin: 0; color: #5f6c67; font-size: 13px; line-height: 1.5; }

  /* ═══════════════════════════════════════════════════════════════════════════
     CTA PANEL — white bg, frosted glass card
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-cta {
    background: #ffffff;
    padding: 88px 0 110px;
    border-top: 1px solid rgba(18, 24, 22, 0.06);
  }
  .home-cta-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
    gap: 28px;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 40px rgba(18, 24, 22, 0.07);
  }
  .home-cta-copy { padding: 32px 28px; }
  .home-cta-media {
    overflow: hidden;
    min-height: 420px;
    border-radius: 12px;
    background: #dfe8e4;
    box-shadow: 0 8px 28px rgba(18, 24, 22, 0.08);
  }
  .home-cta-media img { width: 100%; height: 100%; display: block; object-fit: cover; }

  /* When stacked (single column), cap the image so it doesn't dominate */
  @media (max-width: 920px) {
    .home-cta-media {
      min-height: 0;
      max-width: 460px;
      margin: 0 auto;
      width: 100%;
    }
    .home-cta-media img {
      height: auto;
      object-fit: contain;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INSTAGRAM STRIP — light gray bg, square thumbnails
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-strip {
    background: #f5f6f4;
    padding: 68px 0 80px;
    border-top: 1px solid rgba(18, 24, 22, 0.06);
  }
  .home-strip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .home-strip-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(120px, 1fr));
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .home-strip-link {
    display: block;
    min-width: 120px;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 10px;
    background: #dfe8e4;
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .home-strip-link:hover { transform: scale(1.03); }
  .home-strip-link img { width: 100%; height: 100%; display: block; object-fit: cover; }

  /* ── RESPONSIVE ────────────────────────────────────────────────────────────── */
  @media (max-width: 920px) {
    .home-editorial-grid   { grid-template-columns: 1fr; }
    .home-cta-panel        { grid-template-columns: 1fr; }
    .home-proof-grid       { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .home-services-header  { align-items: flex-start; flex-direction: column; }
    .home-editorial-media  { min-height: 520px; order: -1; }
    .home-stacked-photo[data-size="large"] { inset: 0 0 36px 22px; }
    .home-stacked-photo[data-size="small"] { width: 38%; border-width: 6px; }
    .home-proof-intro      { grid-column: 1 / -1; min-height: 120px; border-right: 0; border-bottom: 1px solid rgba(18,24,22,0.09); }
    .home-proof-item:nth-child(3),
    .home-proof-item:last-child { border-right: 0; }
  }
  @media (max-width: 760px) {
    .home-shell { width: min(1180px, calc(100% - 36px)); }
    .home-services { padding: 44px 0 52px; }
    .home-proof { padding: 62px 0 70px; }
    .home-editorial { padding: 70px 0 76px; }
    .home-cta { padding: 66px 0 78px; }
    .home-strip { padding: 56px 0 68px; }
    .home-title { font-size: clamp(1.8rem, 8vw, 2.6rem); }
    .home-copy  { font-size: 16px; }
    .home-card-grid { gap: 6px; }
    .home-card h3 { font-size: 15px; letter-spacing: 0.08em; }
    .home-card-kicker { font-size: 9px; }
    .home-card-footer { font-size: 9px; padding: 6px 10px 10px; }
    .home-card-body { padding: 0 10px; bottom: 28px; }
    .home-cta-copy { padding: 18px 8px 8px; }
    .home-cta-media { max-width: 380px; }
    .home-editorial-media { min-height: 430px; }
    .home-stacked-photo[data-size="large"] { inset: 0 0 32px 14px; }
    .home-stacked-photo[data-size="small"] { width: 34%; border-width: 5px; }
  }
  @media (max-width: 540px) {
    .home-proof-grid { grid-template-columns: 1fr; }
    .home-proof-intro { grid-column: auto; }
    .home-proof-item { min-height: 112px; border-right: 0; border-bottom: 1px solid rgba(18,24,22,0.09); }
    .home-proof-item:last-child { border-bottom: 0; }
    .home-editorial-media { min-height: 360px; }
    .home-stacked-photo[data-size="large"] { inset: 0 0 24px 8px; }
    .home-stacked-photo[data-size="small"] { width: 30%; border-width: 4px; }
    .home-strip-grid { grid-template-columns: repeat(4, minmax(100px, 1fr)); }
  }
`;

export default async function ProfessionalHomePage() {
  const [{ categories, images }, settings] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
  ]);
  const heroImage    = images[0];
  const heroImageUrl = heroImage?.image_url ?? profileImage;

  function resolveSettingsCover(key: string, fallback: PortfolioImage | undefined): CoverImage | undefined {
    const url = settings[key];
    if (url) return { image_url: url, alt: key.replace("home_cover_", "") };
    return fallback;
  }

  const visibleCategories = visiblePortfolioSlugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter(Boolean) as PortfolioCategory[];

  const portfolioSections = visibleCategories.map((category, index) => ({
    category,
    cover: resolveSettingsCover(`home_cover_${category.slug}`, getCoverForCategory(category, images, heroImage, index)),
    subline: category.slug === "grads" ? "Graduation sessions" : "Family sessions",
    copy:
      category.slug === "grads"
        ? "Campus portraits, cap-and-gown details, friend groups, and gallery-ready milestone images."
        : "Calm, warm family portraits with enough direction to keep everyone comfortable.",
  }));

  const carouselImages   = images.filter((img) => img.hero_carousel).slice(0, 5);
  const heroImages       = carouselImages.length > 0 ? carouselImages : images.slice(0, 5);
  const instagramImages  = images.slice(0, 8);
  const firstPortfolioImage  = portfolioSections[0]?.cover?.image_url ?? heroImageUrl;
  const secondPortfolioImage = portfolioSections[1]?.cover?.image_url ?? heroImageUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "soloxsnaps",
    url: "https://soloxsnaps.com",
    image: heroImageUrl,
    founder: { "@type": "Person", name: "Chris Solorzano" },
    areaServed: ["San Francisco", "Bay Area", "San Jose", "Oakland", "Berkeley"],
    serviceType: ["Graduation photography", "Family photography"],
  };

  return (
    <main className="home-page">
      <style>{CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ── HERO CAROUSEL — keep unchanged ────────────────────────────────────── */}
      <HeroCarousel images={heroImages} />

      {/* ── SERVICES SECTION ──────────────────────────────────────────────────────
           Light gray bg, frosted glass cards. 3 cards: Grads, Families, Contact.
           To edit card copy: find portfolioSections.map() below. */}
      <div className="home-services">
        <div className="home-shell">
          <div className="home-services-header">
            <div>
              {/* Section heading — edit text here */}
              <p className="home-kicker">Choose the session</p>
              <h2 className="home-title">Built for milestones, not stock-photo energy.</h2>
            </div>
            <p className="home-copy">
              Graduation, family, and booking info — kept simple so you can pick a lane and move.
            </p>
          </div>

          <div className="home-card-grid">
            {portfolioSections.map(({ category, cover, subline, copy }, i) => (
              <Link key={category.slug} href={`/portfolio?category=${category.slug}`} className="home-card glass-shimmer" data-reveal data-delay={String(i + 1)}>
                {cover && (
                  <div className="home-card-media">
                    <img src={cover.image_url} alt={cover.alt} loading="lazy" decoding="async" />
                  </div>
                )}
                <div className="home-card-body">
                  <p className="home-card-kicker">{subline}</p>
                  <h3>{category.name}</h3>
                  <p>{copy}</p>
                </div>
                <span className="home-card-footer">
                  View gallery <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}

            <Link href="/contact" className="home-card glass-shimmer" data-reveal data-delay="3">
              <div className="home-card-media">
                <img src={settings.home_cover_contact ?? heroImageUrl} alt="Book a Bay Area photography session" loading="lazy" decoding="async" />
              </div>
              <div className="home-card-body">
                <p className="home-card-kicker">Booking</p>
                <h3>Contact</h3>
                {/* Edit this copy to update the contact card description */}
                <p>Share your date, location ideas, and what kind of session you want to make.</p>
              </div>
              <span className="home-card-footer">
                Start inquiry <span aria-hidden="true">→</span>
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── EDITORIAL SECTION ─────────────────────────────────────────────────────
           White bg. Stacked photos (right) + copy (left).
           Photos: firstPortfolioImage / secondPortfolioImage from Supabase. */}
      <div className="home-editorial">
        <div className="home-shell">
          <div className="home-editorial-grid">
            <div className="home-editorial-copy" data-reveal="left">
              <div>
                {/* Section heading — edit text here */}
                <p className="home-kicker">Portraits for the people you keep</p>
                <h2 className="home-title">Clean galleries with a little life left in them.</h2>
              </div>
              {/* Body copy — edit text here */}
              <p className="home-copy">
                I keep sessions calm, directed, and fast enough to feel good. The goal is a polished gallery
                that still feels like the day happened, not like everyone got turned into a template.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Link href="/availability" className="home-link home-link--green">Check dates</Link>
                <Link href="/pricing/grads"   className="home-link home-link--ghost">See grad rates</Link>
              </div>
            </div>
            <div className="home-editorial-media" aria-label="Featured photography" data-reveal data-delay="2">
              <div className="home-stacked-photo" data-size="large">
                <img src={firstPortfolioImage}  alt="Bay Area portrait session" loading="lazy" decoding="async" />
              </div>
              <div className="home-stacked-photo" data-size="small">
                <img src={secondPortfolioImage} alt="Family or graduation session detail" loading="lazy" decoding="async" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SESSION SYSTEM ────────────────────────────────────────────────────────
           Light gray bg. Frosted glass 5-column grid (intro + 4 stats).
           To edit stats: change the [["01", "Direction", ...], ...] array below. */}
      <section className="home-proof" aria-label="Session highlights">
        <div className="home-shell">
          <div className="home-proof-header">
            <p className="home-kicker">Session system</p>
            <h2 className="home-title" style={{ maxWidth: 540 }}>A smoother shoot, from first note to final gallery.</h2>
          </div>
          <div className="home-proof-grid">
            <div className="home-proof-intro">
              <p className="home-proof-eyebrow">How it runs</p>
              <h3 className="home-proof-title">Simple from booking to gallery drop.</h3>
            </div>
            {[
              ["01", "Direction",  "Clear posing without stiff, frozen photos."],
              ["02", "Locations",  "SF, Berkeley, Stanford, SJSU, South Bay."],
              ["03", "Gallery",    "Clean delivery for sharing and downloading."],
              ["04", "Timing",     "Peak campus dates move fast."],
            ].map(([number, title, copy], i) => (
              <div key={title} className="home-proof-item" data-reveal data-delay={String(i + 1)}>
                <span className="home-proof-number">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA PANEL ─────────────────────────────────────────────────────────────
           White bg. Frosted glass card with photo (right) + copy (left).
           To change heading: edit the h2 below. */}
      <section className="home-cta">
        <div className="home-shell">
          <div className="home-cta-panel glass-shimmer" data-reveal>
            <div className="home-cta-copy">
              {/* CTA heading — edit text here */}
              <p className="home-kicker">Grad season moves quickly</p>
              <h2 className="home-title">Lock the date before campus turns chaotic.</h2>
              {/* CTA body copy — edit text here */}
              <p className="home-copy" style={{ marginTop: 20 }}>
                Open dates change fast during spring. Send the date you have in mind and I will confirm
                timing, location flow, and next steps.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
                <Link href="/contact"    className="home-link home-link--green">Book a shoot</Link>
                <Link href="/grad-guide" className="home-link home-link--ghost">Graduation guide</Link>
              </div>
            </div>
            <div className="home-cta-media">
              <img src={heroImageUrl} alt="Graduation portrait by soloxsnaps" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      {/* ── INSTAGRAM STRIP ───────────────────────────────────────────────────────
           Light gray bg, 8 square thumbnails.
           To change count: update .slice(0, 8) in instagramImages above. */}
      {instagramImages.length > 0 && (
        <div className="home-strip">
          <div className="home-shell">
            <div className="home-strip-header">
              {/* Change handle text here */}
              <p className="home-kicker" style={{ margin: 0 }}>@soloxsnaps</p>
              <a
                href="https://www.instagram.com/soloxsnaps"
                target="_blank"
                rel="noopener noreferrer"
                className="home-link home-link--ghost"
              >
                Instagram
              </a>
            </div>
            <div className="home-strip-grid">
              {instagramImages.map((image) => (
                <a
                  key={image.id}
                  href="https://www.instagram.com/soloxsnaps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home-strip-link"
                >
                  <img src={image.image_url} alt={image.alt} loading="lazy" decoding="async" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
