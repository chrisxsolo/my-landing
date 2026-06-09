// ─────────────────────────────────────────────────────────────────────────────
// RATES LANDING PAGE  →  soloxsnaps.com/pricing
// Two cards (Grads + Families) that link to their respective detail pages.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import styles from "@/app/(professional)/pricing/Pricing.module.css";

const graduationPricing = PRICING_CATALOG.graduation;
const familyPricing = PRICING_CATALOG.families;
const couplesPricing = PRICING_CATALOG.couples;

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Rates",
  description: "Photography pricing by Chris Solorzano — graduation and family sessions in the Bay Area.",
  alternates: { canonical: "/pricing" },
};

const RATES = [
  {
    slug:    "grads",
    href:    "/pricing/grads",
    kicker:  "Graduation photography",
    heading: "Grad rates",
    copy:    `Senior portraits and graduation day coverage. Packages starting from ${formatCurrency(graduationPricing.baseHourlyRate)}/hr with add-ons for groups, extra locations, and rush delivery.`,
    cta:     "See grad pricing",
    chips:   [`From ${formatCurrency(graduationPricing.baseHourlyRate)} / hr`, `${graduationPricing.standardMinimumImages}+ edited images`, "Bay Area locations"],
  },
  {
    slug:    "families",
    href:    "/pricing/families",
    kicker:  "Family photography",
    heading: "Family rates",
    copy:    "Relaxed family sessions with enough structure for everyone — kids, grandparents, and everyone who says they feel awkward in photos.",
    cta:     "See family pricing",
    chips:   [`From ${formatCurrency(familyPricing.packages.standard.price)}`, "Guided session", "Family-friendly pacing"],
  },
  {
    slug:    "couples",
    href:    "/pricing/couples",
    kicker:  "Couples photography",
    heading: "Couples rates",
    copy:    `Anniversary photos, engagement sessions, lifestyle portraits, and proposal coverage. Sessions from ${couplesPricing.packages.mini.durationMinutes} minutes to ${couplesPricing.packages.engagement.durationMinutes}+ minutes across Bay Area locations.`,
    cta:     "See couples pricing",
    chips:   [`From ${formatCurrency(couplesPricing.packages.mini.price)}`, `${couplesPricing.packages.mini.minimumImages}+ edited images`, "Guided posing"],
  },
] as const;

export default async function RatesPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);

  const gradBg    = images.find((i) => i.category_slug === "grads")?.image_url    ?? null;
  const familyBg  =
    siteSettings.pricing_card_families_image
    ?? images.find((i) => i.category_slug === "families")?.image_url
    ?? null;
  const couplesBg =
    images.find((i) => i.category_slug === "couples")?.image_url
    ?? siteSettings.pricing_couples_standard_image
    ?? null;
  const bgMap: Record<string, string | null> = { grads: gradBg, families: familyBg, couples: couplesBg };

  return (
    <main className={styles.ratesRoot}>
      {/* ── PAGE HEADER ───────────────────────────────────────────────────────── */}
      <section className={styles.ratesShell}>
        <div className={styles.ratesHeader}>
          <p className={styles.ratesKicker} style={{ animationDelay: "0.05s" }}>Pricing</p>
          <h1 className={styles.ratesTitle} style={{ animationDelay: "0.14s" }}>
            Choose your session.
          </h1>
          <p className={styles.ratesCopy} style={{ animationDelay: "0.22s" }}>
            Straightforward pricing. No hidden packages or surprise fees — just photography that looks like something.
          </p>
        </div>
      </section>

      {/* ── RATE CARDS GRID ───────────────────────────────────────────────────── */}
      <section className={`${styles.ratesShell} ${styles.ratesGrid}`} aria-label="Session types">
        {RATES.map(({ slug, href, kicker, heading, copy, cta, chips }, i) => {
          const bg = bgMap[slug];
          return (
            <Link
              key={slug}
              href={href}
              className={styles.rateCard}
              style={{ animationDelay: `${0.28 + i * 0.12}s` }}
              aria-label={`View ${heading}`}
            >
              {/* Photo background */}
              {bg && (
                <div
                  className={styles.rateCardBg}
                  aria-hidden="true"
                >
                  <OptimizedPhoto
                    src={bg}
                    alt=""
                    sizes="(max-width: 860px) 100vw, 33vw"
                    quality={85}
                  />
                </div>
              )}

              {/* Gradient overlay — always present */}
              <div className={styles.rateCardOverlay} aria-hidden="true" />

              {/* Text content */}
              <div className={styles.rateCardBody}>
                <div className={styles.rateCardTop}>
                  <p className={styles.rateCardKicker}>{kicker}</p>
                  <h2 className={styles.rateCardHeading}>{heading}</h2>
                  <p className={styles.rateCardCopy}>{copy}</p>
                </div>

                <div className={styles.rateCardBottom}>
                  <div className={styles.rateCardChips}>
                    {chips.map((chip) => (
                      <span key={chip} className={styles.rateChip}>{chip}</span>
                    ))}
                  </div>
                  <span className={styles.rateCardCta}>
                    {cta}
                    <svg className={styles.rateCtaArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
      <section className={`${styles.ratesShell} ${styles.ratesFooterNote}`} style={{ animationDelay: "0.56s" }}>
        <p>
          Questions before booking?{" "}
          <Link href="/contact" className={styles.ratesInlineLink}>Reach out directly →</Link>
        </p>
      </section>
    </main>
  );
}
