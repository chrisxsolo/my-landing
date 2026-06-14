import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import ContactClient from "./ContactClient";
import ContactStyles from "./ContactStyles";
import { BOOKING_POLICY } from "@/lib/pricingCatalog";

const PAGE_TITLE = "Book a Bay Area Photography Session";
const SOCIAL_TITLE = `${PAGE_TITLE} | SoloXSnaps`;
const DESCRIPTION =
  "Inquire about graduation, couples, family, and event photography in the Bay Area. Send Chris Solorzano your date, location, and session type — replies within 24 hours.";
const CONTACT_IMAGE =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/champagne-popping.jpg";
const EXPECTATIONS = [
  "Guided posing — no awkward standing around",
  "Fast, clear communication",
  "Private gallery delivered on time",
  "Bay Area location and campus expertise",
  `${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer to reserve your session`,
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "SoloXSnaps",
  },
  twitter: { card: "summary_large_image", title: SOCIAL_TITLE, description: DESCRIPTION },
};

function ContactFormFallback() {
  return (
    <div className="contact-form-loading" aria-busy="true" aria-label="Loading inquiry form">
      <p className="contact-kicker">Loading inquiry form...</p>
      <div className="contact-loading-row">
        <div className="contact-loading-block" />
        <div className="contact-loading-block" />
      </div>
      <div className="contact-loading-row">
        <div className="contact-loading-block" />
        <div className="contact-loading-block" />
      </div>
      <div className="contact-loading-block contact-loading-message" />
    </div>
  );
}

function ContactSidebar() {
  return (
    <aside className="contact-sidebar" aria-label="Booking details">
      <div className="contact-side-panel">
        <p className="contact-kicker">Response time</p>
        <h2>Within 24 hours.</h2>
        <p>
          Most inquiries are answered within 24 hours. You will get a copy of your responses,
          and graduation inquiries also receive the graduation guide.
        </p>
      </div>
      <div className="contact-side-panel">
        <p className="contact-kicker">What to expect</p>
        <ul className="contact-expectation-list">
          {EXPECTATIONS.map((item) => (
            <li key={item}><span className="contact-check" aria-hidden="true">✓</span>{item}</li>
          ))}
        </ul>
      </div>
      <div className="contact-side-panel">
        <p className="contact-kicker">Helpful links</p>
        <h2>Plan before you send.</h2>
        <p>
          <Link href="/availability">View availability</Link>, read the{" "}
          <Link href="/faq">photography FAQ</Link>, or browse the{" "}
          <Link href="/grad-guide">graduation guide</Link>.
        </p>
      </div>
      <div className="contact-side-panel">
        <p className="contact-kicker">Instagram</p>
        <h2>@soloxsnaps</h2>
        <p>
          <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer">
            See recent work
          </a>
        </p>
      </div>
    </aside>
  );
}

export default function ContactPage() {
  return (
    <main className="contact-page">
      <ContactStyles />
      <section className="contact-shell contact-hero">
        <div>
          <p className="contact-kicker">Start the booking note</p>
          <h1 className="contact-title">Tell me the date, location, and what this is for.</h1>
          <p className="contact-copy">
            Send the details and I will reply within 24 hours with availability, next steps, and
            anything useful for your session. Photographing a graduation? The{" "}
            <Link href="/grad-guide">graduation photo guide</Link> covers outfits, posing, and the
            best campus spots.
          </p>
          <div className="contact-chip-row" aria-label="Available session categories">
            <span className="contact-chip">Graduation</span>
            <span className="contact-chip">Family</span>
            <span className="contact-chip">Bay Area</span>
          </div>
        </div>
        <div className="contact-hero-media">
          <OptimizedPhoto
            src={CONTACT_IMAGE}
            alt="Graduate celebrating during a Bay Area portrait session by Chris Solorzano"
            sizes="(max-width: 920px) 90vw, 360px"
            quality={90}
          />
        </div>
      </section>

      <section className="contact-shell contact-layout">
        <div className="contact-form-panel">
          <Suspense fallback={<ContactFormFallback />}>
            <ContactClient />
          </Suspense>
        </div>
        <ContactSidebar />
      </section>
    </main>
  );
}
