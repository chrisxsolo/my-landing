import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";

export const metadata: Metadata = {
  title: "Grad Pricing | soloxsnaps",
  description: "Graduation photography pricing by Chris Solorzano — Bay Area grad portraits.",
  alternates: { canonical: "/pricing/grads" },
};

const addOns = [
  { label: "Additional outfit", price: "$75" },
  { label: "Second nearby off-campus location", price: "$25" },
  { label: "72-hour expedited delivery", price: "$75" },
  { label: "Celebratory elements", price: "On request" },
  { label: "Extended time", price: "$50 / 30 min" },
];

const groupPricing = [
  { people: "2 people", price: "$300", unit: "per person" },
  { people: "3 people", price: "$275", unit: "per person" },
  { people: "4 people", price: "$250", unit: "per person" },
  { people: "5 people", price: "$225", unit: "per person" },
  { people: "6-8 people", price: "$200", unit: "per person" },
];

const GROUP_GRAD_IMAGE_URL =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/portfolio/1775960037598.jpeg";

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
  .pricing-detail-label,
  .pricing-row,
  .pricing-note {
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
    min-height: 620px;
    overflow: hidden;
    border-radius: 8px;
    background: #dfe8e4;
  }
  .pricing-package-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center top;
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
  .pricing-note {
    margin: 14px 0 0;
    color: #65726d;
    font-size: 14px;
    line-height: 1.65;
  }
  .pricing-group-table {
    display: grid;
    gap: 8px;
    margin-top: 28px;
  }
  .pricing-group-table .pricing-row {
    min-height: 52px;
    align-items: center;
    padding: 0 14px;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
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
      min-height: 420px;
      aspect-ratio: 4 / 5;
    }
    .pricing-row {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .pricing-group-table .pricing-row {
      flex-direction: row;
      align-items: center;
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
        <div>
          <p className="pricing-kicker">Graduation pricing</p>
          <h1 className="pricing-title">For grads who want the gallery to feel as big as the moment.</h1>
          <p className="pricing-copy">
            Campus portraits with clean direction, efficient pacing, and enough room for personality, friend groups, and the little details.
          </p>
        </div>

        <div className="pricing-hero-panel">
          <p className="pricing-kicker">Standard session</p>
          <p className="pricing-price">$350</p>
          <p className="pricing-meta">per hour, private online gallery included</p>
          <div className="pricing-chip-row">
            <span className="pricing-chip">50+ edited images</span>
            <span className="pricing-chip">Guided posing</span>
            <span className="pricing-chip">Two-week turnaround</span>
          </div>
        </div>
      </section>

      <section className="pricing-shell pricing-info-grid" aria-label="Booking details">
        {[
          {
            heading: "Booking",
            items: ["50% deposit to reserve the date.", "Contract completed before the session.", "Remaining balance due on shoot day."],
          },
          {
            heading: "Session flow",
            items: ["Hourly rates.", "Campus route planned around light.", "Session length scales with group size."],
          },
          {
            heading: "Travel",
            items: ["Bay Area campuses covered.", "Locations outside 20 miles from SF may include a $20-$75 travel fee."],
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
              <p className="pricing-meta">per hour</p>
            </div>
            <Link href="/contact" className="pricing-link">
              Book this session
            </Link>
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
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="pricing-group-table">
            {groupPricing.map((row) => (
              <div key={row.people} className="pricing-row">
                <span>{row.people}</span>
                <span>{row.price} {row.unit}</span>
              </div>
            ))}
          </div>
          <p className="pricing-note">
            Sessions with 3 or more graduates require at least 90 minutes to maintain quality and flow.
          </p>

          <div className="pricing-investment">
            <Link href="/contact" className="pricing-link">
              Inquire about group sessions
            </Link>
          </div>
        </div>
      </section>

      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready for grad photos?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the date and campus.</h2>
          </div>
          <Link href="/contact" className="pricing-link">
            Inquire now
          </Link>
        </div>
      </section>
    </main>
  );
}
