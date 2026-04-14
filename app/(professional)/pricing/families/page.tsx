// ─────────────────────────────────────────────────────────────────────────────
// FAMILY PRICING PAGE  →  soloxsnaps.com/pricing/families
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero        — full-bleed dark photo header (same vibe as portfolio + grad pricing)
//   2. Info cards  — Booking / Session flow / Travel
//   3. Package     — Family Session (text left, photo right)
//   4. Package     — Extended Family Session (photo left, text right)
//   5. CTA strip   — "Ready for family photos?" at the bottom
//
// TO CHANGE THE PHOTO SIZES:
//   → pricingCSS({ mediaMinHeight: 560 })  ← desktop photo height in px
//   → pricingCSS({ mediaMinHeightMobile: 390 })  ← mobile photo height
//   → heroPanel: true keeps the 2-column hero with the $350 side panel
//
// ALL SHARED STYLES live in lib/proStyles.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";

// ── SEO metadata (tab title + Google description) ────────────────────────────
export const metadata: Metadata = {
  title: "Family Pricing | soloxsnaps",
  description: "Family photography pricing by Chris Solorzano — Bay Area family portraits.",
  alternates: { canonical: "/pricing/families" },
};

// ── CSS: generated from shared factory in lib/proStyles.ts ───────────────────
// heroPanel: false  → no 2-column hero grid (dark hero handles layout now)
// mediaMinHeight    → desktop package photo height (px)
// mediaMinHeightMobile → mobile photo height (px)
const CSS = pricingCSS({ mediaMinHeight: 560, mediaMinHeightMobile: 390 });

// ── ADD-ONS LIST ──────────────────────────────────────────────────────────────
// Shown below each package's bullet list.
// To add/remove items: edit this array. Format: { label, price }
const addOns = [
  { label: "Additional nearby location",  price: "$25" },
  { label: "72-hour expedited delivery",  price: "$75" },
  { label: "Extended family members",     price: "$50-$75" },
  { label: "Additional time",             price: "$100 / 30 min" },
];

// ── INFO CARDS (Booking / Session flow / Travel) ─────────────────────────────
// The three cards shown between the hero and the packages.
// To edit: change heading or items strings.
// delay controls the staggered animation (seconds).
const infoCards = [
  {
    heading: "Booking",
    items: ["50% deposit to reserve the date.", "Contract completed before the session.", "Remaining balance due after the shoot."],
    delay: 0.28,
  },
  {
    heading: "Session flow",
    items: ["Session length depends on the package.", "Kids get time to warm up.", "Location and timing are planned before shoot day."],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: ["Some locations include travel fees.", "Locations outside 20 miles from SF may include a $20-$50 travel fee."],
    delay: 0.52,
  },
];

