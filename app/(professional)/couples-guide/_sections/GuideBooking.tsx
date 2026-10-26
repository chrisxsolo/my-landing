// Couples guide hub — pricing (section 7), FAQ (8), and booking CTA (9).
// Prices come from PRICING_CATALOG.couples via hubContent; FAQ answers come from
// couplesFaqData (shared with /couples-guide/faq). Native <details> keeps the
// FAQ accessible and readable without JavaScript.

import Link from "next/link";
import { GUIDE_ADD_ONS, GUIDE_PACKAGES, HUB_FAQS } from "@/lib/couplesGuide/hubContent";
import { BOOKING_POLICY } from "@/lib/pricingCatalog";
import {
  COUPLES_BOOKING_PATH,
  COUPLES_PORTFOLIO_PATH,
  COUPLES_PRICING_PATH,
} from "@/lib/couplesRoutes";

const HIGHLIGHT_ADD_ON = "proofingGallery";

export function PricingSection() {
  return (
    <section id="pricing" className="fg-section cg-section" aria-labelledby="pricing-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Investment</p>
        <h2 id="pricing-title" className="cg-h2" data-reveal>Couples photography pricing</h2>
        <p className="fg-prose-lead" data-reveal>
          Every session includes guided posing throughout and a private online gallery of professionally edited
          photos. San Francisco locations have no travel fee; spots outside the city may add one based on distance.
        </p>
        <table className="cg-price-table">
          <caption className="sr-only">Couples session packages</caption>
          <tbody>
            {GUIDE_PACKAGES.map((pkg) => (
              <tr key={pkg.key}>
                <th scope="row">
                  {pkg.label}
                  <span className="cg-price-detail">{pkg.detail}</span>
                </th>
                <td className="cg-price">{pkg.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="cg-h3" style={{ marginTop: 28 }}>
          Optional add-ons{" "}
          <Link href={`${COUPLES_PRICING_PATH}#add-ons`} className="fg-inline-link" style={{ fontSize: 13 }}>details</Link>
        </h3>
        <table className="cg-price-table" style={{ marginTop: 12 }}>
          <caption className="sr-only">Couples session add-ons</caption>
          <tbody>
            {GUIDE_ADD_ONS.map((addOn) => (
              <tr key={addOn.key} className={addOn.key === HIGHLIGHT_ADD_ON ? "cg-highlight" : undefined}>
                <th scope="row">{addOn.label}</th>
                <td className="cg-price">{addOn.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fg-note">
          A {BOOKING_POLICY.retainerPercent}% {BOOKING_POLICY.retainerRefundability} retainer reserves your date; the
          balance is due {BOOKING_POLICY.remainingBalanceDeadline}.
        </p>
        <div className="fg-actions" style={{ marginTop: 20 }}>
          <Link href={`${COUPLES_PRICING_PATH}#packages`} className="fg-btn fg-btn--primary">Compare couples packages →</Link>
          <Link href={COUPLES_BOOKING_PATH} className="fg-btn fg-btn--ghost">Check my date</Link>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="fg-section fg-section--alt cg-section" aria-labelledby="faq-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Questions</p>
        <h2 id="faq-title" className="cg-h2" data-reveal>Couples photography FAQ</h2>
        <div className="cg-faq">
          {HUB_FAQS.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
        <p className="cg-more">
          <Link href="/couples-guide/faq" className="fg-inline-link">See every couples session question →</Link>
        </p>
      </div>
    </section>
  );
}

export function BookingCta() {
  return (
    <section className="fg-cta" aria-labelledby="couples-guide-cta">
      <div className="fg-shell">
        <div className="fg-cta-card glass-shimmer" data-reveal>
          <h2 id="couples-guide-cta" className="fg-cta-title">Ready to Capture Your Story Together?</h2>
          <p className="fg-cta-sub">
            Whether you&rsquo;re celebrating an anniversary, documenting a special moment, or simply want beautiful
            photos together, I&rsquo;d love to help bring your vision to life.
          </p>
          <div className="fg-cta-actions">
            <Link href={COUPLES_BOOKING_PATH} className="fg-btn fg-btn--ongreen">Book Your Couples Session →</Link>
            <Link href={COUPLES_PORTFOLIO_PATH} className="fg-btn fg-btn--onghost">View the couples portfolio</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
