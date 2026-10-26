// ─────────────────────────────────────────────────────────────────────────────
// ELOPEMENT PRICING PAGE  →  soloxsnaps.com/pricing/elopements
// ─────────────────────────────────────────────────────────────────────────────
// Same structure as the family and event rates pages:
//   1. Hero        — full-bleed dark photo header
//   2. Info cards  — Booking / Ceremony coverage / Travel
//   3. Package     — Elopement & Courthouse Ceremony (text left, photo right)
//   4. CTA strip
//
// Coverage is advertised as the catalog's 2-hour base (durationMinutes);
// longer coverage is a custom quote and a second location stays inside it.
//
// ALL SHARED STYLES live in app/(professional)/pricing/Pricing.module.css
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { getElopementPricingPhotos, PRICING_PHOTO_SIZES } from "@/lib/pricingPhotos";
import { anim } from "@/lib/proStyles";
import styles from "@/app/(professional)/pricing/Pricing.module.css";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG, getBookingPolicyItems } from "@/lib/pricingCatalog";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Elopement & Courthouse Wedding Photographer",
  description:
    "San Francisco Bay Area elopement and courthouse wedding photography starting at $950. Capture your ceremony, intimate moments, and beautiful portraits with SoloXSnaps.",
  alternates: { canonical: "/pricing/elopements" },
};

// Package photo sizing → read by Pricing.module.css via CSS custom properties.
const mediaVars = {
  "--pricing-media-h": "560px",
  "--pricing-media-h-mobile": "390px",
} as CSSProperties;
const elopementPricing = PRICING_CATALOG.elopement;
// Derived, never typed twice: the catalog owns the number of minutes.
const COVERAGE_HOURS = elopementPricing.durationMinutes / 60;
const COVERAGE_LABEL = `${COVERAGE_HOURS} Hours`;

const addOns = [
  { label: elopementPricing.addOns.extraLocation.label, price: `+${formatCurrency(elopementPricing.addOns.extraLocation.price)}` },
  { label: elopementPricing.addOns.extraCoverage.label, price: elopementPricing.addOns.extraCoverage.displayPrice },
  { label: elopementPricing.addOns.travel.label, price: "Calculated separately" },
];

// Said on the page because it is the question a second stop raises: the $125
// buys another location inside the same window, not more time.
const ADD_ON_NOTE = `An additional location is a second stop within the ${COVERAGE_LABEL.toLowerCase()}, not extra coverage time.`;

const included = [
  `${COVERAGE_LABEL} of coverage`,
  "Coverage of the wedding ceremony",
  "Couple portraits following the ceremony",
  "Immediate family and small-group portraits",
  "Professional posing guidance",
  "Professionally edited, high-resolution photographs",
  "Private online gallery for viewing and downloading images",
  `Minimum ${elopementPricing.minimumImages} professionally edited images`,
  `Standard ${PRICING_CATALOG.standardTurnaroundDays / 7}-week editing turnaround`,
];

const infoCards = [
  { heading: "Booking", items: getBookingPolicyItems(), delay: 0.28 },
  {
    heading: "Ceremony coverage",
    items: [
      `${COVERAGE_LABEL} of coverage, starting at ${formatCurrency(elopementPricing.startingPrice)}.`,
      "Ceremony first, then portraits with the two of you.",
      "Family and small-group photos afterward.",
      "Longer coverage is quoted individually.",
    ],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: [
      "San Francisco locations are included.",
      "Locations outside San Francisco are calculated separately, based on round-trip distance and any bridge toll.",
    ],
    delay: 0.52,
  },
];

