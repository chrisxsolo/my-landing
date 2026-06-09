// ─────────────────────────────────────────────────────────────────────────────
// EVENT PRICING PAGE  →  soloxsnaps.com/pricing/events
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero        — full-bleed dark photo header
//   2. Info cards  — Booking / Coverage flow / Travel
//   3. Package     — Small Event (text left, photo right)
//   4. Package     — Half-Day / Full-Day (photo left, text right)
//   5. CTA strip   — "Ready to book?" at the bottom
//
// ALL SHARED STYLES live in lib/proStyles.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import type { CSSProperties } from "react";
import { anim } from "@/lib/proStyles";
import styles from "@/app/(professional)/pricing/Pricing.module.css";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG, getBookingPolicyItems } from "@/lib/pricingCatalog";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Event Pricing",
  description: "Event photography pricing by Chris Solorzano — Bay Area event coverage.",
  alternates: { canonical: "/pricing/events" },
};

// Package photo sizing → read by Pricing.module.css via CSS custom properties.
const mediaVars = {
  "--pricing-media-h": "580px",
  "--pricing-media-h-mobile": "400px",
  "--pricing-media-pos": "center center",
} as CSSProperties;
const eventPricing = PRICING_CATALOG.events;

// ── ADD-ONS LIST ──────────────────────────────────────────────────────────────
const addOns = [
  eventPricing.addOns.secondShooter,
  eventPricing.addOns.expedited,
  eventPricing.addOns.travel,
];

// ── HALF-DAY / FULL-DAY RATES ─────────────────────────────────────────────────
const largeEventRates = [
  { label: `Half-Day (up to ${eventPricing.largeEvent.halfDayHours} hrs)`, price: formatCurrency(eventPricing.largeEvent.halfDayPrice) },
  { label: "Full-Day", price: `Starting at ${formatCurrency(eventPricing.largeEvent.fullDayStartingPrice)}` },
];

// ── MEDIUM EVENT RATE TABLE ───────────────────────────────────────────────────
const mediumRates = eventPricing.mediumEvent.exampleHours.map((hours) => ({
  hours: `${hours} hours`,
  price: formatCurrency(hours * eventPricing.mediumEvent.hourlyRate),
}));

// ── INFO CARDS ────────────────────────────────────────────────────────────────
const infoCards = [
  {
    heading: "Booking",
    items: getBookingPolicyItems(),
    delay: 0.28,
  },
  {
    heading: "Coverage flow",
    items: [
      "Candid coverage throughout the event.",
      "Group photos and key moments captured.",
      "Edited high-resolution gallery delivered privately.",
    ],
    delay: 0.40,
  },
  {
    heading: "Travel",
    items: [
      `Included within ${eventPricing.includedTravelMiles} miles of San Francisco.`,
      "Beyond local area: custom quote based on mileage, lodging, and logistics.",
    ],
    delay: 0.52,
  },
];

