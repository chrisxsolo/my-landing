import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";
import CouplesRateEstimator from "@/app/components/CouplesRateEstimator";

export const metadata: Metadata = {
  title: "Couples Photography Pricing | SoloXSnaps",
  description:
    "Bay Area couples photography pricing by Chris Solorzano — engagement sessions, proposal coverage, anniversary photos, and lifestyle portraits in San Francisco and beyond.",
  alternates: { canonical: "/pricing/couples" },
};

const CSS = pricingCSS({ mediaMinHeight: 580, mediaMinHeightMobile: 400, mediaObjectPosition: "center 30%" });

const packages = [
  {
    kicker: "Mini session",
    name: "30-Minute Couples Mini Session",
    price: "$350",
    bestFor: "Quick anniversary photos, casual lifestyle portraits, and couples who want a shorter session.",
    items: ["30 minute session", "1 location", "1 outfit", "Posing guidance throughout", "Private online gallery", "Minimum 25 professionally edited images", "Standard 2-week turnaround"],
  },
  {
    kicker: "Standard",
    name: "1-Hour Couples Session",
    price: "$450",
    bestFor: "Couples who want more variety, more posing options, and a fuller gallery.",
    items: ["1 hour session", "1 location", "1–2 outfits", "Posing guidance throughout", "More candid, romantic, and lifestyle image variety", "Private online gallery", "Minimum 40 professionally edited images", "Standard 2-week turnaround"],
  },
  {
    kicker: "Signature",
    name: "Couples Signature Session",
    price: "$575",
    bestFor: "Couples who want more time, more creative direction, and a larger final gallery.",
    items: ["75–90 minute session", "1 location", "Up to 2 outfits", "More posing variety and movement-based prompts", "Candid, romantic, and editorial-style images", "Private online gallery", "Minimum 60 professionally edited images", "Standard 2-week turnaround"],
  },
  {
    kicker: "Engagement",
    name: "Engagement Session",
    price: "$650",
    bestFor: "Save-the-dates, wedding websites, announcements, and a more intentional couples session experience.",
    items: ["90 minute session", "1–2 nearby locations", "Up to 2 outfits", "Location planning support", "Posing guidance throughout", "Private online gallery", "Minimum 70 professionally edited images", "Standard 2-week turnaround"],
  },
  {
    kicker: "Proposals",
    name: "Proposal Session",
    price: "$750+",
    bestFor: "Surprise proposals and romantic portraits afterward — planning and coordination included.",
    items: ["Planning and coordination before the session", "Location and timing guidance", "Surprise proposal coverage", "Portraits after the proposal", "Private online gallery", "Minimum 50 professionally edited images", "Standard 2-week turnaround"],
  },
] as const;

const addOns = [
  { label: "Additional nearby location",                       price: "+$125" },
  { label: "Additional outfit",                                price: "+$75" },
  { label: "Extra 30 minutes",                                 price: "+$175" },
  { label: "Client proofing gallery",                          price: "+$75" },
  { label: "Rush preview — 5 edited images within 48 hours",   price: "+$75" },
  { label: "Expedited full gallery delivery within 72 hours",  price: "+$150" },
  { label: "Short-form video / BTS reel",                      price: "$175+" },
  { label: "Advanced retouching",                              price: "$25 / image" },
  { label: "Travel outside San Francisco",                     price: "based on distance" },
] as const;

const infoCards = [
  { heading: "Booking",      items: ["50% deposit to reserve the date. Deposits are non-refundable but transferable.", "Contract completed before the session.", "Remaining balance due on shoot day."],                                                  delay: 0.28 },
  { heading: "Session flow", items: ["Guided posing throughout every session.", "Location and timing planned before shoot day.", "Proposal sessions include pre-shoot coordination."],                                                                   delay: 0.40 },
  { heading: "Travel",       items: ["Bay Area locations covered.", "Locations outside San Francisco may include a travel fee based on distance."],                                                                                                      delay: 0.52 },
] as const;

