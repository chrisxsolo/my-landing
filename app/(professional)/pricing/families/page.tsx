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
// TO CHANGE THE PHOTO SIZES: edit the `mediaVars` object below
//   → --pricing-media-h         desktop photo height
//   → --pricing-media-h-mobile  mobile photo height
//
// ALL SHARED STYLES live in app/(professional)/pricing/Pricing.module.css
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import type { CSSProperties } from "react";
import { selectDistinctImageUrl } from "@/lib/photoMetadata";
import { anim } from "@/lib/proStyles";
import styles from "@/app/(professional)/pricing/Pricing.module.css";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG, getBookingPolicyItems } from "@/lib/pricingCatalog";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

// ── SEO metadata (tab title + Google description) ────────────────────────────
export const metadata: Metadata = {
  title: "Family Pricing",
  description: "Family photography pricing by Chris Solorzano — Bay Area family portraits.",
  alternates: { canonical: "/pricing/families" },
};

// ── PACKAGE PHOTO SIZING ─────────────────────────────────────────────────────
// Read by Pricing.module.css (.pricingPackageMedia) via CSS custom properties.
const mediaVars = {
  "--pricing-media-h": "560px",
  "--pricing-media-h-mobile": "390px",
} as CSSProperties;
const familyPricing = PRICING_CATALOG.families;

// ── ADD-ONS LIST ──────────────────────────────────────────────────────────────
// Shown below each package's bullet list.
// To add/remove items: edit this array. Format: { label, price }
const addOns = [
  familyPricing.addOns.extraLocation,
  familyPricing.addOns.expedited,
  familyPricing.addOns.extendedFamily,
  familyPricing.addOns.extra30Minutes,
];

