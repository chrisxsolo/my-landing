// ─────────────────────────────────────────────────────────────────────────────
// RATES LANDING PAGE  →  soloxsnaps.com/pricing
// Two cards (Grads + Families) that link to their respective detail pages.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData } from "@/lib/professionalData";

export const metadata: Metadata = {
  title: "Rates | soloxsnaps",
  description: "Photography pricing by Chris Solorzano — graduation and family sessions in the Bay Area.",
  alternates: { canonical: "/pricing" },
};

const RATES = [
  {
    slug:    "grads",
    href:    "/pricing/grads",
    kicker:  "Graduation photography",
    heading: "Grad rates",
    copy:    "Senior portraits and graduation day coverage. Packages starting from $350/hr with add-ons for groups, extra locations, and rush delivery.",
    cta:     "See grad pricing",
    chips:   ["From $350 / hr", "50+ edited images", "Bay Area locations"],
  },
  {
    slug:    "families",
    href:    "/pricing/families",
    kicker:  "Family photography",
    heading: "Family rates",
    copy:    "Relaxed family sessions with enough structure for everyone — kids, grandparents, and everyone who says they feel awkward in photos.",
    cta:     "See family pricing",
    chips:   ["From $350", "Guided session", "Family-friendly pacing"],
  },
] as const;

