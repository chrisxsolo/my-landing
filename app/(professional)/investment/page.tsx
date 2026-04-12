import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Investment | soloxsnaps",
  description: "Photography investment and package starting points for soloxsnaps in San Francisco and the Bay Area.",
  alternates: { canonical: "/investment" },
  openGraph: {
    title: "Investment | soloxsnaps",
    description: "Photography investment and package starting points for soloxsnaps.",
    type: "website",
  },
};

const packages = [
  {
    name: "Portrait",
    price: "Starting at $250",
    details: "Individual portraits, personal branding, or a clean creative refresh.",
    includes: ["45–60 minute session", "One Bay Area location", "Edited online gallery"],
  },
  {
    name: "Graduation",
    price: "Starting at $300",
    details: "A polished gallery for grads who want a sharper, more editorial set.",
    includes: ["60–90 minute session", "Campus or city location", "Cap, gown, and detail shots"],
  },
  {
    name: "Events",
    price: "Custom quote",
    details: "Small events, celebrations, and coverage with a documentary feel.",
    includes: ["Hourly coverage", "Candid and detail images", "Edited online gallery"],
  },
];

const CSS = `
  .inv-row:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.07); }
  @media (max-width: 720px) {
    .inv-row-inner { grid-template-columns: 1fr !important; }
    .inv-includes { grid-template-columns: 1fr !important; }
  }
`;

export default function InvestmentPage() {
  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── PACKAGES ── */}
      <section style={{ padding: "64px 60px 100px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          {packages.map((item, index) => (
            <article key={item.name} className="inv-row" style={{ padding: "60px 0" }}>
              <div className="inv-row-inner" style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}>
                {/* Number */}
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "2.5rem",
                  fontWeight: 300,
                  color: "#e0e0e0",
                  margin: 0,
                  lineHeight: 1,
                }}>
                  {String(index + 1).padStart(2, "0")}
                </p>

                {/* Name + price + description */}
                <div>
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "0.68rem",
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "#666",
                    marginBottom: 12,
                  }}>
                    {item.name}
                  </p>
                  <h2 style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
                    fontWeight: 300,
                    letterSpacing: "0.04em",
                    color: "#111",
                    margin: "0 0 16px",
                    lineHeight: 1.2,
                  }}>
                    {item.price}
                  </h2>
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "0.95rem",
                    lineHeight: 1.75,
                    color: "#555",
                    margin: 0,
                  }}>
                    {item.details}
                  </p>
                </div>

                {/* Includes */}
                <ul className="inv-includes" style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 0,
                }}>
                  {item.includes.map((detail) => (
                    <li key={detail} style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "0.88rem",
                      color: "#555",
                      padding: "12px 0",
                      borderTop: "1px solid rgba(0,0,0,0.07)",
                      lineHeight: 1.5,
                    }}>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "100px 60px",
        maxWidth: 1100,
        margin: "0 auto",
        display: "grid",
        gap: "40px",
        alignItems: "end",
        gridTemplateColumns: "1fr auto",
      }}>
        <div>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.7rem",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#666",
            marginBottom: 20,
          }}>
            Availability
          </p>
          <h2 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(1.6rem, 3.5vw, 3.2rem)",
            fontWeight: 300,
            letterSpacing: "0.04em",
            color: "#111",
            lineHeight: 1.2,
            margin: "0 0 16px",
            maxWidth: 560,
          }}>
            Tell me the date, location, and what this is for.
          </h2>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "0.95rem",
            color: "#666",
            margin: 0,
          }}>
            I&rsquo;ll reply with availability, package fit, and a clear next step.
          </p>
        </div>
        <Link href="/contact" style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#fff",
          background: "#1a1a1a",
          padding: "14px 32px",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          Start an inquiry
        </Link>
      </section>
    </main>
  );
}