// ── INFO CARDS (Booking / Session flow / Travel) ─────────────────────────────
// The three cards shown between the hero and the packages.
// To edit: change heading or items strings.
// delay controls the staggered animation (seconds).
const infoCards = [
  {
    heading: "Booking",
    items: getBookingPolicyItems(),
    delay: 0.28,
  },
  {
    heading: "Session flow",
    items: ["Session length depends on the package.", "Kids get time to warm up.", "Location and timing are planned before shoot day."],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: ["San Francisco locations are included.", "Locations outside San Francisco may include a travel fee based on distance."],
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
  const heroImage = selectDistinctImageUrl(familyImages, [sessionImage, extendedImage], sessionImage);

  return (
    <main className={styles.pricingModern} style={mediaVars}>

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
        className={styles.pricingHeroDark}
      >
        {heroImage && (
          <div className={styles.pricingHeroPhoto} aria-hidden="true">
            <OptimizedPhoto
              src={heroImage}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        )}
        <div className={styles.pricingShell}>
          {/* Small eyebrow label — change text here */}
          <p className={styles.pricingKicker}>Family pricing</p>

          {/* Big display heading — change text here */}
          <h1 className={styles.pricingTitle}>
            Clean family photos without turning the day into a production.
          </h1>

          {/* Subtext — change text here */}
          <p className={styles.pricingCopy}>
            Relaxed sessions with enough structure for kids, grandparents, and everyone who says they feel awkward in photos.
          </p>

          {/* ── HERO FOOTER: price + chips + book button ────────────────────
               Sits at the very bottom of the dark hero.
               To remove divider: delete the span.pricing-hero-divider. */}
          <div className={styles.pricingHeroDarkFooter}>
            {/* Starting price — change "$350" and label here */}
            <div className={styles.pricingHeroPriceBlock}>
              <span className={styles.pricingHeroPriceLabel}>starting from</span>
              <span className={styles.pricingHeroPriceBig}>{formatCurrency(familyPricing.packages.standard.price)}</span>
            </div>

            <span className={styles.pricingHeroDivider} aria-hidden="true" />

            {/* Chips — edit or add/remove spans here */}
            <div className={styles.pricingChipRow} style={{ marginTop: 0 }}>
              <span className={styles.pricingChip}>Guided session</span>
              <span className={styles.pricingChip}>Bay Area locations</span>
              <span className={styles.pricingChip}>Family-friendly pacing</span>
            </div>

            {/* CTA button — links to the contact/booking page */}
            <Link href="/contact" className={styles.pricingLink}>Book a session</Link>
          </div>
        </div>
      </section>

      {/* ── INFO CARDS (Booking / Session flow / Travel) ──────────────────────
           Defined in the infoCards array above — edit that to change content. */}
      <section className={`${styles.pricingShell} ${styles.pricingInfoGrid}`} aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className={styles.pricingInfoCard} style={anim.fadeUp(delay)}>
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
      <section className={`${styles.pricingShell} ${styles.pricingPackage}`}>
        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>Quick and clean</p>
          <h2>Family Session</h2>
          <p className={styles.pricingCopy}>
            Ideal for families who want updated photos without a long session or overstimulation.
          </p>

          {/* What's included — add/remove items here */}
          <ul>
            {[
              `Up to ${familyPricing.packages.standard.durationMinutes} minutes`,
              "One location",
              "Guided, relaxed session",
              `Minimum ${familyPricing.packages.standard.minimumImages} professionally edited images`,
              "Private online gallery",
              `Up to ${PRICING_CATALOG.standardTurnaroundDays / 7}-week standard turnaround`,
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Add-ons list — defined in the addOns array at the top of the file */}
          <div className={styles.pricingAddons}>
            <p className={styles.pricingKicker}>Add-ons</p>
            {addOns.map(({ label, displayPrice }) => (
              <div key={label} className={styles.pricingRow}>
                <span>{label}</span><span>{displayPrice}</span>
              </div>
            ))}
          </div>

          {/* Investment block — change "$350" and "starting from" here */}
          <div className={styles.pricingInvestment}>
            <div>
              <p className={styles.pricingKicker}>Investment</p>
              <p className={styles.pricingPrice}>{formatCurrency(familyPricing.packages.standard.price)}</p>
              <p className={styles.pricingMeta}>starting from</p>
            </div>
            <Link href="/contact" className={styles.pricingLink}>Book this session</Link>
          </div>
        </div>

        {/* Session photo — set via Supabase site_settings.pricing_family_session_image */}
        {sessionImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={sessionImage}
              alt="Bay Area family portrait by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 42vw"
            />
          </div>
        )}
      </section>

      {/* ── EXTENDED FAMILY SESSION PACKAGE ───────────────────────────────────
           data-reverse="true" = photo on LEFT, text on RIGHT.
           extendedImage comes from Supabase (see image logic above).
           To change the price: find "$500" below and update. */}
      <section className={`${styles.pricingShell} ${styles.pricingPackage}`} data-reverse="true">
        {/* Extended session photo — set via Supabase site_settings.pricing_family_extended_image */}
        {extendedImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={extendedImage}
              alt="Extended family portrait by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 38vw"
            />
          </div>
        )}

        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>More breathing room</p>
          <h2>Extended Family Session</h2>
          <p className={styles.pricingCopy}>
            Best for larger families, younger kids, or anyone who wants more variety and flexibility.
          </p>

          {/* What's included — add/remove items here */}
          <ul>
            {[
              `Up to ${familyPricing.packages.extended.durationMinutes} minutes`,
              "One location",
              "More time for kids to warm up",
              "Greater variety of groupings and moments",
              `Minimum ${familyPricing.packages.extended.minimumImages} professionally edited images`,
              "Private online gallery",
              `Up to ${PRICING_CATALOG.standardTurnaroundDays / 7}-week standard turnaround`,
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Add-ons list — same list used for both packages */}
          <div className={styles.pricingAddons}>
            <p className={styles.pricingKicker}>Add-ons</p>
            {addOns.map(({ label, displayPrice }) => (
              <div key={label} className={styles.pricingRow}>
                <span>{label}</span><span>{displayPrice}</span>
              </div>
            ))}
          </div>

          {/* Investment block — change "$500" and "starting from" here */}
          <div className={styles.pricingInvestment}>
            <div>
              <p className={styles.pricingKicker}>Investment</p>
              <p className={styles.pricingPrice}>{formatCurrency(familyPricing.packages.extended.price)}</p>
              <p className={styles.pricingMeta}>starting from</p>
            </div>
            <Link href="/contact" className={styles.pricingLink}>Book this session</Link>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA STRIP ──────────────────────────────────────────────────
           The panel at the very bottom before the footer.
           To change the heading: edit the h2 below. */}
      <section className={`${styles.pricingShell} ${styles.pricingCta}`}>
        <div className={styles.pricingCtaPanel}>
          <div>
            <p className={styles.pricingKicker}>Ready for family photos?</p>
            <h2 className={styles.pricingTitle} style={{ fontSize: 38 }}>Send the people, date, and location.</h2>
          </div>
          <Link href="/contact" className={styles.pricingLink}>Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