export default async function RatesPage() {
  const { images } = await getPortfolioData();

  const gradBg   = images.find((i) => i.category_slug === "grads")?.image_url   ?? null;
  const familyBg = images.find((i) => i.category_slug === "families")?.image_url ?? null;
  const bgMap: Record<string, string | null> = { grads: gradBg, families: familyBg };

  return (
    <main className="rates-root">
      <style>{CSS}</style>

      {/* ── PAGE HEADER ───────────────────────────────────────────────────────── */}
      <section className="rates-shell">
        <div className="rates-header">
          <p className="rates-kicker" style={{ animationDelay: "0.05s" }}>Pricing</p>
          <h1 className="rates-title" style={{ animationDelay: "0.14s" }}>
            Choose your session.
          </h1>
          <p className="rates-copy" style={{ animationDelay: "0.22s" }}>
            Straightforward pricing. No hidden packages or surprise fees — just photography that looks like something.
          </p>
        </div>
      </section>

      {/* ── RATE CARDS GRID ───────────────────────────────────────────────────── */}
      <section className="rates-shell rates-grid" aria-label="Session types">
        {RATES.map(({ slug, href, kicker, heading, copy, cta, chips }, i) => {
          const bg = bgMap[slug];
          return (
            <Link
              key={slug}
              href={href}
              className="rate-card"
              style={{ animationDelay: `${0.28 + i * 0.12}s` }}
              aria-label={`View ${heading}`}
            >
              {/* Photo background */}
              {bg && (
                <div
                  className="rate-card-bg"
                  style={{ backgroundImage: `url(${bg})` }}
                  aria-hidden="true"
                />
              )}

              {/* Gradient overlay — always present */}
              <div className="rate-card-overlay" aria-hidden="true" />

              {/* Text content */}
              <div className="rate-card-body">
                <div className="rate-card-top">
                  <p className="rate-card-kicker">{kicker}</p>
                  <h2 className="rate-card-heading">{heading}</h2>
                  <p className="rate-card-copy">{copy}</p>
                </div>

                <div className="rate-card-bottom">
                  <div className="rate-card-chips">
                    {chips.map((chip) => (
                      <span key={chip} className="rate-chip">{chip}</span>
                    ))}
                  </div>
                  <span className="rate-card-cta">
                    {cta}
                    <svg className="rate-cta-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 10h12M11 6l5 4-5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* ── BOTTOM NOTE ───────────────────────────────────────────────────────── */}
      <section className="rates-shell rates-footer-note" style={{ animationDelay: "0.56s" }}>
        <p>
          Questions before booking?{" "}
          <Link href="/contact" className="rates-inline-link">Reach out directly →</Link>
        </p>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// Scoped to this page — no shared factory needed for a landing page.
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes ratesFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .rates-root {
    padding-top: 98px;
    min-height: 100dvh;
    background: transparent;
  }

  .rates-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── PAGE HEADER ──────────────────────────────────────────────────────────── */
  .rates-header {
    padding: 64px 0 52px;
  }

  .rates-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    letter-spacing: 0;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    animation: ratesFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
  }

  .rates-title {
    margin: 0;
    color: #101412;
    font-size: clamp(2.6rem, 6vw, 5rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 0.94;
    text-wrap: balance;
    animation: ratesFadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }

  .rates-copy {
    margin: 20px 0 0;
    max-width: 560px;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.7;
    text-wrap: pretty;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    animation: ratesFadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* ── CARDS GRID ───────────────────────────────────────────────────────────── */
  .rates-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    padding-bottom: 80px;
  }

  /* ── INDIVIDUAL CARD ──────────────────────────────────────────────────────── */
  .rate-card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: clamp(480px, 62vh, 700px);
    border: 1px solid rgba(18,24,22,0.12);
    border-radius: 12px;
    overflow: hidden;
    background: #0f1210;
    text-decoration: none;
    cursor: pointer;
    animation: ratesFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) both;
    transition:
      transform   0.3s  cubic-bezier(0.22,1,0.36,1),
      box-shadow  0.3s  ease,
      border-color 0.3s ease;
  }
  .rate-card:hover {
    transform: translateY(-5px) scale(1.005);
    box-shadow: 0 28px 64px rgba(12,14,12,0.22);
    border-color: rgba(18,24,22,0.22);
  }

  /* Photo layer */
  .rate-card-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center 20%;
    transition: transform 0.7s cubic-bezier(0.22,1,0.36,1), filter 0.4s ease;
    will-change: transform;
  }
  .rate-card:hover .rate-card-bg {
    transform: scale(1.04);
    filter: brightness(0.9);
  }

  /* Gradient overlay — dark at bottom so text is always readable */
  .rate-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(5,7,5,0.12) 0%,
      rgba(5,7,5,0.38) 40%,
      rgba(5,7,5,0.88) 80%,
      rgba(5,7,5,0.97) 100%
    );
    transition: opacity 0.3s ease;
  }
  .rate-card:hover .rate-card-overlay {
    opacity: 0.92;
  }

  /* Content sits on top */
  .rate-card-body {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    flex: 1;
    padding: 32px;
    gap: 20px;
  }

  .rate-card-top { display: flex; flex-direction: column; gap: 10px; }

  .rate-card-kicker {
    margin: 0;
    color: rgba(255,255,255,0.48);
    font-size: 12px;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }

  .rate-card-heading {
    margin: 0;
    color: #fff;
    font-size: clamp(2rem, 3.8vw, 3rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 0.94;
    transition: letter-spacing 0.3s ease;
  }
  .rate-card:hover .rate-card-heading {
    letter-spacing: -0.025em;
  }

  .rate-card-copy {
    margin: 0;
    color: rgba(255,255,255,0.6);
    font-size: 15px;
    line-height: 1.65;
    max-width: 400px;
    text-wrap: pretty;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    transition: color 0.3s ease;
  }
  .rate-card:hover .rate-card-copy {
    color: rgba(255,255,255,0.72);
  }

  .rate-card-bottom {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Chips */
  .rate-card-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .rate-chip {
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    min-height: 30px;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 99px;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.68);
    font-size: 12px;
    font-weight: 760;
    letter-spacing: 0;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }
  .rate-card:hover .rate-chip {
    background: rgba(255,255,255,0.11);
    border-color: rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.82);
  }

  /* CTA arrow row */
  .rate-card-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: rgba(255,255,255,0.88);
    font-size: 14px;
    font-weight: 820;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    transition: gap 0.25s cubic-bezier(0.22,1,0.36,1), color 0.2s ease;
  }
  .rate-card:hover .rate-card-cta {
    gap: 12px;
    color: #fff;
  }
  .rate-cta-arrow {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
  }
  .rate-card:hover .rate-cta-arrow {
    transform: translateX(3px);
  }

  /* ── FOOTER NOTE ──────────────────────────────────────────────────────────── */
  .rates-footer-note {
    padding-bottom: 100px;
    color: #60706a;
    font-size: 15px;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    animation: ratesFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }
  .rates-inline-link {
    color: #3d6b5e;
    font-weight: 820;
    text-decoration: none;
    border-bottom: 1px solid rgba(61,107,94,0.28);
    transition: border-color 0.18s ease, color 0.18s ease;
  }
  .rates-inline-link:hover {
    color: #2a5248;
    border-color: rgba(61,107,94,0.7);
  }

  /* ── RESPONSIVE ───────────────────────────────────────────────────────────── */
  @media (max-width: 860px) {
    .rates-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .rate-card {
      min-height: clamp(360px, 70vw, 500px);
    }
  }

  @media (max-width: 760px) {
    .rates-root { padding-top: 78px; }
    .rates-shell { width: min(1180px, calc(100% - 36px)); }
    .rates-header { padding: 44px 0 36px; }
    .rates-title { font-size: clamp(2.2rem, 10vw, 3.2rem); }
    .rates-copy { font-size: 16px; }
    .rate-card-body { padding: 22px; }
    .rate-card-heading { font-size: clamp(1.8rem, 8vw, 2.4rem); }
    .rates-footer-note { padding-bottom: 72px; }
  }
`;
