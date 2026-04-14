import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";

export const metadata: Metadata = {
  title: "Family Pricing | soloxsnaps",
  description: "Family photography pricing by Chris Solorzano — Bay Area family portraits.",
  alternates: { canonical: "/pricing/families" },
};

const addOns = [
  { label: "Additional nearby location", price: "$25" },
  { label: "72-hour expedited delivery", price: "$75" },
  { label: "Extended family members", price: "$50-$75" },
  { label: "Additional time", price: "$100 / 30 min" },
];

const CSS = `
  .pricing-modern {
    padding-top: 98px;
    background: transparent;
    color: #101412;
  }
  .pricing-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }
  .pricing-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 28px;
    align-items: end;
    padding: 70px 0 34px;
  }
  .pricing-kicker,
  .pricing-chip,
  .pricing-link,
  .pricing-meta,
  .pricing-row {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }
  .pricing-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .pricing-title {
    max-width: 760px;
    margin: 0;
    color: #101412;
    font-size: 58px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .pricing-copy {
    max-width: 620px;
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.72;
    text-wrap: pretty;
  }
  .pricing-hero-panel,
  .pricing-info-card,
  .pricing-package,
  .pricing-cta-panel {
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.07);
  }
  .pricing-hero-panel {
    padding: 16px;
  }
  .pricing-price {
    margin: 0;
    color: #101412;
    font-size: 62px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.92;
  }
  .pricing-meta {
    margin: 10px 0 0;
    color: #60706a;
    font-size: 14px;
    font-weight: 720;
  }
  .pricing-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .pricing-chip {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 11px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
    color: #26312d;
    font-size: 13px;
    font-weight: 760;
  }
  .pricing-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    padding: 24px 0 68px;
  }
  .pricing-info-card {
    padding: 22px;
  }
  .pricing-info-card h2 {
    margin: 0 0 14px;
    color: #101412;
    font-size: 19px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.12;
  }
  .pricing-info-card p {
    margin: 0 0 10px;
    color: #55635e;
    font-size: 15px;
    line-height: 1.62;
  }
  .pricing-package {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr);
    gap: 12px;
    padding: 12px;
    margin-bottom: 18px;
  }
  .pricing-package[data-reverse="true"] {
    grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1fr);
  }
  .pricing-package-content {
    padding: 34px;
    align-self: center;
  }
  .pricing-package-media {
    min-height: 560px;
    overflow: hidden;
    border-radius: 8px;
    background: #dfe8e4;
  }
  .pricing-package-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center;
  }
  .pricing-package h2 {
    margin: 0;
    color: #101412;
    font-size: 42px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .pricing-package ul {
    display: grid;
    gap: 10px;
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
  }
  .pricing-package li {
    position: relative;
    padding-left: 20px;
    color: #4d5a55;
    font-size: 16px;
    line-height: 1.62;
  }
  .pricing-package li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.72em;
    width: 8px;
    height: 8px;
    border-radius: 99px;
    background: #9ab9b2;
  }
  .pricing-addons {
    margin-top: 30px;
    padding-top: 22px;
    border-top: 1px solid rgba(18, 24, 22, 0.1);
  }
  .pricing-row {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(18, 24, 22, 0.08);
    color: #33403b;
    font-size: 15px;
    font-weight: 720;
  }
  .pricing-row span:last-child {
    color: #101412;
    white-space: nowrap;
  }
  .pricing-investment {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 18px;
    margin-top: 30px;
  }
  .pricing-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .pricing-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }
  .pricing-cta {
    padding: 70px 0 110px;
  }
  .pricing-cta-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 28px;
  }
  @media (max-width: 940px) {
    .pricing-hero,
    .pricing-info-grid,
    .pricing-package,
    .pricing-package[data-reverse="true"] {
      grid-template-columns: 1fr;
    }
    .pricing-package[data-reverse="true"] .pricing-package-media {
      order: -1;
    }
  }
  @media (max-width: 760px) {
    .pricing-modern {
      padding-top: 78px;
    }
    .pricing-shell {
      width: min(1180px, calc(100% - 36px));
    }
    .pricing-hero {
      padding-top: 48px;
    }
    .pricing-title {
      font-size: 40px;
      line-height: 1;
    }
    .pricing-copy {
      font-size: 16px;
    }
    .pricing-price {
      font-size: 48px;
    }
    .pricing-info-grid {
      padding-bottom: 52px;
    }
    .pricing-package-content {
      padding: 20px 8px 12px;
    }
    .pricing-package h2 {
      font-size: 32px;
      line-height: 1.02;
    }
    .pricing-package-media {
      min-height: 390px;
      aspect-ratio: 4 / 5;
    }
    .pricing-row {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .pricing-cta {
      padding-bottom: 78px;
    }
    .pricing-cta-panel {
      align-items: flex-start;
      flex-direction: column;
      padding: 22px;
    }
  }
`;

export default async function FamilyPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const familyImages = images.filter((img) => img.category_slug === "families");
  const sessionImage = siteSettings.pricing_family_session_image || familyImages[1]?.image_url || familyImages[0]?.image_url || null;
  const extendedImage = siteSettings.pricing_family_extended_image || familyImages[2]?.image_url || familyImages[0]?.image_url || null;

  return (
    <main className="pricing-modern">
      <style>{CSS}</style>

      <section className="pricing-shell pricing-hero">
        <div>
          <p className="pricing-kicker">Family pricing</p>
          <h1 className="pricing-title">Clean family photos without turning the day into a production.</h1>
          <p className="pricing-copy">
            Relaxed sessions with enough structure for kids, grandparents, and everyone who says they feel awkward in photos.
          </p>
        </div>

        <div className="pricing-hero-panel">
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
        {[
          {
            heading: "Booking",
            items: ["50% deposit to reserve the date.", "Contract completed before the session.", "Remaining balance due after the shoot."],
          },
          {
            heading: "Session flow",
            items: ["Session length depends on the package.", "Kids get time to warm up.", "Location and timing are planned before shoot day."],
          },
          {
            heading: "Travel",
            items: ["Some locations include travel fees.", "Locations outside 20 miles from SF may include a $20-$50 travel fee."],
          },
        ].map(({ heading, items }) => (
          <div key={heading} className="pricing-info-card">
            <h2>{heading}</h2>
            {items.map((item) => (
              <p key={item}>{item}</p>
            ))}
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
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOns.map((item) => (
              <div key={item.label} className="pricing-row">
                <span>{item.label}</span>
                <span>{item.price}</span>
              </div>
            ))}
          </div>

          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$350</p>
              <p className="pricing-meta">starting from</p>
            </div>
            <Link href="/contact" className="pricing-link">
              Book this session
            </Link>
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
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="pricing-addons">
            <p className="pricing-kicker">Add-ons</p>
            {addOns.map((item) => (
              <div key={item.label} className="pricing-row">
                <span>{item.label}</span>
                <span>{item.price}</span>
              </div>
            ))}
          </div>

          <div className="pricing-investment">
            <div>
              <p className="pricing-kicker">Investment</p>
              <p className="pricing-price">$500</p>
              <p className="pricing-meta">starting from</p>
            </div>
            <Link href="/contact" className="pricing-link">
              Book this session
            </Link>
          </div>
        </div>
      </section>

      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready for family photos?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the people, date, and location.</h2>
          </div>
          <Link href="/contact" className="pricing-link">
            Inquire now
          </Link>
        </div>
      </section>
    </main>
  );
}
