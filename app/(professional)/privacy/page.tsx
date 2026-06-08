export const metadata = {
  title: "Privacy Policy",
  description: "How soloxsnaps collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <main style={{ padding: "120px 24px 80px", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 36, fontWeight: 860, color: "#101412", marginBottom: 8 }}>
        Privacy Policy
      </h1>
      <p style={{ color: "#667f79", fontSize: 14, marginBottom: 48 }}>
        Last updated: May 15, 2025
      </p>

      <Section title="Who we are">
        soloxsnaps is a Bay Area photography business operated by Chris Solorzano. We photograph
        graduations and families throughout the San Francisco Bay Area. Our website is{" "}
        <a href="https://soloxsnaps.com" style={{ color: "#3d6b5e" }}>soloxsnaps.com</a>.
      </Section>

      <Section title="What information we collect">
        When you fill out our contact or booking form, we collect:
        <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
          <li>Your name and email address</li>
          <li>Your phone number (optional)</li>
          <li>Details about your photography session (date, location, type)</li>
          <li>Any messages you send us</li>
        </ul>
        If you sign in to your client dashboard, we also collect your Google account email
        through Google OAuth so we can identify your account.
      </Section>

      <Section title="How we use your information">
        We use the information you provide solely to:
        <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
          <li>Respond to your inquiry or booking request</li>
          <li>Coordinate and confirm your photography session</li>
          <li>Deliver your gallery and communicate about your photos</li>
          <li>Send important updates related to your booking</li>
        </ul>
        We do not sell, rent, or share your personal information with third parties for
        marketing purposes.
      </Section>

      <Section title="Google OAuth">
        We use Google Sign-In to let clients access their private gallery dashboard. When you
        sign in with Google, we receive your name and email address from Google. We do not
        access your Google Drive, Gmail, or any other Google data. You can revoke access at
        any time at{" "}
        <a href="https://myaccount.google.com/permissions" style={{ color: "#3d6b5e" }}>
          myaccount.google.com/permissions
        </a>.
      </Section>

      <Section title="Data storage">
        Your information is stored securely in Supabase, a GDPR-compliant database provider.
        We retain your contact and booking information for up to 2 years after your session,
        after which it is deleted.
      </Section>

      <Section title="Cookies">
        Our site uses only session cookies required for authentication. We do not use
        advertising cookies or tracking pixels.
      </Section>

      <Section title="Your rights">
        You may request to view, update, or delete your personal information at any time by
        emailing us at{" "}
        <a href="mailto:soloxsnaps@gmail.com" style={{ color: "#3d6b5e" }}>
          soloxsnaps@gmail.com
        </a>. We will respond within 30 days.
      </Section>

      <Section title="Contact">
        Questions about this policy? Reach us at{" "}
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
