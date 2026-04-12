import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Family Pricing | soloxsnaps",
  description: "Family photography pricing and packages by Chris Solorzano — Bay Area family portraits.",
  alternates: { canonical: "/pricing/families" },
};

const CSS = `
  .pkg-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .pkg-card:hover { transform: translateY(-2px); box-shadow: 0 8px 40px rgba(0,0,0,0.07); }
  @media (max-width: 760px) {
    .pkg-grid { grid-template-columns: 1fr !important; }
  }
`;

type Package = {
  name: string;
  price: string;
  duration: string;
  includes: string[];
  note?: string;
  popular?: boolean;
};

const packages: Package[] = [
  {
    name: "Mini",
    price: "$225",
    duration: "30 min",
    includes: [
      "30-minute session",
      "1 outdoor location",
      "20+ edited digital images",
      "Private online gallery",
      "Download rights",
      "Up to 4 people",
    ],
  },
  {
    name: "Standard",
    price: "$350",
    duration: "60 min",
    includes: [
      "60-minute session",
      "1–2 outdoor locations",
      "40+ edited digital images",
      "Private online gallery",
      "Download rights",
      "Up to 6 people",
      "1 outfit change",
    ],
    popular: true,
  },
  {
    name: "Extended",
    price: "$475",
    duration: "90 min",
    includes: [
      "90-minute session",
      "2–3 outdoor locations",
      "60+ edited digital images",
      "Private online gallery",
      "Download rights",
      "Up to 8 people",
      "2 outfit changes",
      "Priority booking window",
    ],
  },
];

const addOns = [
  { label: "Additional family members (per person, 5+)", price: "$30" },
  { label: "Rush delivery (48 hrs)", price: "$50" },
  { label: "Extra location", price: "$40" },
  { label: "Print package (5×7, 8×10, 11×14)", price: "$75" },
  { label: "Holiday card design (digital)", price: "$35" },
];

export default function FamilyPricingPage() {
  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <section style={{ padding: "80px 60px 64px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem", letterSpacing: "0.28em",
          textTransform: "uppercase", color: "#bbb", marginBottom: 20,
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2rem, 5.5vw, 5rem)", fontWeight: 300,
          letterSpacing: "0.06em", color: "#111",
          lineHeight: 1.1, margin: "0 auto 28px", maxWidth: 700,
        }}>
          Family sessions.
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", margin: "0 auto 28px" }} />
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
          fontSize: "1rem", color: "#aaa", maxWidth: 480, margin: "0 auto", lineHeight: 1.7,
        }}>
          Warm, candid family sessions across the Bay Area. All packages include full-resolution digital downloads.
        </p>

        {/* Nav toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 40 }}>
          <Link href="/pricing/grads" style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.72rem", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#bbb",
            borderBottom: "1px solid transparent", paddingBottom: 2,
            textDecoration: "none",
          }}>
            Grads
          </Link>
          <span style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.72rem", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#111",
            borderBottom: "1px solid #111", paddingBottom: 2,
          }}>
            Families
          </span>
        </div>
      </section>

      {/* ── PACKAGES ── */}
      <section style={{ padding: "0 60px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="pkg-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, alignItems: "stretch" }}>
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className="pkg-card"
              style={{
                border: pkg.popular ? "1.5px solid #1a1a1a" : "1px solid rgba(0,0,0,0.08)",
                padding: "40px 36px",
                background: pkg.popular ? "#1a1a1a" : "#fff",
                display: "flex", flexDirection: "column",
              }}
            >
              {pkg.popular && (
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.6rem", letterSpacing: "0.26em",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
                  marginBottom: 20,
                }}>
                  Most popular
                </p>
              )}
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem", letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: pkg.popular ? "rgba(255,255,255,0.55)" : "#bbb",
                marginBottom: 8,
              }}>
                {pkg.duration}
              </p>
              <h2 style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "1.5rem", fontWeight: 400,
                letterSpacing: "0.08em",
                color: pkg.popular ? "#fff" : "#111",
                margin: "0 0 4px",
              }}>
                {pkg.name}
              </h2>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "2.4rem", fontWeight: 300,
                color: pkg.popular ? "#fff" : "#111",
                margin: "12px 0 28px", letterSpacing: "0.04em",
              }}>
                {pkg.price}
              </p>
              <div style={{ width: 24, height: 1, background: pkg.popular ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)", marginBottom: 28 }} />
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flex: 1 }}>
                {pkg.includes.map((item) => (
                  <li key={item} style={{
                    fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                    fontSize: "0.9rem", color: pkg.popular ? "rgba(255,255,255,0.8)" : "#666",
                    lineHeight: 1.7, marginBottom: 8,
                    paddingLeft: 16, position: "relative",
                  }}>
                    <span style={{
                      position: "absolute", left: 0,
                      color: pkg.popular ? "rgba(255,255,255,0.4)" : "#bbb",
                      fontStyle: "normal",
                    }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
              {pkg.note && (
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                  fontSize: "0.78rem", color: pkg.popular ? "rgba(255,255,255,0.45)" : "#ccc",
                  marginBottom: 24,
                }}>
                  {pkg.note}
                </p>
              )}
              <Link href="/contact" style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.72rem", letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: pkg.popular ? "#1a1a1a" : "#fff",
                background: pkg.popular ? "#fff" : "#1a1a1a",
                padding: "13px 0",
                textDecoration: "none", display: "block", textAlign: "center",
              }}>
                Book this package →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── ADD-ONS ── */}
      <section style={{ padding: "0 60px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 60 }}>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.7rem", letterSpacing: "0.28em",
            textTransform: "uppercase", color: "#bbb", marginBottom: 36, textAlign: "center",
          }}>
            Add-ons
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, border: "1px solid rgba(0,0,0,0.07)" }}>
            {addOns.map((item) => (
              <div key={item.label} style={{ padding: "24px 28px", borderRight: "1px solid rgba(0,0,0,0.07)" }}>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                  fontSize: "0.9rem", color: "#555", marginBottom: 8, lineHeight: 1.5,
                }}>
                  {item.label}
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "1.1rem", fontWeight: 300, color: "#111",
                }}>
                  {item.price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: "0 60px 80px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 60 }}>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.7rem", letterSpacing: "0.28em",
            textTransform: "uppercase", color: "#bbb", marginBottom: 36, textAlign: "center",
          }}>
            Good to know
          </p>
          {[
            ["Where do we shoot?", "Anywhere in the Bay Area — parks, beaches, urban settings, or a meaningful spot to your family. I'm happy to suggest locations."],
            ["When is the best time for photos?", "Golden hour (1 hour before sunset) is ideal for the warmest, softest light. I can accommodate morning sessions too."],
            ["How many people can we include?", "The Standard and Extended packages include up to 6 and 8 people respectively. Additional members are available as an add-on."],
            ["How do I receive my photos?", "Via a private online gallery with full-resolution downloads, delivered within the promised window."],
          ].map(([q, a]) => (
            <div key={q} style={{ marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "1rem", fontWeight: 400, color: "#111", marginBottom: 10,
              }}>{q}</p>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.95rem", color: "#888", lineHeight: 1.75,
              }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop: "1px solid rgba(0,0,0,0.07)", padding: "80px 60px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
          fontSize: "clamp(1rem, 2vw, 1.3rem)", color: "#aaa", marginBottom: 32,
        }}>
          Ready to book a family session?
        </p>
        <Link href="/contact" style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.75rem", letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#fff",
          background: "#1a1a1a", padding: "14px 36px",
          textDecoration: "none", display: "inline-block",
        }}>
          Inquire now →
        </Link>
      </section>
    </main>
  );
}
