// ─────────────────────────────────────────────────────────────────────────────
// MATERNITY PRICING PAGE  →  soloxsnaps.com/pricing/maternity
// ─────────────────────────────────────────────────────────────────────────────
// Same structure as the elopement and family rates pages:
//   1. Hero        — full-bleed dark photo header
//   2. Info cards  — Booking / Session / Travel
//   3. Package     — Maternity Session (text left, photo right)
//   4. Testimonials, CTA strip
//
// Every number comes from PRICING_CATALOG.maternity. Photos are picked from
// maternity-titled portfolio images (lib/pricingPhotos) unless the
// pricing_maternity_* site settings override them.
//
// ALL SHARED STYLES live in app/(professional)/pricing/Pricing.module.css
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import ContextualTestimonials from "@/app/components/ContextualTestimonials";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { getMaternityPricingPhotos, PRICING_PHOTO_SIZES } from "@/lib/pricingPhotos";
import { getContextualTestimonials } from "@/lib/testimonialsData";
import { buildBookingIntentParams } from "@/lib/bookingIntent";
import { anim } from "@/lib/proStyles";
import styles from "@/app/(professional)/pricing/Pricing.module.css";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG, getBookingPolicyItems } from "@/lib/pricingCatalog";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

const maternity = PRICING_CATALOG.maternity;
const TURNAROUND_WEEKS = PRICING_CATALOG.standardTurnaroundDays / 7;
const DURATION_LABEL = `${maternity.durationMinutes / 60}-hour session`;

export const metadata: Metadata = {
  title: "Maternity Photography Pricing",
  description: `San Francisco Bay Area maternity photography by Chris Solorzano: ${formatCurrency(maternity.price)} for a ${DURATION_LABEL} with partner and immediate family included, guided posing, and ${maternity.minimumImages}+ edited images.`,
  alternates: { canonical: "/pricing/maternity" },
};

const mediaVars = {
  "--pricing-media-h": "580px",
  "--pricing-media-h-mobile": "400px",
  "--pricing-media-pos": "center 35%",
} as CSSProperties;

const INQUIRY_HREF = `/contact?${buildBookingIntentParams({
  sourcePage: "maternity-pricing",
  sessionType: "Maternity Session",
}).toString()}`;

const included = [
  DURATION_LABEL,
  `${maternity.locations} location`,
  `${maternity.outfits} outfit`,
  "Partner and immediate family included",
  "Professional posing guidance",
  `Minimum ${maternity.minimumImages} professionally edited images`,
  "Private online gallery",
  `Standard ${TURNAROUND_WEEKS}-week turnaround`,
];

const addOns = [
  { label: maternity.addOns.extraOutfit.label, price: `+${formatCurrency(maternity.addOns.extraOutfit.price)}` },
  { label: maternity.addOns.secondLocation.label, price: `+${formatCurrency(maternity.addOns.secondLocation.price)}` },
  { label: maternity.addOns.expedited.label, price: `+${formatCurrency(maternity.addOns.expedited.price)}` },
  { label: maternity.addOns.travel.label, price: "based on distance" },
];

const infoCards = [
  { heading: "Booking", items: getBookingPolicyItems(), delay: 0.28 },
  {
    heading: "Session",
    items: [
      "Most people book between 28 and 34 weeks.",
      "Posing is guided the whole way, including where to put your hands.",
      "Location and timing are planned around light before shoot day.",
    ],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: [
      "San Francisco locations are included.",
      "Locations outside San Francisco may include a travel fee based on distance.",
    ],
    delay: 0.52,
  },
];

export default async function MaternityPricingPage() {
  const [{ images }, siteSettings, testimonials] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
    getContextualTestimonials({ category: "families", tag: "maternity" }, 2),
  ]);
  const { heroImage, packageImage } = getMaternityPricingPhotos(images, siteSettings);

  return (
    <main className={styles.pricingModern} style={mediaVars}>
      <section className={styles.pricingHeroDark}>
        {heroImage && (
          <div className={styles.pricingHeroPhoto} aria-hidden="true">
            <OptimizedPhoto src={heroImage} alt="" sizes={PRICING_PHOTO_SIZES.hero} priority quality={90} objectPosition="center 35%" />
          </div>
        )}
        <div className={styles.pricingShell}>
          <p className={styles.pricingKicker}>Maternity photography</p>
          <h1 className={styles.pricingTitle}>Calm, guided maternity photos.</h1>
          <p className={styles.pricingCopy}>
            A relaxed, guided session for you, your partner, and the people closest to you, planned around
            soft light and a pace that stays comfortable.
          </p>

          <div className={styles.pricingHeroDarkFooter}>
            <div className={styles.pricingHeroPriceBlock}>
              <span className={styles.pricingHeroPriceLabel}>session</span>
              <span className={styles.pricingHeroPriceBig}>{formatCurrency(maternity.price)}</span>
            </div>
            <span className={styles.pricingHeroDivider} aria-hidden="true" />
            <div className={styles.pricingChipRow} style={{ marginTop: 0 }}>
              <span className={styles.pricingChip}>{DURATION_LABEL}</span>
              <span className={styles.pricingChip}>{maternity.minimumImages}+ edited images</span>
              <span className={styles.pricingChip}>Partner &amp; family included</span>
            </div>
            <Link href={INQUIRY_HREF} className={styles.pricingLink}>Book a Session</Link>
          </div>
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

      <section
        className={`${styles.pricingShell} ${styles.pricingPackage}`}
        style={packageImage ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>One session, everything included</p>
          <h2>{maternity.label}</h2>
          <p className={styles.pricingCopy}>
            For expecting parents who want natural, flattering portraits, with room for a partner, older
            siblings, or a pregnancy announcement.
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
          </div>

          <div className={styles.pricingInvestment}>
            <div>
              <p className={styles.pricingKicker}>Investment</p>
              <p className={styles.pricingPrice}>{formatCurrency(maternity.price)}</p>
              <p className={styles.pricingMeta}>plus any add-ons and travel</p>
            </div>
            <Link href={INQUIRY_HREF} className={styles.pricingLink}>Book This Session</Link>
          </div>
        </div>

        {packageImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={packageImage}
              alt="Bay Area maternity portrait of expecting parents by SoloXSnaps"
              sizes={PRICING_PHOTO_SIZES.package}
              loading="eager"
            />
          </div>
        )}
      </section>

      <ContextualTestimonials
        testimonials={testimonials}
        heading="From families who booked"
        subheading="How the session felt, in their words."
      />

      <section className={`${styles.pricingShell} ${styles.pricingCta}`}>
        <div className={styles.pricingCtaPanel}>
          <div>
            <p className={styles.pricingKicker}>Ready for maternity photos?</p>
            <h2 className={styles.pricingTitle} style={{ fontSize: 38 }}>
              Send your due date, who&rsquo;s joining, and a location you love.
            </h2>
            <p className={styles.pricingCopy}>
              Planning a larger family session instead?{" "}
              <Link href="/pricing/families">See family pricing</Link> or read the{" "}
              <Link href="/family-guide">family photo guide</Link>.
            </p>
          </div>
          <Link href={INQUIRY_HREF} className={styles.pricingLink}>Send Inquiry</Link>
        </div>
      </section>
    </main>
  );
}
