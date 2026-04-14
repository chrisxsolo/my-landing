import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";

export const metadata: Metadata = {
  title: "Family Pricing | soloxsnaps",
  description: "Family photography pricing by Chris Solorzano — Bay Area family portraits.",
  alternates: { canonical: "/pricing/families" },
};

const CSS = pricingCSS({ mediaMinHeight: 560, mediaMinHeightMobile: 390, heroPanel: true });

const addOns = [
  { label: "Additional nearby location",  price: "$25" },
  { label: "72-hour expedited delivery",  price: "$75" },
  { label: "Extended family members",     price: "$50-$75" },
  { label: "Additional time",             price: "$100 / 30 min" },
];

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
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const familyImages = images.filter((img) => img.category_slug === "families");
  const sessionImage  = siteSettings.pricing_family_session_image  || familyImages[1]?.image_url || familyImages[0]?.image_url || null;
  const extendedImage = siteSettings.pricing_family_extended_image || familyImages[2]?.image_url || familyImages[0]?.image_url || null;

  return (
    <main className="pricing-modern">
      <style>{CSS}</style>

      <section className="pricing-shell pricing-hero">
        <div>
          <p className="pricing-kicker" style={anim.slideRight()}>Family pricing</p>
          <h1 className="pricing-title" style={anim.fadeUp(0.1)}>Clean family photos without turning the day into a production.</h1>
          <p className="pricing-copy" style={anim.fadeUp(0.2)}>
            Relaxed sessions with enough structure for kids, grandparents, and everyone who says they feel awkward in photos.
          </p>
        </div>
        <div className="pricing-hero-panel" style={anim.fadeUp(0.15)}>
          <p className="pricing-kicker">Starting from</p>
          <p className="pricing-price">$350</p>
          <p className="pricing-meta">private online gallery included</p>
          <div className="pricing-chip-row">
            <span className="pricing-chip">Guided session</span>
            <span className="pricing-chip">Bay Area locations</span>
            <span className="pricing-chip">Family-friendly pacing</span>
          </div>
        </div>
      </section>

      <section className="pricing-shell pricing-info-grid" aria-label="Booking details">
        {infoCards.map(({ heading, items, delay }) => (
          <div key={heading} className="pricing-info-card" style={anim.fadeUp(delay)}>
            <h2>{heading}</h2>
            {items.map((item) => <p key={item}>{item}</p>)}
          </div>
        ))}
      </section>

      <section className="pricing-shell pricing-package">
        <div className="pricing-package-content">
          <p className="pricing-kicker">Quick and clean</p>
          <h2>Family Session</h2>
          <p className="pricing-copy">
            Ideal for families who want updated photos without a long session or overstimulation.
          </p>
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
              <p className="pricing-price">$350</p>
              <p className="pricing-meta">starting from</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>
        {sessionImage && (
          <div className="pricing-package-media">
            <img src={sessionImage} alt="Family portrait" decoding="async" />
          </div>
        )}
      </section>

      <section className="pricing-shell pricing-package" data-reverse="true">
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
              <p className="pricing-meta">starting from</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>
      </section>

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
