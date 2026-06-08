import type { Metadata } from "next";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { pricingCSS, anim } from "@/lib/proStyles";
import CouplesRateEstimator from "@/app/components/CouplesRateEstimator";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG, getBookingPolicyItems } from "@/lib/pricingCatalog";

// Cached/ISR: refreshed at most hourly, or immediately on admin content saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Couples Photography Pricing",
  description:
    "Bay Area couples photography pricing by Chris Solorzano — engagement sessions, proposal coverage, anniversary photos, and lifestyle portraits in San Francisco and beyond.",
  alternates: { canonical: "/pricing/couples" },
};

const CSS = pricingCSS({ mediaMinHeight: 580, mediaMinHeightMobile: 400, mediaObjectPosition: "center 30%" });
const couplesPricing = PRICING_CATALOG.couples;

const packages = [
  {
    ...couplesPricing.packages.mini,
    kicker: "Mini session",
    name: "30-Minute Couples Mini Session",
    bestFor: "Quick anniversary photos, casual lifestyle portraits, and couples who want a shorter session.",
    items: ["1 location", "1 outfit", "Posing guidance throughout", "Private online gallery"],
  },
  {
    ...couplesPricing.packages["1hr"],
    kicker: "Standard",
    name: "1-Hour Couples Session",
    badge: "Most popular",
    bestFor: "The best all-around option — more variety, more posing options, and a fuller gallery.",
    items: ["1 location", "1–2 outfits", "Posing guidance throughout", "More candid, romantic, and lifestyle image variety", "Private online gallery"],
  },
  {
    ...couplesPricing.packages.signature,
    kicker: "Signature",
    name: "Couples Signature Session",
    bestFor: "Couples who want more time, more creative direction, and a larger final gallery.",
    items: ["1 location", "Up to 2 outfits", "More posing variety and movement-based prompts", "Candid, romantic, and editorial-style images", "Private online gallery"],
  },
  {
    ...couplesPricing.packages.engagement,
    kicker: "Engagement",
    name: "Engagement Session",
    bestFor: "Save-the-dates, wedding websites, announcements, and a more intentional couples session experience.",
    items: ["1–2 nearby locations", "Up to 2 outfits", "Location planning support", "Posing guidance throughout", "Private online gallery"],
  },
  {
    ...couplesPricing.packages.proposal,
    kicker: "Proposals",
    name: "Proposal Session",
    startingAt: true,
    bestFor: "Surprise proposals and romantic portraits afterward — planning and coordination included. Final pricing varies with location, timing, and complexity.",
    items: ["Planning and coordination before the session", "Location and timing guidance", "Surprise proposal coverage", "Portraits after the proposal", "Private online gallery"],
  },
] as const;

const addOns = [
  { label: couplesPricing.addOns.extraLocation.label, price: `+${formatCurrency(couplesPricing.addOns.extraLocation.price)}` },
  { label: couplesPricing.addOns.extraOutfit.label, price: `+${formatCurrency(couplesPricing.addOns.extraOutfit.price)}` },
  { label: couplesPricing.addOns.extra30Minutes.label, price: `+${formatCurrency(couplesPricing.addOns.extra30Minutes.price)}` },
  { label: couplesPricing.addOns.proofingGallery.label, price: `+${formatCurrency(couplesPricing.addOns.proofingGallery.price)}` },
  { label: couplesPricing.addOns.rushPreview.label, price: `+${formatCurrency(couplesPricing.addOns.rushPreview.price)}` },
  { label: couplesPricing.addOns.expedited.label, price: `+${formatCurrency(couplesPricing.addOns.expedited.price)}` },
  couplesPricing.addOns.shortFormVideo,
  couplesPricing.addOns.advancedRetouching,
  { label: "Travel outside San Francisco",                     price: "based on distance" },
] as const;

const infoCards = [
  { heading: "Booking",      items: getBookingPolicyItems(), delay: 0.28 },
  { heading: "Session flow", items: ["Guided posing throughout every session.", "Location and timing planned before shoot day.", "Proposal sessions include pre-shoot coordination."],                                                                   delay: 0.40 },
  { heading: "Travel",       items: ["San Francisco locations are included.", "Locations outside San Francisco may include a travel fee based on distance."],                                                                                         delay: 0.52 },
] as const;

