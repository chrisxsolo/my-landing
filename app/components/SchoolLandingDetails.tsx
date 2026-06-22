import Link from "next/link";
import { formatCurrency } from "@/lib/pricing";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";

type SchoolSpot = {
  name: string;
  description: string;
};

type Props = {
  schoolShort: string;
  slug: string;
  bodyIntro: string;
  travelNote: string;
  sessionNote?: string;
  spots: SchoolSpot[];
};

const TRUST_ITEMS = [
  "Guided posing - no awkward standing around",
  "Fast, clear communication",
  "Private online gallery",
  "Bay Area campus expertise",
] as const;

export default function SchoolLandingDetails({
  schoolShort,
  slug,
  bodyIntro,
  travelNote,
  sessionNote,
  spots,
}: Props) {
  const graduationPricing = PRICING_CATALOG.graduation;
  const durationLabel = graduationPricing.durationRules.allowedMinutes
    .map((minutes) => minutes === 90 ? "1.5" : String(minutes / 60))
    .join(", ");
  const included = [
    "Professionally guided posing and direction throughout",
    "Multiple on-campus location selections",
    `${graduationPricing.standardMinimumImages}+ professionally edited images`,
    "Private online gallery with download link",
    `Up to ${PRICING_CATALOG.standardTurnaroundDays / 7}-week standard turnaround`,
    "Clear communication from inquiry to delivery",
  ];
  const quickReference = [
    { label: "Starting rate", value: `${formatCurrency(graduationPricing.baseHourlyRate)} / hour` },
    { label: "Session length", value: `${durationLabel} hours` },
    { label: "Retainer", value: `${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability}` },
    { label: "Balance", value: `Due ${BOOKING_POLICY.remainingBalanceDeadline}` },
    { label: "Turnaround", value: `Up to ${PRICING_CATALOG.standardTurnaroundDays / 7} weeks` },
    { label: "Delivery", value: "Private online gallery" },
    { label: "Response time", value: "Within 24 hours" },
  ];

  return (
    <>
      <section className="school-body">
        <div className="school-shell school-body-grid">
          <div>
            <p className="school-kicker">About this location</p>
            <h2 className="school-section-title">Grad sessions at {schoolShort}</h2>
            <p className="school-body-copy">{bodyIntro}</p>
            <p className="school-body-copy" style={{ color: "#667f79", fontSize: 15 }}>{travelNote}</p>
            {sessionNote && (
              <p className="school-body-copy" style={{ color: "#667f79", fontSize: 15 }}>{sessionNote}</p>
            )}
          </div>
          <div>
            <p className="school-kicker">What&apos;s included</p>
            <h2 className="school-section-title">Every grad session includes</h2>
            {included.map((item) => (
              <p key={item} className="school-body-copy" style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "0 0 12px" }}>
                <span style={{ color: "#4f6d67", fontWeight: 700, flexShrink: 0 }}>✓</span>
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      {spots.length > 0 && (
        <section className="school-spots">
          <div className="school-shell">
            <p className="school-kicker">Campus locations</p>
            <h2 className="school-section-title" style={{ maxWidth: 540 }}>
              Where we shoot at {schoolShort}
            </h2>
            <div className="school-spots-grid">
              {spots.map((spot) => (
                <div key={spot.name} className="school-spot-card">
                  <h3 className="school-spot-name">{spot.name}</h3>
                  <p className="school-spot-desc">{spot.description}</p>
                </div>
              ))}
            </div>
            <p className="school-body-copy" style={{ marginTop: 22, fontSize: 15 }}>
              <Link href={`/grads/${slug}/spots`} style={{ color: "#3d6b5e", fontWeight: 700 }}>
                See all {schoolShort} graduation photo spots &amp; the best time for each →
              </Link>
            </p>
            <p className="school-body-copy" style={{ marginTop: 10, color: "#667f79", fontSize: 15 }}>
              New to grad photos? The{" "}
              <Link href="/grad-guide" style={{ color: "#3d6b5e", fontWeight: 700 }}>
                Bay Area graduation photo guide
              </Link>{" "}
              covers what to wear, posing, how to prepare, and the best campus spots before your session.
            </p>
          </div>
        </section>
      )}

      <section className="school-info">
        <div className="school-shell">
          <p className="school-kicker">Quick reference</p>
          <div className="school-info-grid">
            {quickReference.map(({ label, value }) => (
              <div key={label} className="school-info-item">
                <p className="school-info-label">{label}</p>
                <p className="school-info-value">{value}</p>
              </div>
            ))}
          </div>
          <div className="school-trust">
            {TRUST_ITEMS.map((item) => (
              <span key={item} className="school-trust-item">
                <span className="school-trust-check">✓</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
