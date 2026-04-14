// ─────────────────────────────────────────────────────────────────────────────
// GRAD PRICING PAGE  →  soloxsnaps.com/pricing/grads
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero        — big heading, no side panel
//   2. Info cards  — Booking / Session flow / Travel
//   3. Package     — Graduation Package (text left, photo right)
//   4. Package     — Group Grad Package (photo left, text right)
//   5. CTA strip   — "Ready for grad photos?" at the bottom
//
// TO CHANGE THE PHOTO SIZES:
//   → pricingCSS({ mediaMinHeight: 620 })  ← desktop photo height in px
//   → pricingCSS({ mediaMinHeightMobile: 420 })  ← mobile photo height
//   → pricingCSS({ mediaObjectPosition: "center top" })  ← which part of photo shows
//
// ALL SHARED STYLES live in lib/proStyles.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";

// ── SEO metadata (tab title + Google description) ────────────────────────────
export const metadata: Metadata = {
  title: "Grad Pricing | soloxsnaps",
  description: "Graduation photography pricing by Chris Solorzano — Bay Area grad portraits.",
  alternates: { canonical: "/pricing/grads" },
};

// ── CSS: generated from shared factory in lib/proStyles.ts ───────────────────
// mediaMinHeight    → desktop package photo height (px)
// mediaMinHeightMobile → mobile photo height (px)
// mediaObjectPosition  → "center top" keeps faces in frame on portrait crops
const CSS = pricingCSS({ mediaMinHeight: 620, mediaMinHeightMobile: 420, mediaObjectPosition: "center top" });

// ── ADD-ONS LIST ──────────────────────────────────────────────────────────────
// Shown below the Graduation Package bullet list.
// To add/remove items: edit this array. Format: { label, price }
const addOns = [
  { label: "Additional outfit",                  price: "$75" },
  { label: "Second nearby off-campus location",  price: "$25" },
  { label: "72-hour expedited delivery",          price: "$75" },
  { label: "Celebratory elements",               price: "On request" },
  { label: "Extended time",                      price: "$50 / 30 min" },
];

// ── GROUP PRICING TABLE ───────────────────────────────────────────────────────
// Shown in the Group Grad Package section.
// To change prices: edit price values below.
const groupPricing = [
  { people: "2 people",   price: "$300", unit: "per person" },
  { people: "3 people",   price: "$275", unit: "per person" },
  { people: "4 people",   price: "$250", unit: "per person" },
  { people: "5 people",   price: "$225", unit: "per person" },
  { people: "6-8 people", price: "$200", unit: "per person" },
];

// ── FALLBACK GROUP IMAGE ──────────────────────────────────────────────────────
// If no group image is set in Supabase site_settings, this Supabase Storage URL is used.
// To change: upload a new photo to Supabase Storage and paste the URL here.
const GROUP_GRAD_IMAGE_URL =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/portfolio/1775960037598.jpeg";

// ── INFO CARDS (Booking / Session flow / Travel) ─────────────────────────────
// These are the three cards shown between the hero and the packages.
// To edit text: change heading or items strings.
// delay controls the staggered animation (seconds). Keep increasing by ~0.12.
const infoCards = [
  {
    heading: "Booking",
    items: ["50% deposit to reserve the date.", "Contract completed before the session.", "Remaining balance due on shoot day."],
    delay: 0.28,
  },
  {
    heading: "Session flow",
    items: ["Hourly rates.", "Campus route planned around light.", "Session length scales with group size."],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: ["Bay Area campuses covered.", "Locations outside 20 miles from SF may include a $20-$75 travel fee."],
    delay: 0.52,
  },
];

