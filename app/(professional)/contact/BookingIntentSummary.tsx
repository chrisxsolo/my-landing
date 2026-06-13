import { formatCurrency } from "@/lib/pricing";
import type { BookingIntent } from "@/lib/bookingIntent";

// Read-only recap of what the client configured in an estimator / CTA, shown
// above the inquiry form so they only fill in contact details — never rebuild
// the quote they just put together.
export default function BookingIntentSummary({ intent }: { intent: BookingIntent }) {
  const headline = intent.package ?? intent.sessionType ?? "Your session";

  const isGrad = /grad/i.test(intent.sessionType ?? "");
  const meta: string[] = [];
  const place = intent.school ?? intent.location;
  if (place) meta.push(place);
  if (intent.headcount) {
    const noun = isGrad
      ? intent.headcount === 1 ? "graduate" : "graduates"
      : intent.headcount === 1 ? "person" : "people";
    meta.push(`${intent.headcount} ${noun}`);
  }
  if (intent.duration) meta.push(intent.duration);
  if (intent.date) meta.push(intent.date);

  return (
    <section className="booking-intent" aria-label="Your session request">
      <p className="contact-kicker">Your session request</p>
      <p className="booking-intent-headline">{headline}</p>
      {meta.length > 0 && <p className="booking-intent-meta">{meta.join(" · ")}</p>}

      {intent.addOns && intent.addOns.length > 0 && (
        <div className="booking-intent-addons">
          {intent.addOns.map((addOn) => (
            <span key={addOn} className="booking-intent-tag">{addOn}</span>
          ))}
        </div>
      )}

      {typeof intent.estimatedTotal === "number" && (
        <div className="booking-intent-total">
          <span>Estimated total</span>
          <strong>{formatCurrency(intent.estimatedTotal)}</strong>
        </div>
      )}

      <p className="booking-intent-note">
        Just add your contact details and any notes below — we&rsquo;ve carried over what you
        configured.
      </p>
    </section>
  );
}
