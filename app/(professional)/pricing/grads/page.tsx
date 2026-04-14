import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";

export const metadata: Metadata = {
  title: "Grad Pricing | soloxsnaps",
  description: "Graduation photography pricing by Chris Solorzano — Bay Area grad portraits.",
  alternates: { canonical: "/pricing/grads" },
};

const CSS = pricingCSS({ mediaMinHeight: 620, mediaMinHeightMobile: 420, mediaObjectPosition: "center top" });

const addOns = [
  { label: "Additional outfit",                  price: "$75" },
  { label: "Second nearby off-campus location",  price: "$25" },
  { label: "72-hour expedited delivery",          price: "$75" },
  { label: "Celebratory elements",               price: "On request" },
  { label: "Extended time",                      price: "$50 / 30 min" },
];

const groupPricing = [
  { people: "2 people",   price: "$300", unit: "per person" },
  { people: "3 people",   price: "$275", unit: "per person" },
  { people: "4 people",   price: "$250", unit: "per person" },
  { people: "5 people",   price: "$225", unit: "per person" },
  { people: "6-8 people", price: "$200", unit: "per person" },
];

const GROUP_GRAD_IMAGE_URL =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/portfolio/1775960037598.jpeg";

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
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const gradImages = images.filter((img) => img.category_slug === "grads");
  const packageImage = siteSettings.pricing_grad_standard_image || gradImages[1]?.image_url || gradImages[0]?.image_url || null;
  const groupImage =
    siteSettings.pricing_grad_group_image ||
    gradImages.find((img) => img.image_url === GROUP_GRAD_IMAGE_URL)?.image_url ||
    gradImages.find((img) => `${img.title} ${img.alt}`.toLowerCase().includes("group"))?.image_url ||
    gradImages[6]?.image_url ||
    packageImage;

  return (
    <main className="pricing-modern">
      <style>{CSS}</style>

      <section className="pricing-shell pricing-hero">
        <p className="pricing-kicker" style={anim.slideRight()}>Graduation pricing</p>
        <h1 className="pricing-title" style={anim.fadeUp(0.1)}>For grads who want the gallery to feel as big as the moment.</h1>
        <p className="pricing-copy" style={anim.fadeUp(0.2)}>
          Campus portraits with clean direction, efficient pacing, and enough room for personality, friend groups, and the little details.
        </p>
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
          <p className="pricing-kicker">Standard</p>
          <h2>Graduation Package</h2>
          <p className="pricing-copy">
            Ideal for graduates who want a cohesive, elevated gallery without feeling rushed or over-posed.
          </p>
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
              <p className="pricing-meta">per hour</p>
            </div>
            <Link href="/contact" className="pricing-link">Book this session</Link>
          </div>
        </div>
        {packageImage && (
          <div className="pricing-package-media">
            <img src={packageImage} alt="Graduation portrait" decoding="async" />
          </div>
        )}
      </section>

      <section className="pricing-shell pricing-package" data-reverse="true">
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
          <div className="pricing-group-table">
            {groupPricing.map(({ people, price, unit }) => (
              <div key={people} className="pricing-row">
                <span>{people}</span><span>{price} {unit}</span>
              </div>
            ))}
          </div>
          <p className="pricing-note">
            Sessions with 3 or more graduates require at least 90 minutes to maintain quality and flow.
          </p>
          <div className="pricing-investment">
            <Link href="/contact" className="pricing-link">Inquire about group sessions</Link>
          </div>
        </div>
      </section>

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
