import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";
import { anim } from "@/lib/proStyles";
import styles from "@/app/(professional)/pricing/Pricing.module.css";
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

// Package photo sizing → read by Pricing.module.css via CSS custom properties.
const mediaVars = {
  "--pricing-media-h": "580px",
  "--pricing-media-h-mobile": "400px",
  "--pricing-media-pos": "center 30%",
} as CSSProperties;
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
    <main className={styles.pricingModern} style={mediaVars}>

      <section className={styles.pricingHeroDark}>
        {heroImage && (
          <div className={styles.pricingHeroPhoto} aria-hidden="true">
            <OptimizedPhoto
              src={heroImage}
              alt=""
              sizes="100vw"
              priority
              quality={90}
            />
          </div>
        )}
        <div className={styles.pricingShell}>
          <p className={styles.pricingKicker}>Couples photography</p>
          <h1 className={styles.pricingTitle}>Couples photos that actually feel like you</h1>
          <p className={styles.pricingCopy}>
            Bay Area couples photography for anniversaries, engagements, proposals, and lifestyle sessions. I&rsquo;ll guide the posing so everything feels natural, relaxed, and easy from start to finish.
          </p>
          <div className={styles.pricingHeroDarkFooter}>
            <div className={styles.pricingHeroPriceBlock}>
              <span className={styles.pricingHeroPriceLabel}>starting at</span>
              <span className={styles.pricingHeroPriceBig}>{formatCurrency(couplesPricing.packages.mini.price)}</span>
            </div>
            <span className={styles.pricingHeroDivider} aria-hidden="true" />
            <div className={styles.pricingChipRow} style={{ marginTop: 0 }}>
              <span className={styles.pricingChip}>Starting at {formatCurrency(couplesPricing.packages.mini.price)}</span>
              <span className={styles.pricingChip}>{couplesPricing.packages.mini.minimumImages}+ edited images</span>
              <span className={styles.pricingChip}>Guided posing</span>
              <span className={styles.pricingChip}>{PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround</span>
            </div>
            <Link href="/contact" className={styles.pricingLink}>Inquire About a Couples Session</Link>
          </div>
          <p className={styles.pricingHeroFineprint}>
            Starting at {formatCurrency(couplesPricing.packages.mini.price)} for a {couplesPricing.packages.mini.durationLabel.toLowerCase()}.
          </p>
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

      <section className={`${styles.pricingShell} ${styles.couplesIntro}`}>
        <h2 className={styles.couplesIntroHeading}>Couples Photography</h2>
        <p className={styles.couplesIntroCopy}>
          Whether you&apos;re celebrating an anniversary, looking for romantic lifestyle portraits around San Francisco, planning engagement photos for your save-the-dates, or setting up a surprise proposal, I offer couples photography sessions designed around your timeline and vision. All sessions take place in real Bay Area locations — parks, waterfront spots, urban neighborhoods, and beyond. Every package includes guided posing so you&apos;re never standing there guessing what to do with your hands.
        </p>
        <p className={styles.couplesIntroCopy} style={{ marginTop: 14 }}>
          I usually recommend scheduling closer to sunset when possible for the best lighting, but timing can depend on the location and overall session plan.
        </p>
      </section>

      <section className={`${styles.pricingShell} ${styles.couplesGrid}`} aria-label="Couples session packages">
        {packages.map((pkg) => {
          const { kicker, name, price, bestFor, items, durationLabel, minimumImages } = pkg;
          const badge = "badge" in pkg ? pkg.badge : undefined;
          const startingAt = "startingAt" in pkg ? pkg.startingAt : false;
          return (
          <div key={name} className={`${styles.couplesCard}${badge ? ` ${styles.couplesCardFeatured}` : ""}`}>
            {badge && <span className={styles.couplesCardBadge}>{badge}</span>}
            <div className={styles.couplesCardHeader}>
              <p className={styles.pricingKicker} style={{ marginBottom: 8 }}>{kicker}</p>
              <h3 className={styles.couplesCardName}>{name}</h3>
              {startingAt && <span className={styles.couplesCardPricePrefix}>Starting at</span>}
              <p className={styles.couplesCardPrice}>{formatCurrency(price)}</p>
            </div>
            <p className={styles.couplesCardBestFor}><strong>Best for:</strong> {bestFor}</p>
            <ul className={styles.couplesCardList}>
              <li>{durationLabel}</li>
              {items.map((item) => <li key={item}>{item}</li>)}
              <li>Minimum {minimumImages} professionally edited images</li>
              <li>Standard {PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround</li>
            </ul>
            <div className={styles.couplesCardCta}>
              <Link href="/contact" className={`${styles.pricingLink} ${styles.couplesCardLink}`}>Inquire About a Couples Session</Link>
            </div>
          </div>
          );
        })}
      </section>

      <section className={`${styles.pricingShell} ${styles.couplesChooser}`} aria-label="Which couples session should I book?">
        <h2 className={styles.couplesChooserHeading}>Which couples session should I book?</h2>
        <div className={styles.couplesChooserTable}>
          {[
            ["30-Minute Couples Mini Session", "Quick anniversaries, casual portraits, and couples who want a short session."],
            ["1-Hour Couples Session", "The best all-around option with more variety and a fuller gallery."],
            ["Couples Signature Session", "Couples who want more time, more movement, and more creative direction."],
            ["Engagement Session", "Save-the-dates, wedding websites, announcements, and more intentional planning."],
            ["Proposal Session", "Surprise proposals, pre-shoot coordination, and portraits afterward."],
          ].map(([session, bestFor]) => (
            <div key={session} className={styles.couplesChooserRow}>
              <span className={styles.couplesChooserSession}>{session}</span>
              <span className={styles.couplesChooserBest}>{bestFor}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.pricingShell} ${styles.couplesFeel}`} aria-label="What the session feels like">
        <h2 className={styles.couplesFeelHeading}>What the session feels like</h2>
        <div className={styles.couplesFeelGrid}>
          {[
            ["No awkward posing", "I’ll guide you through natural prompts and simple direction so you’re never standing around wondering what to do."],
            ["Real locations", "We’ll choose a Bay Area spot that fits your vibe, from city architecture to beach sunsets to quiet park trails."],
              ["Easy from start to finish", `Once the date is confirmed, I’ll send the invoice and contract, help with planning, and deliver your final gallery within ${PRICING_CATALOG.standardTurnaroundDays / 7} weeks.`],
          ].map(([title, copy]) => (
            <div key={title} className={styles.couplesFeelCard}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.pricingShell} ${styles.couplesAddonsSection}`}>
        <p className={styles.pricingKicker}>Add-ons</p>
        <h2 className={styles.couplesAddonsHeading}>Customize your session</h2>
        <div className={styles.couplesAddonsGrid}>
          {addOns.map((addOn) => (
            <div key={addOn.label} className={styles.pricingRow}>
              <span>{addOn.label}</span><span>{"price" in addOn ? addOn.price : addOn.displayPrice}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.pricingShell} style={{ paddingTop: 0, paddingBottom: 64 }}>
        <CouplesRateEstimator />
      </section>

      <section className={`${styles.pricingShell} ${styles.pricingCta}`}>
        <div className={styles.pricingCtaPanel}>
          <div>
            <p className={styles.pricingKicker}>Ready for couples photos?</p>
            <h2 className={styles.pricingTitle} style={{ fontSize: 38 }}>Ready for couples photos?</h2>
            <p className={styles.couplesCtaCopy}>
              Send your preferred date, location idea, and session type. I&rsquo;ll confirm availability and send the invoice and contract once everything is set.
            </p>
          </div>
          <Link href="/contact" className={styles.pricingLink}>Inquire About a Couples Session</Link>
        </div>
      </section>
    </main>
  );
}