export default async function FamilyPricingPage() {
  // ── PORTFOLIO IMAGES ────────────────────────────────────────────────────────
  // Images come from Supabase. Falls back through options until it finds one.
  // To set a specific image: go to Supabase → Table Editor → site_settings
  //   and set pricing_family_session_image or pricing_family_extended_image to a URL.
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const familyImages = images.filter((img) => img.category_slug === "families");

  // sessionImage  = photo in the "Family Session" package (right column)
  const sessionImage  = siteSettings.pricing_family_session_image  || familyImages[1]?.image_url || familyImages[0]?.image_url || null;
  // extendedImage = photo in the "Extended Family Session" package (left column)
  const extendedImage = siteSettings.pricing_family_extended_image || familyImages[2]?.image_url || familyImages[0]?.image_url || null;

  return (
    <main className="pricing-modern">
      <style>{CSS}</style>

      {/* ── DARK PHOTO HERO ───────────────────────────────────────────────────
           Full-bleed photo background with dark gradient overlay + grain texture.
           Same vibe as the portfolio page and grad pricing hero.
           sessionImage (from Supabase) is used as the background.
           Falls back to solid dark if no image.

           TO CHANGE:
             → Background photo: set pricing_family_session_image in Supabase site_settings
             → Overlay darkness: adjust rgba values in .pricing-hero-dark::before (proStyles.ts)
             → Hero height:      change clamp() in .pricing-hero-dark (proStyles.ts)
             → Starting price:   find "$350" in the footer row below
             → Chips:            edit the pricing-chip spans in the footer row
             → Heading text:     edit the h1 below */}
      <section
        className="pricing-hero-dark"
        style={sessionImage ? { backgroundImage: `url(${sessionImage})` } : {}}
      >
        <div className="pricing-shell">
          {/* Small eyebrow label — change text here */}
          <p className="pricing-kicker">Family pricing</p>

          {/* Big display heading — change text here */}
          <h1 className="pricing-title">
            Clean family photos without turning the day into a production.
          </h1>

          {/* Subtext — change text here */}
          <p className="pricing-copy">
            Relaxed sessions with enough structure for kids, grandparents, and everyone who says they feel awkward in photos.
          </p>

          {/* ── HERO FOOTER: price + chips + book button ────────────────────
               Sits at the very bottom of the dark hero.
               To remove divider: delete the span.pricing-hero-divider. */}
          <div className="pricing-hero-dark-footer">
            {/* Starting price — change "$350" and label here */}
            <div className="pricing-hero-price-block">
              <span className="pricing-hero-price-label">starting from</span>
              <span className="pricing-hero-price-big">$350</span>
            </div>

            <span className="pricing-hero-divider" aria-hidden="true" />

            {/* Chips — edit or add/remove spans here */}
            <div className="pricing-chip-row" style={{ marginTop: 0 }}>
              <span className="pricing-chip">Guided session</span>
              <span className="pricing-chip">Bay Area locations</span>
              <span className="pricing-chip">Family-friendly pacing</span>
            </div>

            {/* CTA button — links to the contact/booking page */}
            <Link href="/contact" className="pricing-link">Book a session</Link>
          </div>
        </div>
      </section>

      {/* ── INFO CARDS (Booking / Session flow / Travel) ──────────────────────
           Defined in the infoCards array above — edit that to change content. */}
      <section className="pricing-shell pricing-info-grid" aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className="pricing-info-card" style={anim.fadeUp(delay)}>
            <h2>{heading}</h2>
            {items.map((item) => <p key={item}>{item}</p>)}
          </div>
        ))}
      </section>

      {/* ── FAMILY SESSION PACKAGE ────────────────────────────────────────────
           Text on the left, photo on the right.
           To change included items: edit the array in the ul below.
           To change the price: find "$350" and update.
           sessionImage comes from Supabase (see image logic above). */}
      <section className="pricing-shell pricing-package">
        <div className="pricing-package-content">
          <p className="pricing-kicker">Quick and clean</p>
          <h2>Family Session</h2>
          <p className="pricing-copy">
            Ideal for families who want updated photos without a long session or overstimulation.
          </p>

          {/* What's included — add/remove items here */}
          <ul>
            {[
              "Up to 30 minutes",
              "One location",
              "Guided, relaxed session",
              "Minimum 10 professionally edited images",
              "Private online gallery",
              "Standard turnaround",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Add-ons list — defined in the addOns array at the top of the file */}
          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOns.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          {/* Investment block — change "$350" and "starting from" here */}
          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$350</p>
              <p className="pricing-meta">starting from</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>

        {/* Session photo — set via Supabase site_settings.pricing_family_session_image */}
        {sessionImage && (
          <div className="pricing-package-media">
            <img src={sessionImage} alt="Family portrait" decoding="async" />
          </div>
        )}
      </section>

      {/* ── EXTENDED FAMILY SESSION PACKAGE ───────────────────────────────────
           data-reverse="true" = photo on LEFT, text on RIGHT.
           extendedImage comes from Supabase (see image logic above).
           To change the price: find "$500" below and update. */}
      <section className="pricing-shell pricing-package" data-reverse="true">
        {/* Extended session photo — set via Supabase site_settings.pricing_family_extended_image */}
        {extendedImage && (
          <div className="pricing-package-media">
            <img src={extendedImage} alt="Extended family portrait" decoding="async" />
          </div>
        )}

        <div className="pricing-package-content">
          <p className="pricing-kicker">More breathing room</p>
          <h2>Extended Family Session</h2>
          <p className="pricing-copy">
            Best for larger families, younger kids, or anyone who wants more variety and flexibility.
          </p>

          {/* What's included — add/remove items here */}
          <ul>
            {[
              "Up to 60 minutes",
              "One location",
              "More time for kids to warm up",
              "Greater variety of groupings and moments",
              "Minimum 30 professionally edited images",
              "Private online gallery",
              "Standard turnaround",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Add-ons list — same list used for both packages */}
          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOns.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          {/* Investment block — change "$500" and "starting from" here */}
          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$500</p>
              <p className="pricing-meta">starting from</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA STRIP ──────────────────────────────────────────────────
           The panel at the very bottom before the footer.
           To change the heading: edit the h2 below. */}
      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready for family photos?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the people, date, and location.</h2>
          </div>
          <Link href="/contact" className="pricing-link">Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