export default async function EventPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const eventImages = images.filter((img) => img.category_slug === "events");

  const primaryImage  = siteSettings.pricing_event_primary_image  || eventImages[0]?.image_url || null;
  const secondaryImage = siteSettings.pricing_event_secondary_image || eventImages[1]?.image_url || primaryImage;

  return (
    <main className={styles.pricingModern} style={mediaVars}>

      {/* ── DARK PHOTO HERO ─────────────────────────────────────────────────── */}
      <section
        className={styles.pricingHeroDark}
      >
        {primaryImage && (
          <div className={styles.pricingHeroPhoto} aria-hidden="true">
            <OptimizedPhoto
              src={primaryImage}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        )}
        <div className={styles.pricingShell}>
          <p className={styles.pricingKicker}>Event pricing</p>

          <h1 className={styles.pricingTitle}>
            Coverage that keeps up with the room.
          </h1>

          <p className={styles.pricingCopy}>
            Candid event photography for reunions, mixers, corporate events, school gatherings, and private celebrations — with edited galleries and a smooth delivery.
          </p>

          <div className={styles.pricingHeroDarkFooter}>
            <div className={styles.pricingHeroPriceBlock}>
              <span className={styles.pricingHeroPriceLabel}>starting at</span>
              <span className={styles.pricingHeroPriceBig}>{formatCurrency(eventPricing.smallEvent.hourlyRate)}</span>
              <span className={styles.pricingHeroPriceUnit}>/ hr</span>
            </div>

            <span className={styles.pricingHeroDivider} aria-hidden="true" />

            <div className={styles.pricingChipRow} style={{ marginTop: 0 }}>
              <span className={styles.pricingChip}>{eventPricing.smallEvent.minimumHours}-hour minimum</span>
              <span className={styles.pricingChip}>Edited gallery</span>
              <span className={styles.pricingChip}>Private online delivery</span>
            </div>

            <Link href="/contact" className={styles.pricingLink}>Inquire about your event</Link>
          </div>
        </div>
      </section>

      {/* ── INFO CARDS ──────────────────────────────────────────────────────── */}
      <section className={`${styles.pricingShell} ${styles.pricingInfoGrid}`} aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className={styles.pricingInfoCard} style={anim.fadeUp(delay)}>
            <h2>{heading}</h2>
            {items.map((item) => <p key={item}>{item}</p>)}
          </div>
        ))}
      </section>

      {/* ── SMALL EVENT PACKAGE ─────────────────────────────────────────────── */}
      <section className={`${styles.pricingShell} ${styles.pricingPackage}`}>
        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>Smaller gatherings</p>
          <h2>Small Event Coverage</h2>
          <p className={styles.pricingCopy}>
            Ideal for intimate events where you want candid moments captured without a large production crew.
          </p>

          <ul>
            {[
              "Candid coverage throughout",
              "Group photos included",
              "Edited high-resolution gallery",
              "Private online delivery",
              eventPricing.smallEvent.turnaroundLabel,
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className={styles.pricingAddons}>
            <p className={styles.pricingKicker}>Add-ons</p>
            {addOns.map(({ label, displayPrice }) => (
              <div key={label} className={styles.pricingRow}>
                <span>{label}</span><span>{displayPrice}</span>
              </div>
            ))}
          </div>

          <div className={styles.pricingInvestment}>
            <div>
              <p className={styles.pricingKicker}>Investment</p>
              <p className={styles.pricingPrice}>{formatCurrency(eventPricing.smallEvent.hourlyRate)}</p>
              <p className={styles.pricingMeta}>per hour · {eventPricing.smallEvent.minimumHours}-hour minimum</p>
            </div>
            <Link href="/contact" className={styles.pricingLink}>Inquire now</Link>
          </div>
        </div>

        {primaryImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={primaryImage}
              alt="Event photography by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 42vw"
            />
          </div>
        )}
      </section>

      {/* ── HALF-DAY / FULL-DAY PACKAGE ─────────────────────────────────────── */}
      <section className={`${styles.pricingShell} ${styles.pricingPackage}`} data-reverse="true">
        {secondaryImage && (
          <div className={styles.pricingPackageMedia}>
            <OptimizedPhoto
              src={secondaryImage}
              alt="Full event coverage by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 38vw"
            />
          </div>
        )}

        <div className={styles.pricingPackageContent}>
          <p className={styles.pricingKicker}>Larger events</p>
          <h2>Half-Day &amp; Full-Day Coverage</h2>
          <p className={styles.pricingCopy}>
            For medium and large events that need sustained coverage, multiple locations, or a second shooter.
          </p>

          {/* Medium event hourly examples */}
          <p className={styles.pricingKicker} style={{ marginBottom: 8 }}>
            Medium event examples ({formatCurrency(eventPricing.mediumEvent.hourlyRate)}/hr · {eventPricing.mediumEvent.minimumHours}-hr min)
          </p>
          <div className={styles.pricingGroupTable}>
            {mediumRates.map(({ hours, price }) => (
              <div key={hours} className={styles.pricingRow}>
                <span>{hours}</span><span>{price}</span>
              </div>
            ))}
          </div>

          {/* Flat rates */}
          <div className={styles.pricingAddons} style={{ marginTop: 24 }}>
            <p className={styles.pricingKicker}>Flat rates</p>
            {largeEventRates.map(({ label, price }) => (
              <div key={label} className={styles.pricingRow}>
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          <p className={styles.pricingNote}>
            Full-day pricing depends on complexity, number of locations, assistant requirements, and delivery timeline.
          </p>

          <div className={styles.pricingInvestment}>
            <Link href="/contact" className={styles.pricingLink}>Get a custom quote</Link>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA STRIP ────────────────────────────────────────────────── */}
      <section className={`${styles.pricingShell} ${styles.pricingCta}`}>
        <div className={styles.pricingCtaPanel}>
          <div>
            <p className={styles.pricingKicker}>Ready to book?</p>
            <h2 className={styles.pricingTitle} style={{ fontSize: 38 }}>Send the date, location, and event type.</h2>
          </div>
          <Link href="/contact" className={styles.pricingLink}>Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