export default async function CouplesPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const coupleImages = images.filter((img) => img.category_slug === "couples");
  const fallback = images[0]?.image_url ?? null;
  const heroImage = siteSettings.pricing_couples_standard_image || coupleImages[0]?.image_url || fallback;

  return (
    <main className="pricing-modern">
      <style>{CSS + COUPLES_CSS}</style>

      <section className="pricing-hero-dark" style={heroImage ? { backgroundImage: `url(${heroImage})` } : {}}>
        <div className="pricing-shell">
          <p className="pricing-kicker">Couples photography</p>
          <h1 className="pricing-title">Real moments. Real locations. Photos that actually feel like you.</h1>
          <p className="pricing-copy">
            Bay Area couples photography for anniversaries, engagement sessions, lifestyle portraits, and proposal coverage. From a quick 30-minute session to a full engagement experience.
          </p>
          <div className="pricing-hero-dark-footer">
            <div className="pricing-hero-price-block">
              <span className="pricing-hero-price-label">from</span>
              <span className="pricing-hero-price-big">$350</span>
            </div>
            <span className="pricing-hero-divider" aria-hidden="true" />
            <div className="pricing-chip-row" style={{ marginTop: 0 }}>
              <span className="pricing-chip">25+ edited images</span>
              <span className="pricing-chip">Guided posing</span>
              <span className="pricing-chip">2-week turnaround</span>
            </div>
            <Link href="/contact" className="pricing-link">Inquire About a Couples Session</Link>
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

      <section className="pricing-shell couples-intro">
        <h2 className="couples-intro-heading">Couples Photography</h2>
        <p className="couples-intro-copy">
          Whether you're celebrating an anniversary, looking for romantic lifestyle portraits around San Francisco, planning engagement photos for your save-the-dates, or setting up a surprise proposal, I offer couples photography sessions designed around your timeline and vision. All sessions take place in real Bay Area locations — parks, waterfront spots, urban neighborhoods, and beyond. Every package includes guided posing so you're never standing there guessing what to do with your hands.
        </p>
        <p className="couples-intro-copy" style={{ marginTop: 14 }}>
          I usually recommend scheduling closer to sunset when possible for the best lighting, but timing can depend on the location and overall session plan.
        </p>
      </section>

      <section className="pricing-shell couples-grid" aria-label="Couples session packages">
        {packages.map(({ kicker, name, price, bestFor, items }) => (
          <div key={name} className="couples-card">
            <div className="couples-card-header">
              <p className="pricing-kicker" style={{ marginBottom: 8 }}>{kicker}</p>
              <h3 className="couples-card-name">{name}</h3>
              <p className="couples-card-price">{price}</p>
            </div>
            <p className="couples-card-best-for"><strong>Best for:</strong> {bestFor}</p>
            <ul className="couples-card-list">
              {items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="couples-card-cta">
              <Link href="/contact" className="pricing-link couples-card-link">Inquire About a Couples Session</Link>
            </div>
          </div>
        ))}
      </section>

      <section className="pricing-shell couples-addons-section">
        <p className="pricing-kicker">Add-ons</p>
        <h2 className="couples-addons-heading">Customize your session</h2>
        <div className="couples-addons-grid">
          {addOns.map(({ label, price }) => (
            <div key={label} className="pricing-row">
              <span>{label}</span><span>{price}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-shell" style={{ paddingTop: 0, paddingBottom: 64 }}>
        <CouplesRateEstimator />
      </section>

      <section className="pricing-shell pricing-cta">
        <div className="pricing-cta-panel">
          <div>
            <p className="pricing-kicker">Ready for couples photos?</p>
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Send the date and location.</h2>
          </div>
          <Link href="/contact" className="pricing-link">Book Your Couples Session</Link>
        </div>
      </section>
    </main>
  );
}

const COUPLES_CSS = `
  .couples-intro { padding: 56px 0 40px; }
  .couples-intro-heading { margin: 0 0 20px; color: #101412; font-size: 34px; font-weight: 880; line-height: 1.02; letter-spacing: 0; }
  .couples-intro-copy { max-width: 720px; margin: 0; color: #4b5a55; font-size: 17px; line-height: 1.72; text-wrap: pretty; font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif; }

  .couples-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding-bottom: 56px; }

  .couples-card {
    display: flex; flex-direction: column; gap: 18px; padding: 28px;
    border: 1px solid rgba(18,24,22,0.1); border-radius: 8px; background: rgba(255,255,255,0.76);
    box-shadow: 0 14px 34px rgba(18,24,22,0.07);
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease;
  }
  .couples-card:hover { transform: translateY(-4px); box-shadow: 0 20px 44px rgba(18,24,22,0.1); border-color: rgba(18,24,22,0.16); }

  .couples-card-header { display: flex; flex-direction: column; padding-bottom: 18px; border-bottom: 1px solid rgba(18,24,22,0.08); }
  .couples-card-name { margin: 0 0 10px; color: #101412; font-size: 21px; font-weight: 860; line-height: 1.14; letter-spacing: 0; }
  .couples-card-price { margin: 0; color: #101412; font-size: 44px; font-weight: 880; letter-spacing: -0.025em; line-height: 0.94; font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif; }

  .couples-card-best-for {
    margin: 0; color: #4b5a55; font-size: 13.5px; line-height: 1.65;
    padding: 10px 13px; background: rgba(247,250,248,0.9); border-radius: 6px;
    border: 1px solid rgba(18,24,22,0.07); font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .couples-card-best-for strong { color: #33403b; font-weight: 820; }

  .couples-card-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; flex: 1; }
  .couples-card-list li { position: relative; padding-left: 18px; color: #4d5a55; font-size: 13.5px; line-height: 1.6; font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif; }
  .couples-card-list li::before { content: ""; position: absolute; left: 0; top: 0.68em; width: 7px; height: 7px; border-radius: 99px; background: #9ab9b2; }

  .couples-card-cta { margin-top: auto; padding-top: 4px; }
  .couples-card-link { width: 100%; justify-content: center; }

  .couples-addons-section { padding-bottom: 56px; }
  .couples-addons-heading { margin: 0 0 20px; color: #101412; font-size: 28px; font-weight: 860; line-height: 1.1; letter-spacing: 0; }
  .couples-addons-grid {
    max-width: 640px; border: 1px solid rgba(18,24,22,0.1); border-radius: 8px;
    background: rgba(255,255,255,0.76); box-shadow: 0 14px 34px rgba(18,24,22,0.07); overflow: hidden;
  }
  .couples-addons-grid .pricing-row { padding: 14px 20px; }
  .couples-addons-grid .pricing-row:last-child { border-bottom: none; }

  @media (max-width: 1060px) { .couples-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 660px) {
    .couples-grid { grid-template-columns: 1fr; gap: 12px; }
    .couples-card-price { font-size: 36px; }
    .couples-intro { padding: 40px 0 28px; }
    .couples-intro-copy { font-size: 16px; }
    .couples-intro-heading { font-size: 28px; }
    .couples-addons-heading { font-size: 24px; }
  }
`;
