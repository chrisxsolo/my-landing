// ─────────────────────────────────────────────────────────────────────────────
// GRAD PRICING PAGE  →  soloxsnaps.com/pricing/grads
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero        — full-bleed dark photo header (like portfolio page)
//   2. Info cards  — Booking / Session flow / Travel
//   3. Package     — Graduation Package (text left, photo right)
//   4. Package     — Group Grad Package (photo left, text right)
//   5. CTA strip   — "Ready for grad photos?" at the bottom
//
// TO CHANGE THE PHOTO SIZES: edit the `mediaVars` object below
//   → --pricing-media-h         desktop photo height
//   → --pricing-media-h-mobile  mobile photo height
//   → --pricing-media-pos       which part of the photo shows (object-position)
//
// ALL SHARED STYLES live in app/(professional)/pricing/Pricing.module.css
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { selectDistinctImageUrl } from "@/lib/photoMetadata";
import { anim } from "@/lib/proStyles";
import styles from "@/app/(professional)/pricing/Pricing.module.css";
import GraduationRateEstimator from "@/app/components/GraduationRateEstimator";
import ContextualTestimonials from "@/app/components/ContextualTestimonials";
import { getContextualTestimonials } from "@/lib/testimonialsData";
import { formatCurrency } from "@/lib/pricing";
import { BOOKING_POLICY, PRICING_CATALOG, getBookingPolicyItems } from "@/lib/pricingCatalog";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

// ── SEO metadata (tab title + Google description) ────────────────────────────
export const metadata: Metadata = {
  title: "Grad Pricing",
  description: "Graduation photography pricing by Chris Solorzano — Bay Area grad portraits.",
  alternates: { canonical: "/pricing/grads" },
};

// ── PACKAGE PHOTO SIZING ─────────────────────────────────────────────────────
// Read by Pricing.module.css (.pricingPackageMedia) via CSS custom properties.
//   --pricing-media-h        → desktop package photo height
//   --pricing-media-h-mobile → mobile photo height
//   --pricing-media-pos      → "center top" keeps faces in frame on portrait crops
const mediaVars = {
  "--pricing-media-h": "620px",
  "--pricing-media-h-mobile": "420px",
  "--pricing-media-pos": "center top",
} as CSSProperties;
const graduationPricing = PRICING_CATALOG.graduation;

// ── ADD-ONS LIST ──────────────────────────────────────────────────────────────
// Shown below the Graduation Package bullet list.
// To add/remove items: edit this array. Format: { label, price }
const addOns = [
  { ...graduationPricing.addOns.extraOutfit, priceLabel: formatCurrency(graduationPricing.addOns.extraOutfit.price) },
  { ...graduationPricing.addOns.secondLocation, priceLabel: formatCurrency(graduationPricing.addOns.secondLocation.price) },
  { ...graduationPricing.addOns.expedited, priceLabel: formatCurrency(graduationPricing.addOns.expedited.price) },
  { ...graduationPricing.addOns.champagne, priceLabel: formatCurrency(graduationPricing.addOns.champagne.price) },
  { ...graduationPricing.addOns.extra30Minutes, priceLabel: `${formatCurrency(graduationPricing.addOns.extra30Minutes.price)} / 30 min` },
];

// ── GROUP PRICING TABLE ───────────────────────────────────────────────────────
// Shown in the Group Grad Package section.
// To change prices: edit price values below.
const groupPricing = [
  { people: "2 people", price: graduationPricing.groupRates[2] },
  { people: "3 people", price: graduationPricing.groupRates[3] },
  { people: "4 people", price: graduationPricing.groupRates[4] },
  { people: "5 people", price: graduationPricing.groupRates[5] },
  { people: "6-8 people", price: graduationPricing.groupRates[6] },
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
    items: getBookingPolicyItems(),
    delay: 0.28,
  },
  {
    heading: "Session flow",
    items: ["Hourly rates.", "Campus route planned around light.", "Session length scales with group size."],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: ["San Francisco locations are included.", "Locations outside San Francisco may include a travel fee based on distance."],
    delay: 0.52,
  },
];

