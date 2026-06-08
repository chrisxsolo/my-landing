import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";

export const metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for booking and working with soloxsnaps.",
};

export default function TermsPage() {
  return (
    <main style={{ padding: "120px 24px 80px", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 36, fontWeight: 860, color: "#101412", marginBottom: 8 }}>
        Terms of Service
      </h1>
      <p style={{ color: "#667f79", fontSize: 14, marginBottom: 48 }}>
        Last updated: May 15, 2025
      </p>

      <Section title="Overview">
        These terms govern your use of soloxsnaps.com and any photography services provided
        by soloxsnaps (operated by Chris Solorzano, San Francisco, CA). By submitting an
        inquiry or booking a session, you agree to these terms.
      </Section>

      <Section title="Booking and payment">
        <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
          <li>
            A session is confirmed after the {BOOKING_POLICY.retainerPercent}%{" "}
            {BOOKING_POLICY.retainerRefundability} retainer has been received.
          </li>
          <li>
            The remaining balance is due {BOOKING_POLICY.remainingBalanceDeadline} unless
            otherwise agreed in writing.
          </li>
          <li>
            Pricing shown on the site is subject to change. Quoted prices are locked in at
            the time of booking confirmation.
          </li>
        </ul>
      </Section>

      <Section title="Rescheduling and cancellations">
        <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
          <li>
            Rescheduling requests made at least 72 hours before the session will be
            accommodated at no extra charge, subject to availability.
          </li>
          <li>
            Cancellations within 24 hours of the session forfeit the retainer and may incur
            an additional fee.
          </li>
          <li>
            In the event of severe weather or an emergency on the photographer&apos;s end,
            the session will be rescheduled at no penalty.
          </li>
        </ul>
      </Section>

      <Section title="Photos and delivery">
        <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
          <li>
            Standard edited galleries are delivered within{" "}
            {PRICING_CATALOG.standardTurnaroundDays / 7} weeks after the session.
          </li>
          <li>
            You receive a personal-use license for all delivered photos — you may print,
            share, and use them for personal purposes.
          </li>
          <li>
            Commercial use of any photo requires written permission from soloxsnaps.
          </li>
          <li>
            soloxsnaps retains the right to use session photos for portfolio, website, and
            social media purposes. Notify us in writing before your session if you require
            full privacy.
          </li>
        </ul>
      </Section>

      <Section title="Client responsibilities">
        <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
          <li>
            Clients are responsible for arriving on time. Late arrivals reduce session time
            without a refund.
          </li>
          <li>
            Clients are responsible for securing any permits required for chosen shoot
            locations.
          </li>
        </ul>
      </Section>

      <Section title="Limitation of liability">
        In the unlikely event of equipment failure, illness, or other circumstances beyond
        our control, soloxsnaps&apos;s liability is limited to a refund of amounts paid. We
        are not liable for indirect or consequential losses.
      </Section>

      <Section title="Governing law">
        These terms are governed by the laws of the State of California.
      </Section>

      <Section title="Contact">
        Questions? Email us at{" "}
        <a href="mailto:soloxsnaps@gmail.com" style={{ color: "#3d6b5e" }}>
          soloxsnaps@gmail.com
        </a>.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 760, color: "#101412", marginBottom: 12 }}>
        {title}
      </h2>
      <div style={{ color: "#4b5a55", fontSize: 16, lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}