export default async function GradPricingPage() {
  // ── PORTFOLIO IMAGES ────────────────────────────────────────────────────────
  // Images come from Supabase. The page falls back through options until it finds one.
  // To set a specific image: go to Supabase → Table Editor → site_settings
  //   and set pricing_grad_standard_image or pricing_grad_group_image to a photo URL.
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const gradImages = images.filter((img) => img.category_slug === "grads");

  // packageImage = photo used in the "Graduation Package" section (right column)
  const packageImage = siteSettings.pricing_grad_standard_image || gradImages[1]?.image_url || gradImages[0]?.image_url || null;

  // groupImage = photo used in the "Group Grad Package" section (left column)
  const groupImage =
    siteSettings.pricing_grad_group_image ||
    gradImages.find((img) => img.image_url === GROUP_GRAD_IMAGE_URL)?.image_url ||
    gradImages.find((img) => `${img.title} ${img.alt}`.toLowerCase().includes("group"))?.image_url ||
    gradImages[6]?.image_url ||
    packageImage;

  return (
    <main className="pricing-modern">
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────────
           Full-width, no side panel.
           anim.slideRight() = kicker slides in from left on page load
           anim.fadeUp(0.1)  = title fades up 0.1s after load
           anim.fadeUp(0.2)  = copy fades up 0.2s after load
           To change the heading text: edit the h1 content below. */}
      <section className="pricing-shell pricing-hero">
        <p className="pricing-kicker" style={anim.slideRight()}>Graduation pricing</p>
        <h1 className="pricing-title" style={anim.fadeUp(0.1)}>For grads who want the gallery to feel as big as the moment.</h1>
        <p className="pricing-copy" style={anim.fadeUp(0.2)}>
          Campus portraits with clean direction, efficient pacing, and enough room for personality, friend groups, and the little details.
        </p>
      </section>

      {/* ── INFO CARDS (Booking / Session flow / Travel) ──────────────────────
           Defined in the infoCards array above — edit that to change content.
           style={anim.fadeUp(delay)} staggers each card's entrance animation. */}
      <section className="pricing-shell pricing-info-grid" aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className="pricing-info-card" style={anim.fadeUp(delay)}>
            <h2>{heading}</h2>
            {items.map((item) => <p key={item}>{item}</p>)}
          </div>
        ))}
      </section>

      {/* ── GRADUATION PACKAGE ────────────────────────────────────────────────
           Text on the left, photo on the right.
           To change included items: edit the array in the ul below.
           To change the price: find "$350" below and update both instances.
           packageImage comes from Supabase (see image logic above). */}
      <section className="pricing-shell pricing-package">
        <div className="pricing-package-content">
          <p className="pricing-kicker">Standard</p>
          <h2>Graduation Package</h2>
          <p className="pricing-copy">
            Ideal for graduates who want a cohesive, elevated gallery without feeling rushed or over-posed.
          </p>

          {/* What's included list — add/remove items here */}
          <ul>
            {[
              "Approximately 1 hour on campus",
              "Professionally guided posing and direction throughout",
              "One curated outfit look",
              "Multiple on-campus location selections",
              "Private online gallery",
              "50+ professionally edited images",
              "Standard two-week turnaround",
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

          {/* Investment block — change "$350" and "per hour" text here */}
          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$350</p>
              <p className="pricing-meta">per hour</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>

        {/* Package photo — set via Supabase site_settings.pricing_grad_standard_image */}
        {packageImage && (
          <div className="pricing-package-media">
            <img src={packageImage} alt="Graduation portrait" decoding="async" />
          </div>
        )}
      </section>

      {/* ── GROUP GRAD PACKAGE ────────────────────────────────────────────────
           data-reverse="true" = photo on LEFT, text on RIGHT.
           Group pricing table is defined in the groupPricing array above.
           groupImage comes from Supabase (see image logic above). */}
      <section className="pricing-shell pricing-package" data-reverse="true">
        {/* Group photo — set via Supabase site_settings.pricing_grad_group_image */}
        {groupImage && (
          <div className="pricing-package-media">
            <img src={groupImage} alt="Group graduation portraits" decoding="async" />
          </div>
        )}

        <div className="pricing-package-content">
          <p className="pricing-kicker">Group sessions</p>
          <h2>Group Grad Package</h2>
          <p className="pricing-copy">
            Built for friends who want individual portraits and celebratory group photos in one organized session.
          </p>

          {/* What's included — add/remove items here */}
          <ul>
            {[
              "Individual portraits for each graduate",
              "Multiple group photo combinations",
              "Professionally guided posing and direction",
              "Strategic on-campus location planning",
              "Private online gallery delivery",
              "Professionally edited images per person",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Group pricing table — defined in groupPricing array above */}
          <div className="pricing-group-table">
            {groupPricing.map(({ people, price, unit }) => (
              <div key={people} className="pricing-row">
                <span>{people}</span><span>{price} {unit}</span>
              </div>
            ))}
          </div>

          {/* Small note below the group table — edit text here */}
          <p className="pricing-note">
            Sessions with 3 or more graduates require at least 90 minutes to maintain quality and flow.
          </p>

          <div className="pricing-investment">
            <Link href="/contact" className="pricing-link">Inquire about group sessions</Link>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA STRIP ──────────────────────────────────────────────────
           The panel at the very bottom before the footer.
           To change the heading text: edit the h2 below.
           style={{ fontSize: 38 }} overrides the default 58px title size. */}
      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready for grad photos?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the date and campus.</h2>
          </div>
          <Link href="/contact" className="pricing-link">Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
