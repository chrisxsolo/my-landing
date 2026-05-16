// ─────────────────────────────────────────────────────────────────────────────
// COUPLES PRICING PAGE  →  soloxsnaps.com/pricing/couples
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero        — full-bleed dark photo header
//   2. Info cards  — Booking / Session flow / Travel
//   3. Package     — Standard Couples Session (text left, photo right)
//   4. Package     — Engagement Session (photo left, text right)
//   5. Package     — Proposal Coverage (text left, photo right)
//   6. CTA strip   — "Ready for couples photos?" at the bottom
//
// ALL SHARED STYLES live in lib/proStyles.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";

export const metadata: Metadata = {
  title: "Couples Pricing | soloxsnaps",
  description: "Couples, engagement, and proposal photography pricing by Chris Solorzano — Bay Area sessions.",
  alternates: { canonical: "/pricing/couples" },
};

const CSS = pricingCSS({ mediaMinHeight: 580, mediaMinHeightMobile: 400, mediaObjectPosition: "center 30%" });

const addOnsCouples = [
  { label: "Additional outfit",             price: "+$75" },
  { label: "Second nearby location",        price: "+$125" },
  { label: "72-hour expedited delivery",    price: "+$150" },
  { label: "Travel fee (outside SF)",       price: "may apply" },
];

const addOnsEngagement = [
  { label: "Additional outfit",             price: "+$75" },
  { label: "Second nearby location",        price: "+$125" },
  { label: "72-hour expedited delivery",    price: "+$150" },
  { label: "Travel fee (outside SF)",       price: "may apply" },
];

const addOnsProposal = [
  { label: "Extended portrait coverage",    price: "+$150 / hr" },
  { label: "72-hour expedited delivery",    price: "+$150" },
  { label: "Travel fee (outside SF)",       price: "may apply" },
];

const infoCards = [
  {
    heading: "Booking",
    items: [
      "50% deposit to reserve the date. Deposits are non-refundable but transferable.",
      "Contract completed before the session.",
      "Remaining balance due on shoot day.",
    ],
    delay: 0.28,
  },
  {
    heading: "Session flow",
    items: [
      "Guided posing throughout the session.",
      "Location and timing planned before shoot day.",
      "Proposal sessions include pre-shoot coordination.",
    ],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: [
      "Bay Area locations covered.",
      "Locations outside San Francisco may include a $30–$75 travel fee.",
    ],
    delay: 0.52,
  },
];

export default async function CouplesPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const coupleImages = images.filter((img) => img.category_slug === "couples");
  const fallback = images[0]?.image_url ?? null;

  const couplesImage    = siteSettings.pricing_couples_standard_image  || coupleImages[0]?.image_url || fallback;
  const engagementImage = siteSettings.pricing_couples_engagement_image || coupleImages[1]?.image_url || fallback;
  const proposalImage   = siteSettings.pricing_couples_proposal_image   || coupleImages[2]?.image_url || fallback;

  return (
    <main className="pricing-modern">
      <style>{CSS}</style>

      {/* ── DARK PHOTO HERO ─────────────────────────────────────────────────── */}
      <section
        className="pricing-hero-dark"
        style={couplesImage ? { backgroundImage: `url(${couplesImage})` } : {}}
      >
        <div className="pricing-shell">
          <p className="pricing-kicker">Couples pricing</p>

          <h1 className="pricing-title">
            For the moments that are worth remembering exactly as they happened.
          </h1>

          <p className="pricing-copy">
            Couples, engagement, and proposal sessions. Real locations, natural light, and posing that actually feels like you.
          </p>

          <div className="pricing-hero-dark-footer">
            <div className="pricing-hero-price-block">
              <span className="pricing-hero-price-label">from</span>
              <span className="pricing-hero-price-big">$400</span>
            </div>

            <span className="pricing-hero-divider" aria-hidden="true" />

            <div className="pricing-chip-row" style={{ marginTop: 0 }}>
              <span className="pricing-chip">30+ edited images</span>
              <span className="pricing-chip">Guided posing</span>
              <span className="pricing-chip">2-week turnaround</span>
            </div>

            <Link href="/contact" className="pricing-link">Book a session</Link>
          </div>
        </div>
      </section>

      {/* ── INFO CARDS ──────────────────────────────────────────────────────── */}
      <section className="pricing-shell pricing-info-grid" aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className="pricing-info-card" style={anim.fadeUp(delay)}>
            <h2>{heading}</h2>
            {items.map((item) => <p key={item}>{item}</p>)}
          </div>
        ))}
      </section>

      {/* ── STANDARD COUPLES SESSION ────────────────────────────────────────── */}
      <section className="pricing-shell pricing-package">
        <div className="pricing-package-content">
          <p className="pricing-kicker">Couples</p>
          <h2>Standard Couples Session</h2>
          <p className="pricing-copy">
            Relaxed, directed portraits for anniversaries, date-night style shoots, lifestyle portraits, and casual couples photography.
          </p>

          <ul>
            {[
              "1-hour session",
              "1 location",
              "1 outfit",
              "Posing guidance throughout the session",
              "Minimum 30 professionally edited high-resolution images",
              "Private online gallery delivery",
              "2-week turnaround",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOnsCouples.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$400</p>
              <p className="pricing-meta">starting at</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>

        {couplesImage && (
          <div className="pricing-package-media">
            <img src={couplesImage} alt="Couples portrait session" decoding="async" />
          </div>
        )}
      </section>

      {/* ── ENGAGEMENT SESSION ──────────────────────────────────────────────── */}
      <section className="pricing-shell pricing-package" data-reverse="true">
        {engagementImage && (
          <div className="pricing-package-media">
            <img src={engagementImage} alt="Engagement photography session" decoding="async" />
          </div>
        )}

        <div className="pricing-package-content">
          <p className="pricing-kicker">Engagement</p>
          <h2>Engagement Session</h2>
          <p className="pricing-copy">
            Built for engagement announcements, save-the-dates, and romantic editorial portraits that capture the real feeling of the moment.
          </p>

          <ul>
            {[
              "1-hour session",
              "1 location",
              "Up to 2 outfits",
              "Posing guidance throughout",
              "Minimum 40 professionally edited high-resolution images",
              "Private online gallery",
              "2-week turnaround",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOnsEngagement.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$450</p>
              <p className="pricing-meta">starting at</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>
      </section>

      {/* ── PROPOSAL COVERAGE ───────────────────────────────────────────────── */}
      <section className="pricing-shell pricing-package">
        <div className="pricing-package-content">
          <p className="pricing-kicker">Proposals</p>
          <h2>Surprise Proposal Coverage</h2>
          <p className="pricing-copy">
            Discreet coverage for the proposal moment plus a post-proposal portrait session. Planning coordination included so timing and location work perfectly.
          </p>

          <ul>
            {[
              "Discreet proposal coverage",
              "Pre-shoot planning coordination (timing & location recommendations)",
              "Capture of the proposal moment",
              "Post-proposal mini portrait session",
              "Minimum 40 professionally edited high-resolution images",
              "Private online gallery",
              "2-week turnaround",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOnsProposal.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$500</p>
              <p className="pricing-meta">starting at</p>
            </div>
            <Link href="/contact" className="pricing-link">Inquire about proposals</Link>
          </div>
        </div>

        {proposalImage && (
          <div className="pricing-package-media">
            <img src={proposalImage} alt="Surprise proposal photography" decoding="async" />
          </div>
        )}
      </section>

      {/* ── BOTTOM CTA STRIP ────────────────────────────────────────────────── */}
      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready to book?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the date and location.</h2>
          </div>
          <Link href="/contact" className="pricing-link">Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
