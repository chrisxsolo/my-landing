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
import Testimonials from "@/app/components/Testimonials";

export const dynamic = "force-dynamic";

const title = "soloxsnaps | Bay Area Couples, Family & Graduation Photographer";
const description =
  "Bay Area photography by Chris Solorzano — couples, families, and graduation sessions. Clean direction, warm portraits, and galleries built around real moments.";

// ── FALLBACK IMAGE ────────────────────────────────────────────────────────────
const profileImage =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";

// ── VISIBLE SERVICE CARDS ─────────────────────────────────────────────────────
// Controls which portfolio categories appear as cards in the services section.
// Values must match the `slug` column in Supabase portfolio_categories.
const visiblePortfolioSlugs = ["couples", "grads", "families"];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "Bay Area couples photographer",
    "Bay Area graduation photographer",
    "Bay Area family photographer",
    "San Francisco photographer",
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
     STATS BAND — credibility strip directly under the hero
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-stats {
    background:
      radial-gradient(ellipse 60% 70% at 12% 20%, rgba(162, 210, 196, 0.16) 0%, transparent 60%),
      radial-gradient(ellipse 55% 60% at 88% 80%, rgba(130, 185, 175, 0.12) 0%, transparent 55%),
      #f5f6f4;
    padding: 44px 0 48px;
    border-bottom: 1px solid rgba(18, 24, 22, 0.06);
  }
  .home-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 14px;
    background: rgba(18, 24, 22, 0.08);
    box-shadow: 0 8px 32px rgba(18, 24, 22, 0.05);
  }
  .home-stat {
    display: grid;
    gap: 8px;
    align-content: center;
    justify-items: center;
    min-height: 126px;
    padding: 24px 18px;
    text-align: center;
    background: #ffffff;
    transition: background 0.18s ease;
  }
  .home-stat:hover { background: rgba(247, 250, 248, 0.92); }
  .home-stat-num {
    font-size: clamp(1.9rem, 4vw, 2.7rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1;
    background: linear-gradient(135deg, #3f5f58, #6fa093);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .home-stat-label {
    max-width: 15ch;
    color: #5f6c67;
    font-size: 12.5px;
    font-weight: 760;
    line-height: 1.4;
    text-wrap: balance;
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
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.14) 40%, transparent 64%);
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
     GRAD GUIDE SECTION — white bg, frosted glass cards linking into /grad-guide
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-guide {
    background: #ffffff;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18, 24, 22, 0.06);
  }
  .home-guide-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 30px;
  }
  .home-guide-card {
    position: relative;
    display: block;
    overflow: hidden;
    padding: 22px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(18, 24, 22, 0.08);
    box-shadow: 0 6px 20px rgba(18, 24, 22, 0.05);
    text-decoration: none;
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease;
  }
  .home-guide-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 18px 40px rgba(18, 24, 22, 0.10);
    border-color: rgba(112, 139, 133, 0.32);
  }
  .home-guide-emoji { display: block; margin-bottom: 12px; font-size: 28px; }
  .home-guide-card h3 { margin: 0 0 6px; color: #101412; font-size: 17px; font-weight: 860; letter-spacing: -0.01em; }
  .home-guide-card p { margin: 0; color: #4b5a55; font-size: 14px; line-height: 1.55; }
  .home-guide-arrow { position: absolute; top: 18px; right: 18px; color: rgba(112, 139, 133, 0.5); font-size: 15px; transition: color 0.2s ease, transform 0.2s ease; }
  .home-guide-card:hover .home-guide-arrow { color: #3d6b5e; transform: translate(2px, -2px); }

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

  /* ═══════════════════════════════════════════════════════════════════════════
     CLIENT PORTAL SECTION — dark premium, gradient accent
     ═══════════════════════════════════════════════════════════════════════════ */
  .home-portal {
    background:
      radial-gradient(ellipse 72% 55% at 15% 10%, rgba(157,111,232,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 85% 90%, rgba(232,121,160,0.07) 0%, transparent 60%),
      #ffffff;
    padding: 96px 0 112px;
    border-top: 1px solid rgba(18,24,22,0.06);
    position: relative;
    overflow: hidden;
  }
  .home-portal::before {
    content: '';
    position: absolute;
    top: -80px; left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 360px;
    background: radial-gradient(ellipse at center, rgba(157,111,232,0.06) 0%, rgba(232,121,160,0.04) 50%, transparent 72%);
    pointer-events: none;
  }
  .home-portal-inner {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
  }
  .home-portal-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px 5px 8px;
    border-radius: 999px;
    background: rgba(157,111,232,0.08);
    border: 1px solid rgba(157,111,232,0.18);
    color: #7c4fcf;
    font-size: 11px;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 22px;
  }
  .home-portal-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #9d6fe8;
    box-shadow: 0 0 6px rgba(157,111,232,0.8);
    animation: pulse-dot 2.2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(0.75); }
  }
  .home-portal-title {
    margin: 0 0 20px;
    color: #101412;
    font-size: clamp(1.85rem, 3.8vw, 3rem);
    font-weight: 880;
    letter-spacing: -0.025em;
    line-height: 0.96;
    text-wrap: balance;
  }
  .home-portal-title span {
    background: linear-gradient(135deg, #9d6fe8, #e879a0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .home-portal-copy {
    margin: 0 0 32px;
    color: #4b5a55;
    font-size: 16px;
    line-height: 1.78;
    text-wrap: pretty;
  }
  .home-portal-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 22px;
    border-radius: 10px;
    background: linear-gradient(135deg, #9d6fe8, #e879a0);
    color: #ffffff;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    box-shadow: 0 8px 28px rgba(157,111,232,0.35);
    transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  }
  .home-portal-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 36px rgba(157,111,232,0.48);
    opacity: 0.93;
  }
  .home-portal-features {
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }
  .home-portal-features li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    color: #5f6c67;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .home-portal-features li::before {
    content: '';
    flex-shrink: 0;
    margin-top: 5px;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: linear-gradient(135deg, #9d6fe8, #e879a0);
  }
  .home-portal-card {
    padding: 2px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(157,111,232,0.28), rgba(232,121,160,0.2));
  }
  .home-portal-card-inner {
    border-radius: 18px;
    background: #ffffff;
    padding: 36px 32px;
    display: grid;
    gap: 24px;
  }
  .home-portal-card-eyebrow {
    color: #8b9692;
    font-size: 10px;
    font-weight: 820;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 4px;
  }
  .home-portal-step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .home-portal-step-icon {
    flex-shrink: 0;
    width: 38px; height: 38px;
    border-radius: 10px;
    background: rgba(157,111,232,0.07);
    border: 1px solid rgba(157,111,232,0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
  }
  .home-portal-step-text h4 {
    margin: 0 0 3px;
    color: #101412;
    font-size: 14px;
    font-weight: 760;
    letter-spacing: -0.01em;
  }
  .home-portal-step-text p {
    margin: 0;
    color: #687571;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .home-portal-divider {
    height: 1px;
    background: rgba(18,24,22,0.07);
  }
  .home-portal-note {
    color: #8b9692;
    font-size: 11.5px;
    line-height: 1.6;
  }
  @media (max-width: 920px) {
    .home-portal-inner { grid-template-columns: 1fr; gap: 48px; }
    .home-portal-card  { max-width: 480px; }
  }
  @media (max-width: 760px) {
    .home-portal { padding: 72px 0 88px; }
    .home-portal-card-inner { padding: 28px 22px; }
  }

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
    .home-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .home-stat { min-height: 112px; }
    .home-services { padding: 44px 0 52px; }
    .home-proof { padding: 62px 0 70px; }
    .home-editorial { padding: 70px 0 76px; }
    .home-cta { padding: 66px 0 78px; }
    .home-strip { padding: 56px 0 68px; }
    .home-title { font-size: clamp(1.8rem, 8vw, 2.6rem); }
    .home-copy  { font-size: 16px; }
    .home-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .home-card h3 { font-size: 17px; letter-spacing: 0.08em; }
    .home-card-kicker { font-size: 10px; }
    .home-card-footer { font-size: 10px; padding: 7px 12px 12px; }
    .home-card-body { padding: 0 12px; bottom: 30px; }
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
    subline:
      category.slug === "couples" ? "Couples sessions" :
      category.slug === "grads"   ? "Graduation sessions" :
      "Family sessions",
    copy:
      category.slug === "couples"
        ? "Anniversaries, engagements, proposals, and lifestyle portraits with guided posing throughout."
        : category.slug === "grads"
        ? "Campus portraits, cap-and-gown details, friend groups, and gallery-ready milestone images."
        : "Calm, warm family portraits with enough direction to keep everyone comfortable.",
  }));

  const carouselImages   = images.filter((img) => img.hero_carousel).slice(0, 5);
  const heroImages       = carouselImages.length > 0 ? carouselImages : images.slice(0, 5);
  const instagramImages  = images.slice(0, 8);
  const firstPortfolioImage  = settings.home_editorial_large ?? portfolioSections[0]?.cover?.image_url ?? heroImageUrl;
  const secondPortfolioImage = settings.home_editorial_small ?? portfolioSections[1]?.cover?.image_url ?? heroImageUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "soloxsnaps",
    url: "https://soloxsnaps.com",
    image: heroImageUrl,
    founder: { "@type": "Person", name: "Chris Solorzano" },
    areaServed: ["San Francisco", "Bay Area", "San Jose", "Oakland", "Berkeley"],
    serviceType: ["Couples photography", "Graduation photography", "Family photography"],
    sameAs: ["https://www.instagram.com/soloxsnaps"],
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

      {/* ── STATS BAND ────────────────────────────────────────────────────────────
           Credibility strip directly under the hero. Real business numbers only.
           To edit: change the [number, label] pairs in the array below. */}
      <section className="home-stats" aria-label="Photographer credibility">
        <div className="home-shell">
          <div className="home-stats-grid">
            {[
              ["300+",    "Bay Area graduates photographed"],
              ["7",       "Bay Area campuses covered"],
              ["3+",      "Years shooting the Bay Area"],
              ["2 weeks", "Average gallery delivery"],
            ].map(([num, label], i) => (
              <div key={label} className="home-stat" data-reveal data-delay={String(i + 1)}>
                <span className="home-stat-num">{num}</span>
                <span className="home-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────────────
           Social proof high on the page. Content lives in lib/testimonials.ts —
           renders nothing until real client quotes are added there. */}
      <Testimonials />

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
              Couples, graduation, and family sessions — kept simple so you can pick a lane and move.
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
                <Link href="/pricing"         className="home-link home-link--ghost">See sessions</Link>
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

      {/* ── GRAD GUIDE ────────────────────────────────────────────────────────────
           White bg. Frosted glass cards linking into the free /grad-guide hub.
           To edit cards: change the guideChapters array below. */}
      <section className="home-guide" aria-label="Free graduation photo guide">
        <div className="home-shell">
          <div className="home-services-header">
            <div>
              <p className="home-kicker">Free graduation guide 🎓</p>
              <h2 className="home-title">Show up ready for your grad shoot.</h2>
            </div>
            <p className="home-copy">
              Posing, outfits, prep, and the best Bay Area campus spots — everything you need before we shoot, free to read.
            </p>
          </div>

          <div className="home-guide-grid">
            {[
              { href: "/grad-guide/posing",        emoji: "📸", title: "Posing Guide",   copy: "Natural, flattering poses that actually look good on camera." },
              { href: "/grad-guide/what-to-wear",  emoji: "👗", title: "What to Wear",    copy: "Colors and fits that photograph beautifully under cap and gown." },
              { href: "/grad-guide/how-to-prepare", emoji: "✅", title: "How to Prepare", copy: "Everything to do before shoot day so you feel confident and ready." },
            ].map((chapter, i) => (
              <Link key={chapter.href} href={chapter.href} className="home-guide-card glass-shimmer" data-reveal data-delay={String(i + 1)}>
                <span className="home-guide-arrow" aria-hidden="true">↗</span>
                <span className="home-guide-emoji">{chapter.emoji}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.copy}</p>
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
            <Link href="/grad-guide" className="home-link home-link--green">Open the full guide</Link>
            <Link href="/grads" className="home-link home-link--ghost">Browse campus spots</Link>
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
              <p className="home-kicker">Dates book up fast</p>
              <h2 className="home-title">Lock your date before it&rsquo;s gone.</h2>
              {/* CTA body copy — edit text here */}
              <p className="home-copy" style={{ marginTop: 20 }}>
                Whether it&rsquo;s a couples session, a family portrait, or a graduation milestone —
                open dates fill quickly. Send the date you have in mind and I&rsquo;ll confirm
                timing, location, and next steps.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
                <Link href="/contact" className="home-link home-link--green">Book a shoot</Link>
                <Link href="/pricing" className="home-link home-link--ghost">View sessions</Link>
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

      {/* ── CLIENT PORTAL ─────────────────────────────────────────────────────────
           Dark premium section. Advertises Gmail-based live session updates.
           CTA links to /login so clients can sign in with the Gmail they booked with. */}
      <section className="home-portal" aria-label="Client portal — live photo shoot updates">
        <div className="home-shell">
          <div className="home-portal-inner">

            {/* Left: copy */}
            <div data-reveal="left">
              <div className="home-portal-badge">
                <span className="home-portal-badge-dot" aria-hidden="true" />
                Exclusive to soloxsnaps clients
              </div>
              <h2 className="home-portal-title">
                Live updates on your session —{" "}
                <span>right in your inbox.</span>
              </h2>
              <p className="home-portal-copy">
                After you book, log in with the same Gmail you used to submit your inquiry
                and get a private client dashboard — no app downloads, no follow-up texts needed.
                Track exactly where your session stands from booking to gallery delivery.
              </p>
              <Link href="/login" className="home-portal-btn">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 4.5A1.5 1.5 0 013.5 3h9A1.5 1.5 0 0114 4.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" stroke="currentColor" strokeWidth="1.25"/>
                  <path d="M2 5l6 4.5L14 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign in with Gmail
              </Link>
              <ul className="home-portal-features">
                <li>Real-time status updates from booking through gallery delivery</li>
                <li>Session notes, location info, and shoot-day reminders in one place</li>
                <li>Gallery-ready download links the moment your photos are edited</li>
                <li>No account creation — just the Gmail you already booked with</li>
              </ul>
            </div>

            {/* Right: how-it-works card */}
            <div data-reveal data-delay="2">
              <div className="home-portal-card">
                <div className="home-portal-card-inner">
                  <div>
                    <p className="home-portal-card-eyebrow">How it works</p>
                  </div>
                  <div className="home-portal-step">
                    <div className="home-portal-step-icon">📩</div>
                    <div className="home-portal-step-text">
                      <h4>Submit your inquiry</h4>
                      <p>Fill out the contact form with the Gmail you check most — that email becomes your login.</p>
                    </div>
                  </div>
                  <div className="home-portal-divider" />
                  <div className="home-portal-step">
                    <div className="home-portal-step-icon">🔐</div>
                    <div className="home-portal-step-text">
                      <h4>Sign in after booking</h4>
                      <p>Head to the client portal and sign in with that same Google account — one click, zero passwords.</p>
                    </div>
                  </div>
                  <div className="home-portal-divider" />
                  <div className="home-portal-step">
                    <div className="home-portal-step-icon">📸</div>
                    <div className="home-portal-step-text">
                      <h4>Track every step live</h4>
                      <p>Watch your session move from confirmed → in editing → gallery ready, all in real time.</p>
                    </div>
                  </div>
                  <div className="home-portal-divider" />
                  <p className="home-portal-note">
                    Most photographers email you once and go quiet. This keeps you in the loop at every stage —
                    because your milestone deserves more than radio silence.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