export default async function ElopementPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const { heroImage, packageImage } = getElopementPricingPhotos(images, siteSettings);

  return (
    <main className={styles.pricingModern} style={mediaVars}>

      <section className={styles.pricingHeroDark}>
        {heroImage && (
          <div className={styles.pricingHeroPhoto} aria-hidden="true">
            <OptimizedPhoto
              src={heroImage}
              alt=""
              sizes={PRICING_PHOTO_SIZES.hero}
              priority
              quality={90}
              // The shared hero crop sits at 25%, which is sky on a tall
              // portrait. Lower it so the couple is in frame above the overlay.
              objectPosition="center 38%"
            />
          </div>
        )}
        <div className={styles.pricingShell}>
          <p className={styles.pricingKicker}>Elopement photography</p>
          <h1 className={styles.pricingTitle}>
            Courthouse ceremonies and intimate weddings.
          </h1>
          <p className={styles.pricingCopy}>
            Capture the moments that matter most during your intimate wedding celebration. Whether you&rsquo;re
            exchanging vows at a courthouse or celebrating with a small group of loved ones, this package focuses
            on documenting your ceremony, genuine emotions, and beautiful portraits afterward.
          </p>

          <div className={styles.pricingHeroDarkFooter}>
            <div className={styles.pricingHeroPriceBlock}>
              <span className={styles.pricingHeroPriceLabel}>starting at</span>
              <span className={styles.pricingHeroPriceBig}>{formatCurrency(elopementPricing.startingPrice)}</span>
            </div>

            <span className={styles.pricingHeroDivider} aria-hidden="true" />

            <div className={styles.pricingChipRow} style={{ marginTop: 0 }}>
              <span className={styles.pricingChip}>{COVERAGE_LABEL} of coverage</span>
              <span className={styles.pricingChip}>{elopementPricing.minimumImages}+ edited images</span>
              <span className={styles.pricingChip}>{PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround</span>
            </div>

            <Link href="/contact" className={styles.pricingLink}>Send an Elopement Inquiry</Link>
          </div>
          <p className={styles.pricingHeroFineprint}>
            Starting at {formatCurrency(elopementPricing.startingPrice)} for {elopementPricing.durationLabel}. Longer
            coverage is quoted individually.
          </p>
        </div>
      </section>

      <section className={`${styles.pricingShell} ${styles.pricingInfoGrid}`} aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className={styles.pricingInfoCard} style={anim.fadeUp(delay)}>
            <h2>{heading}</h2>
            {items.map((item) => <p key={item}>{item}</p>)}
          </div>
        ))}
      </section>

      {/* One column until there is an elopement photograph to put beside the
          package, so the layout never reserves space for a missing image. */}
      <section
        className={`${styles.pricingShell} ${styles.pricingPackage}`}
        style={packageImage ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>Ceremony and portraits</p>
          <h2>Elopement &amp; Courthouse Ceremony Photography</h2>
          <p className={styles.pricingCopy}>
            Perfect for courthouse weddings, intimate ceremonies, and small elopements. {COVERAGE_LABEL} of coverage,
            starting at {formatCurrency(elopementPricing.startingPrice)}.
          </p>

          <ul>
            {included.map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className={styles.pricingAddons}>
            <p className={styles.pricingKicker}>Add-ons</p>
            {addOns.map(({ label, price }) => (
              <div key={label} className={styles.pricingRow}>
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
            <p className={styles.pricingCopy} style={{ marginTop: 12, fontSize: 14 }}>{ADD_ON_NOTE}</p>
          </div>

          <div className={styles.pricingInvestment}>
            <div>
              <p className={styles.pricingKicker}>Investment</p>
              <p className={styles.pricingPrice}>{formatCurrency(elopementPricing.startingPrice)}</p>
              <p className={styles.pricingMeta}>starting at</p>
            </div>
            <Link href="/contact" className={styles.pricingLink}>Send an Elopement Inquiry</Link>
          </div>
        </div>

        {packageImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={packageImage}
              alt="Bay Area portrait by soloxsnaps"
              sizes={PRICING_PHOTO_SIZES.package}
              loading="eager"
            />
          </div>
        )}
      </section>

      <section className={`${styles.pricingShell} ${styles.pricingCta}`}>
        <div className={styles.pricingCtaPanel}>
          <div>
            <p className={styles.pricingKicker}>Ready to book your ceremony?</p>
            <h2 className={styles.pricingTitle} style={{ fontSize: 38 }}>
              Send your date, ceremony time, and location.
            </h2>
            <p className={styles.pricingCopy}>
              {COVERAGE_LABEL} of coverage starts at {formatCurrency(elopementPricing.startingPrice)}. Tell me if you
              need longer, or want a second nearby spot for portraits, and I&rsquo;ll put a quote together.
            </p>
          </div>
          <Link href="/contact" className={styles.pricingLink}>Send Inquiry</Link>
        </div>
      </section>
    </main>
  );
}
