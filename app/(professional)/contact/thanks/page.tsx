"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Submission = {
  name: string;
  email: string;
  phone: string;
  sessionType: string;
  date: string;
  message: string;
};

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.6s ease forwards; }
  .fade-up-2 { animation: fadeUp 0.6s ease 0.15s forwards; opacity: 0; }
  .fade-up-3 { animation: fadeUp 0.6s ease 0.3s forwards; opacity: 0; }
  .fade-up-4 { animation: fadeUp 0.6s ease 0.45s forwards; opacity: 0; }

  .detail-row {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding: 16px 0;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .detail-label {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 0.6rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #555;
    min-width: 110px;
    padding-top: 3px;
    flex-shrink: 0;
  }
  .detail-value {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.95rem;
    color: #444;
    line-height: 1.65;
    word-break: break-word;
  }

  @media (max-width: 640px) {
    .thanks-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
    .thanks-main { padding: 60px 24px !important; }
    .detail-row { flex-direction: column; gap: 6px; }
    .detail-label { min-width: 0; }
  }
`;

export default function ThanksPage() {
  const [data, setData] = useState<Submission | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("inquiry_submitted");
      if (raw) {
        setData(JSON.parse(raw));
        sessionStorage.removeItem("inquiry_submitted");
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const fields = data ? [
    data.name        && { label: "Name",         value: data.name },
    data.email       && { label: "Email",         value: data.email },
    data.phone       && { label: "Phone",         value: data.phone },
    data.sessionType && { label: "Session type",  value: data.sessionType },
    data.date        && { label: "Date in mind",  value: data.date },
    data.message     && { label: "Message",       value: data.message },
  ].filter(Boolean) as { label: string; value: string }[] : [];

  if (!loaded) return null;

  return (
    <main style={{ background: "#fff", color: "#1a1a1a", minHeight: "100vh", paddingTop: 80 }}>
      <style>{CSS}</style>

      <div className="thanks-main" style={{ maxWidth: 800, margin: "0 auto", padding: "80px 60px 120px" }}>

        {/* Check mark */}
        <div className="fade-up" style={{ marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56,
            border: "1.5px solid rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 36,
          }}>
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <path d="M1 8L8 15L21 1" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.68rem", letterSpacing: "0.28em",
            textTransform: "uppercase", color: "#555", marginBottom: 20,
          }}>
            Inquiry received
          </p>
          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(2.2rem, 6vw, 4.5rem)", fontWeight: 300,
            letterSpacing: "0.04em", color: "#111",
            lineHeight: 1.1, margin: "0 0 24px",
          }}>
            {data?.name ? `Thank you, ${data.name.split(" ")[0]}.` : "Thank you."}
          </h1>
          <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", marginBottom: 24 }} />
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
            fontSize: "1.05rem", color: "#555", lineHeight: 1.8, maxWidth: 480,
          }}>
            Your inquiry is in. I&rsquo;ll be in touch within 24–48 hours to confirm availability
            and talk through next steps.
          </p>
        </div>

        {/* Submitted info */}
        {fields.length > 0 && (
          <div className="fade-up-2" style={{
            marginTop: 56,
            border: "1px solid rgba(0,0,0,0.08)",
            padding: "32px 36px",
          }}>
            <p style={{
              fontFamily: "var(--font-dm-sans), sans-serif",
              fontSize: "0.6rem", letterSpacing: "0.24em",
              textTransform: "uppercase", color: "#555", marginBottom: 4,
            }}>
              What you submitted
            </p>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
              fontSize: "0.82rem", color: "#555", marginBottom: 24,
            }}>
              Keep this for your records.
            </p>
            {fields.map((field) => (
              <div key={field.label} className="detail-row">
                <span className="detail-label">{field.label}</span>
                <span className="detail-value">{field.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* What happens next */}
        <div className="fade-up-3" style={{ marginTop: 48 }}>
          <p style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontSize: "0.6rem", letterSpacing: "0.24em",
            textTransform: "uppercase", color: "#555", marginBottom: 20,
          }}>
            What happens next
          </p>
          <div className="thanks-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { step: "01", title: "I review", body: "Your inquiry lands directly in my inbox and I review every detail." },
              { step: "02", title: "I reply", body: "Expect a response within 24–48 hours — usually sooner." },
              { step: "03", title: "We book", body: "Once we confirm fit and availability, I send a contract and deposit link." },
            ].map(({ step, title, body }) => (
              <div key={step} style={{ padding: "24px 0", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "1.6rem", fontWeight: 300, color: "#555",
                  margin: "0 0 10px",
                }}>
                  {step}
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.9rem", letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "#333", marginBottom: 8,
                }}>
                  {title}
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                  fontSize: "0.85rem", color: "#555", lineHeight: 1.7,
                }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="fade-up-4" style={{ display: "flex", gap: 16, marginTop: 52, flexWrap: "wrap" }}>
          <Link href="/availability" style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.72rem", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#fff",
            background: "#1a1a1a", padding: "13px 28px",
            textDecoration: "none", display: "inline-block",
          }}>
            Check availability →
          </Link>
          <Link href="/" style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.72rem", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#555",
            border: "1px solid rgba(0,0,0,0.15)", padding: "13px 28px",
            textDecoration: "none", display: "inline-block",
          }}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