export default async function CouplesPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const coupleImages = images.filter((img) => img.category_slug === "couples");
  const fallback = images[0]?.image_url ?? null;
  const heroImage = siteSettings.pricing_couples_standard_image || coupleImages[0]?.image_url || fallback;

  return (
    <main className="pricing-modern">
      <style>{CSS + COUPLES_CSS}</style>

      <section className="pricing-hero-dark">
        {heroImage && (
          <div className="pricing-hero-photo" aria-hidden="true">
            <OptimizedPhoto
              src={heroImage}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        )}
        <div className="pricing-shell">
          <p className="pricing-kicker">Couples photography</p>
          <h1 className="pricing-title">Couples photos that actually feel like you</h1>
          <p className="pricing-copy">
            Bay Area couples photography for anniversaries, engagements, proposals, and lifestyle sessions. I&rsquo;ll guide the posing so everything feels natural, relaxed, and easy from start to finish.
          </p>
          <div className="pricing-hero-dark-footer">
            <div className="pricing-hero-price-block">
              <span className="pricing-hero-price-label">starting at</span>
              <span className="pricing-hero-price-big">{formatCurrency(couplesPricing.packages.mini.price)}</span>
            </div>
            <span className="pricing-hero-divider" aria-hidden="true" />
            <div className="pricing-chip-row" style={{ marginTop: 0 }}>
              <span className="pricing-chip">Starting at {formatCurrency(couplesPricing.packages.mini.price)}</span>
              <span className="pricing-chip">{couplesPricing.packages.mini.minimumImages}+ edited images</span>
              <span className="pricing-chip">Guided posing</span>
              <span className="pricing-chip">{PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround</span>
            </div>
            <Link href="/contact" className="pricing-link">Inquire About a Couples Session</Link>
          </div>
          <p className="pricing-hero-fineprint">
            Starting at {formatCurrency(couplesPricing.packages.mini.price)} for a {couplesPricing.packages.mini.durationLabel.toLowerCase()}.
          </p>
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
          Whether you&apos;re celebrating an anniversary, looking for romantic lifestyle portraits around San Francisco, planning engagement photos for your save-the-dates, or setting up a surprise proposal, I offer couples photography sessions designed around your timeline and vision. All sessions take place in real Bay Area locations — parks, waterfront spots, urban neighborhoods, and beyond. Every package includes guided posing so you&apos;re never standing there guessing what to do with your hands.
        </p>
        <p className="couples-intro-copy" style={{ marginTop: 14 }}>
          I usually recommend scheduling closer to sunset when possible for the best lighting, but timing can depend on the location and overall session plan.
        </p>
      </section>

      <section className="pricing-shell couples-grid" aria-label="Couples session packages">
        {packages.map((pkg) => {
          const { kicker, name, price, bestFor, items, durationLabel, minimumImages } = pkg;
          const badge = "badge" in pkg ? pkg.badge : undefined;
          const startingAt = "startingAt" in pkg ? pkg.startingAt : false;
          return (
          <div key={name} className={`couples-card${badge ? " couples-card--featured" : ""}`}>
            {badge && <span className="couples-card-badge">{badge}</span>}
            <div className="couples-card-header">
              <p className="pricing-kicker" style={{ marginBottom: 8 }}>{kicker}</p>
              <h3 className="couples-card-name">{name}</h3>
              {startingAt && <span className="couples-card-price-prefix">Starting at</span>}
              <p className="couples-card-price">{formatCurrency(price)}</p>
            </div>
            <p className="couples-card-best-for"><strong>Best for:</strong> {bestFor}</p>
            <ul className="couples-card-list">
              <li>{durationLabel}</li>
              {items.map((item) => <li key={item}>{item}</li>)}
              <li>Minimum {minimumImages} professionally edited images</li>
              <li>Standard {PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround</li>
            </ul>
            <div className="couples-card-cta">
              <Link href="/contact" className="pricing-link couples-card-link">Inquire About a Couples Session</Link>
            </div>
          </div>
          );
        })}
      </section>

      <section className="pricing-shell couples-chooser" aria-label="Which couples session should I book?">
        <h2 className="couples-chooser-heading">Which couples session should I book?</h2>
        <div className="couples-chooser-table">
          {[
            ["30-Minute Couples Mini Session", "Quick anniversaries, casual portraits, and couples who want a short session."],
            ["1-Hour Couples Session", "The best all-around option with more variety and a fuller gallery."],
            ["Couples Signature Session", "Couples who want more time, more movement, and more creative direction."],
            ["Engagement Session", "Save-the-dates, wedding websites, announcements, and more intentional planning."],
            ["Proposal Session", "Surprise proposals, pre-shoot coordination, and portraits afterward."],
          ].map(([session, bestFor]) => (
            <div key={session} className="couples-chooser-row">
              <span className="couples-chooser-session">{session}</span>
              <span className="couples-chooser-best">{bestFor}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-shell couples-feel" aria-label="What the session feels like">
        <h2 className="couples-feel-heading">What the session feels like</h2>
        <div className="couples-feel-grid">
          {[
            ["No awkward posing", "I’ll guide you through natural prompts and simple direction so you’re never standing around wondering what to do."],
            ["Real locations", "We’ll choose a Bay Area spot that fits your vibe, from city architecture to beach sunsets to quiet park trails."],
              ["Easy from start to finish", `Once the date is confirmed, I’ll send the invoice and contract, help with planning, and deliver your final gallery within ${PRICING_CATALOG.standardTurnaroundDays / 7} weeks.`],
          ].map(([title, copy]) => (
            <div key={title} className="couples-feel-card">
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-shell couples-addons-section">
        <p className="pricing-kicker">Add-ons</p>
        <h2 className="couples-addons-heading">Customize your session</h2>
        <div className="couples-addons-grid">
          {addOns.map((addOn) => (
            <div key={addOn.label} className="pricing-row">
              <span>{addOn.label}</span><span>{"price" in addOn ? addOn.price : addOn.displayPrice}</span>
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
            <h2 className="pricing-title" style={{ fontSize: 38 }}>Ready for couples photos?</h2>
            <p className="couples-cta-copy">
              Send your preferred date, location idea, and session type. I&rsquo;ll confirm availability and send the invoice and contract once everything is set.
            </p>
          </div>
          <Link href="/contact" className="pricing-link">Inquire About a Couples Session</Link>
        </div>
      </section>
    </main>
  );
}

const COUPLES_CSS = `
  .pricing-hero-fineprint { margin: 14px 0 0; color: rgba(255,255,255,0.78); font-size: 13.5px; line-height: 1.5; font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif; }

  /* Featured package card + badge (P5) */
  .couples-card { position: relative; }
  .couples-card--featured { border-color: rgba(154,185,178,0.55); box-shadow: 0 18px 40px rgba(18,24,22,0.12); }
  .couples-card-badge {
    position: absolute; top: -11px; left: 28px;
    padding: 5px 12px; border-radius: 999px;
    background: #33403b; color: #fff;
    font-size: 11px; font-weight: 820; letter-spacing: 0.04em; text-transform: uppercase;
    box-shadow: 0 6px 16px rgba(18,24,22,0.18);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .couples-card-price-prefix { display: block; margin: 0 0 2px; color: #667f79; font-size: 12px; font-weight: 760; letter-spacing: 0.04em; text-transform: uppercase; font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif; }

  /* Which session should I book? (P8) */
  .couples-chooser { padding: 8px 0 56px; }
  .couples-chooser-heading { margin: 0 0 20px; color: #101412; font-size: 28px; font-weight: 860; line-height: 1.1; letter-spacing: 0; }
  .couples-chooser-table {
    border: 1px solid rgba(18,24,22,0.1); border-radius: 8px; overflow: hidden;
    background: rgba(255,255,255,0.76); box-shadow: 0 14px 34px rgba(18,24,22,0.07);
  }
  .couples-chooser-row {
    display: grid; grid-template-columns: minmax(180px, 0.8fr) 1.4fr; gap: 18px;
    padding: 16px 20px; border-bottom: 1px solid rgba(18,24,22,0.08);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .couples-chooser-row:last-child { border-bottom: none; }
  .couples-chooser-session { color: #101412; font-size: 14.5px; font-weight: 820; line-height: 1.4; }
  .couples-chooser-best { color: #4b5a55; font-size: 14px; line-height: 1.55; }

  /* What the session feels like (P9) */
  .couples-feel { padding: 8px 0 56px; }
  .couples-feel-heading { margin: 0 0 20px; color: #101412; font-size: 28px; font-weight: 860; line-height: 1.1; letter-spacing: 0; }
  .couples-feel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .couples-feel-card {
    padding: 26px 24px; border: 1px solid rgba(18,24,22,0.1); border-radius: 8px;
    background: rgba(255,255,255,0.76); box-shadow: 0 14px 34px rgba(18,24,22,0.07);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .couples-feel-card h3 { margin: 0 0 10px; color: #101412; font-size: 18px; font-weight: 860; line-height: 1.2; }
  .couples-feel-card p { margin: 0; color: #4b5a55; font-size: 14.5px; line-height: 1.62; }

  .couples-cta-copy { max-width: 520px; margin: 14px 0 0; color: #4b5a55; font-size: 15px; line-height: 1.65; font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif; }

  @media (max-width: 660px) {
    .couples-chooser-row { grid-template-columns: 1fr; gap: 4px; }
    .couples-feel-grid { grid-template-columns: 1fr; }
    .couples-chooser-heading, .couples-feel-heading { font-size: 24px; }
  }

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
