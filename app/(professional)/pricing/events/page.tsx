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
import { pricingCSS, anim } from "@/lib/proStyles";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Event Pricing",
  description: "Event photography pricing by Chris Solorzano — Bay Area event coverage.",
  alternates: { canonical: "/pricing/events" },
};

const CSS = pricingCSS({ mediaMinHeight: 580, mediaMinHeightMobile: 400, mediaObjectPosition: "center center" });

// ── ADD-ONS LIST ──────────────────────────────────────────────────────────────
const addOns = [
  { label: "Second shooter",               price: "$100–$150 / hr" },
  { label: "48–72 hour expedited delivery", price: "$250–$500" },
  { label: "Travel beyond 20 miles of SF",  price: "$0.75–$1.00 / mile (round trip)" },
];

// ── HALF-DAY / FULL-DAY RATES ─────────────────────────────────────────────────
const largeEventRates = [
  { label: "Half-Day (up to 5 hrs)",  price: "$2,200" },
  { label: "Full-Day",                price: "Starting at $4,000" },
];

// ── MEDIUM EVENT RATE TABLE ───────────────────────────────────────────────────
const mediumRates = [
  { hours: "4 hours", price: "$1,800" },
  { hours: "5 hours", price: "$2,250" },
  { hours: "6 hours", price: "$2,700" },
];

// ── INFO CARDS ────────────────────────────────────────────────────────────────
const infoCards = [
  {
    heading: "Booking",
    items: [
      "50% deposit to reserve the date. Deposits are non-refundable but transferable.",
      "Contract completed before the event.",
      "Remaining balance due on event day.",
    ],
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
      "Included within 20 miles of San Francisco.",
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
    <main className="pricing-modern">
      <style>{CSS}</style>

      {/* ── DARK PHOTO HERO ─────────────────────────────────────────────────── */}
      <section
        className="pricing-hero-dark"
      >
        {primaryImage && (
          <div className="pricing-hero-photo" aria-hidden="true">
            <OptimizedPhoto
              src={primaryImage}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        )}
        <div className="pricing-shell">
          <p className="pricing-kicker">Event pricing</p>

          <h1 className="pricing-title">
            Coverage that keeps up with the room.
          </h1>

          <p className="pricing-copy">
            Candid event photography for reunions, mixers, corporate events, school gatherings, and private celebrations — with edited galleries and a smooth delivery.
          </p>

          <div className="pricing-hero-dark-footer">
            <div className="pricing-hero-price-block">
              <span className="pricing-hero-price-label">starting at</span>
              <span className="pricing-hero-price-big">$500</span>
              <span className="pricing-hero-price-unit">/ hr</span>
            </div>

            <span className="pricing-hero-divider" aria-hidden="true" />

            <div className="pricing-chip-row" style={{ marginTop: 0 }}>
              <span className="pricing-chip">2-hour minimum</span>
              <span className="pricing-chip">Edited gallery</span>
              <span className="pricing-chip">Private online delivery</span>
            </div>

            <Link href="/contact" className="pricing-link">Inquire about your event</Link>
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

      {/* ── SMALL EVENT PACKAGE ─────────────────────────────────────────────── */}
      <section className="pricing-shell pricing-package">
        <div className="pricing-package-content">
          <p className="pricing-kicker">Smaller gatherings</p>
          <h2>Small Event Coverage</h2>
          <p className="pricing-copy">
            Ideal for intimate events where you want candid moments captured without a large production crew.
          </p>

          <ul>
            {[
              "Candid coverage throughout",
              "Group photos included",
              "Edited high-resolution gallery",
              "Private online delivery",
              "1–2 week standard turnaround",
            ].map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOns.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$500</p>
              <p className="pricing-meta">per hour · 2-hour minimum</p>
            </div>
            <Link href="/contact" className="pricing-link">Inquire now</Link>
          </div>
        </div>

        {primaryImage && (
          <div className="pricing-package-media">
            <OptimizedPhoto
              src={primaryImage}
              alt="Event photography by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 42vw"
            />
          </div>
        )}
      </section>

      {/* ── HALF-DAY / FULL-DAY PACKAGE ─────────────────────────────────────── */}
      <section className="pricing-shell pricing-package" data-reverse="true">
        {secondaryImage && (
          <div className="pricing-package-media">
            <OptimizedPhoto
              src={secondaryImage}
              alt="Full event coverage by soloxsnaps"
              sizes="(max-width: 940px) 90vw, 38vw"
            />
          </div>
        )}

        <div className="pricing-package-content">
          <p className="pricing-kicker">Larger events</p>
          <h2>Half-Day &amp; Full-Day Coverage</h2>
          <p className="pricing-copy">
            For medium and large events that need sustained coverage, multiple locations, or a second shooter.
          </p>

          {/* Medium event hourly examples */}
          <p className="pricing-kicker" style={{ marginBottom: 8 }}>Medium event examples ($450/hr · 4-hr min)</p>
          <div className="pricing-group-table">
            {mediumRates.map(({ hours, price }) => (
              <div key={hours} className="pricing-row">
                <span>{hours}</span><span>{price}</span>
              </div>
            ))}
          </div>

          {/* Flat rates */}
          <div className="pricing-addons" style={{ marginTop: 24 }}>
            <p className="pricing-kicker">Flat rates</p>
            {largeEventRates.map(({ label, price }) => (
              <div key={label} className="pricing-row">
                <span>{label}</span><span>{price}</span>
              </div>
            ))}
          </div>

          <p className="pricing-note">
            Full-day pricing depends on complexity, number of locations, assistant requirements, and delivery timeline.
          </p>

          <div className="pricing-investment">
            <Link href="/contact" className="pricing-link">Get a custom quote</Link>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA STRIP ────────────────────────────────────────────────── */}
      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready to book?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the date, location, and event type.</h2>
          </div>
          <Link href="/contact" className="pricing-link">Inquire now</Link>
        </div>
      </section>
    </main>
  );
}