export default async function GradPricingPage() {
  // ── PORTFOLIO IMAGES ────────────────────────────────────────────────────────
  // Images come from Supabase. The page falls back through options until it finds one.
  // To set a specific image: go to Supabase → Table Editor → site_settings
  //   and set pricing_grad_standard_image or pricing_grad_group_image to a photo URL.
  const [{ images }, siteSettings, testimonials] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
    getContextualTestimonials({ category: "grads" }, 2),
  ]);
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
  const heroImage = selectDistinctImageUrl(gradImages, [packageImage, groupImage], packageImage);

  return (
    <main className={styles.pricingModern} style={mediaVars}>
      {/* ── DARK PHOTO HERO ───────────────────────────────────────────────────
           Full-bleed photo background with dark gradient overlay + grain texture.
           Same vibe as the portfolio page hero.
           packageImage (from Supabase) is used as the background.
           Falls back to solid dark if no image.

           TO CHANGE:
             → Background photo: set pricing_grad_standard_image in Supabase site_settings
             → Overlay darkness: adjust rgba values in .pricingHeroDark::before (Pricing.module.css)
             → Hero height:      change clamp() in .pricingHeroDark (Pricing.module.css)
             → Price shown:      find "$350" in the footer row below
             → Chips:            edit the chip spans in the footer row
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
          <p className={styles.pricingKicker}>Graduation pricing</p>

          {/* Big display heading — change text here */}
          <h1 className={styles.pricingTitle}>
            For grads who want the gallery to feel as big as the moment.
          </h1>

          {/* Subtext — change text here */}
          <p className={styles.pricingCopy}>
            Campus portraits with clean direction, efficient pacing, and enough room for personality, friend groups, and the little details.
          </p>

          {/* ── HERO FOOTER: price + chips + book button ────────────────────
               Sits at the very bottom of the dark hero.
               pricingHeroDivider = thin vertical line separator. */}
          <div className={styles.pricingHeroDarkFooter}>
            {/* Price block — change "$350" and "/ hr" here */}
            <div className={styles.pricingHeroPriceBlock}>
              <span className={styles.pricingHeroPriceLabel}>from</span>
              <span className={styles.pricingHeroPriceBig}>{formatCurrency(graduationPricing.baseHourlyRate)}</span>
              <span className={styles.pricingHeroPriceUnit}>/ hr</span>
            </div>

            <span className={styles.pricingHeroDivider} aria-hidden="true" />

            {/* Chips — edit or add/remove spans here */}
            <div className={styles.pricingChipRow} style={{ marginTop: 0 }}>
              <span className={styles.pricingChip}>{graduationPricing.standardMinimumImages}+ edited images</span>
              <span className={styles.pricingChip}>Guided posing</span>
              <span className={styles.pricingChip}>Up to {PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround</span>
            </div>

            {/* CTA button — links to the contact/booking page */}
            <Link href="/contact" className={styles.pricingLink}>Book a session</Link>
          </div>
        </div>
      </section>

      {/* ── INFO CARDS (Booking / Session flow / Travel) ──────────────────────
           Defined in the infoCards array above — edit that to change content.
           style={anim.fadeUp(delay)} staggers each card's entrance animation. */}
      <section className={`${styles.pricingShell} ${styles.pricingInfoGrid}`} aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className={styles.pricingInfoCard} style={anim.fadeUp(delay)}>
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
      <section className={`${styles.pricingShell} ${styles.pricingPackage}`}>
        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>Standard</p>
          <h2>Graduation Package</h2>
          <p className={styles.pricingCopy}>
            Ideal for graduates who want a cohesive, elevated gallery without feeling rushed or over-posed.
          </p>

          {/* What's included list — add/remove items here */}
          <ul>
            {[
              `Approximately ${graduationPricing.durationRules.standardMinutes / 60} hour on campus`,
              "Professionally guided posing and direction throughout",
              "One curated outfit look",
              "Multiple on-campus location selections",
              "Private online gallery",
              `${graduationPricing.standardMinimumImages}+ professionally edited images`,
              `Up to ${PRICING_CATALOG.standardTurnaroundDays / 7}-week standard turnaround`,
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Add-ons list — defined in the addOns array at the top of the file */}
          <div className={styles.pricingAddons}>
            <p className={styles.pricingKicker}>Add-ons</p>
            {addOns.map(({ label, priceLabel }) => (
              <div key={label} className={styles.pricingRow}>
                <span>{label}</span><span>{priceLabel}</span>
              </div>
            ))}
          </div>

          {/* Investment block — change "$350" and "per hour" text here */}
          <div className={styles.pricingInvestment}>
            <div>
              <p className={styles.pricingKicker}>Investment</p>
              <p className={styles.pricingPrice}>{formatCurrency(graduationPricing.baseHourlyRate)}</p>
              <p className={styles.pricingMeta}>per hour</p>
            </div>
            <Link href="/contact" className={styles.pricingLink}>Book this session</Link>
          </div>
        </div>

        {/* Package photo — set via Supabase site_settings.pricing_grad_standard_image */}
        {packageImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={packageImage}
              alt="Graduation portrait by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 42vw"
              objectPosition="center top"
            />
          </div>
        )}
      </section>

      {/* ── GROUP GRAD PACKAGE ────────────────────────────────────────────────
           data-reverse="true" = photo on LEFT, text on RIGHT.
           Group pricing table is defined in the groupPricing array above.
           groupImage comes from Supabase (see image logic above). */}
      <section className={`${styles.pricingShell} ${styles.pricingPackage}`} data-reverse="true">
        {/* Group photo — set via Supabase site_settings.pricing_grad_group_image */}
        {groupImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={groupImage}
              alt="Group graduation portraits by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 38vw"
              objectPosition="center top"
            />
          </div>
        )}

        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>Group sessions</p>
          <h2>Group Grad Package</h2>
          <p className={styles.pricingCopy}>
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
              `${graduationPricing.groupMinimumImagesPerPerson}+ professionally edited images per person`,
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          {/* Group pricing table — defined in groupPricing array above */}
          <div className={styles.pricingGroupTable}>
            {groupPricing.map(({ people, price }) => (
              <div key={people} className={styles.pricingRow}>
                <span>{people}</span><span>{formatCurrency(price)} per person</span>
              </div>
            ))}
          </div>

          {/* Small note below the group table — edit text here */}
          <p className={styles.pricingNote}>
            Sessions with {graduationPricing.durationRules.groupMinimumSize} or more graduates require at least{" "}
            {graduationPricing.durationRules.groupMinimumMinutes} minutes to maintain quality and flow.
          </p>

          <div className={styles.pricingInvestment}>
            <Link href="/contact" className={styles.pricingLink}>Inquire about group sessions</Link>
          </div>
        </div>
      </section>

      {/* ── GRADUATION RATE ESTIMATOR ─────────────────────────────────────────
           Client-side interactive estimate tool.
           Pricing logic lives in lib/pricing.ts — update rates there.
           Component lives in app/components/GraduationRateEstimator.tsx */}
      <section className={styles.pricingShell} style={{ paddingTop: 0, paddingBottom: 64 }}>
        <GraduationRateEstimator />
      </section>

      {/* ── MICRO TRUST CHECKLIST ─────────────────────────────────────────────────
           Subtle trust reinforcement just before the final CTA. */}
      <section className={styles.pricingShell} style={{ paddingTop: 0, paddingBottom: 56 }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 32px",
          justifyContent: "center",
          padding: "22px 28px",
          border: "1px solid rgba(18,24,22,0.08)",
          borderRadius: 12,
          background: "rgba(247,250,248,0.9)",
        }}>
          {[
            "Guided posing — no awkward standing around",
            "Fast communication, clear next steps",
            "Private online gallery delivery",
            "Bay Area campus expertise",
            `${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer to reserve your session`,
          ].map((item) => (
            <span key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#4b5a55" }}>
              <span style={{ color: "#4f6d67", fontWeight: 700 }}>✓</span>
              {item}
            </span>
          ))}
        </div>
      </section>

      <ContextualTestimonials
        testimonials={testimonials}
        heading="Grads who booked a session"
        subheading="Recent graduates on what their campus session was like."
      />

      {/* ── BOTTOM CTA STRIP ──────────────────────────────────────────────────
           The panel at the very bottom before the footer.
           To change the heading text: edit the h2 below.
           style={{ fontSize: 38 }} overrides the default 58px title size. */}
      <section className={`${styles.pricingShell} ${styles.pricingCta}`}>
        <div className={styles.pricingCtaPanel}>
          <div>
            <p className={styles.pricingKicker}>Ready for grad photos?</p>
            <h2 className={styles.pricingTitle} style={{ fontSize: 38 }}>Send the date and campus.</h2>
            <p className={styles.pricingCopy} style={{ marginTop: 10 }}>
              Still planning? The{" "}
              <Link href="/grad-guide" style={{ color: "#3d6b5e", fontWeight: 700 }}>graduation photo guide</Link>{" "}
              covers outfits, posing, prep, and the best campus spots.
            </p>
          </div>
          <Link href="/contact" className={styles.pricingLink}>Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
