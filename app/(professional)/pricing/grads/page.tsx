import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData } from "@/lib/professionalData";

export const metadata: Metadata = {
  title: "Grad Pricing | soloxsnaps",
  description: "Graduation photography pricing by Chris Solorzano — Bay Area grad portraits.",
  alternates: { canonical: "/pricing/grads" },
};

const CSS = `
  @media (max-width: 760px) {
    .split-layout { flex-direction: column !important; }
    .split-img { flex: unset !important; height: 300px !important; width: 100% !important; }
    .pricing-section { padding-left: 24px !important; padding-right: 24px !important; }
    .group-grid { grid-template-columns: 1fr !important; }
    .group-image { height: 260px !important; margin-bottom: 42px !important; }
  }
`;

const addOns = [
  { label: "Additional outfit", price: "$75" },
  { label: "Second nearby off-campus location", price: "$25" },
  { label: "72-hour expedited delivery", price: "$75" },
  { label: "Celebratory elements (champagne or confetti)", price: "On request" },
  { label: "Extended time", price: "$50 / 30 min" },
];

const groupPricing = [
  { people: "2 People", price: "$300", unit: "per person" },
  { people: "3 People", price: "$275", unit: "per person" },
  { people: "4 People", price: "$250", unit: "per person" },
  { people: "5 People", price: "$225", unit: "per person" },
  { people: "6–8 People", price: "$200", unit: "per person" },
];

const GROUP_GRAD_IMAGE_URL =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/portfolio/1775960037598.jpeg";

export default async function GradPricingPage() {
  const { images } = await getPortfolioData();
  const gradImages = images.filter((img) => img.category_slug === "grads");
  const packageImage = gradImages[1]?.image_url ?? gradImages[0]?.image_url ?? null;
  const groupImage =
    gradImages.find((img) => img.image_url === GROUP_GRAD_IMAGE_URL)?.image_url ??
    gradImages.find((img) => `${img.title} ${img.alt}`.toLowerCase().includes("group"))?.image_url ??
    gradImages[6]?.image_url ??
    packageImage;

  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── BOOKING DETAILS ── */}
      <section className="pricing-section" style={{ padding: "72px 60px 64px", maxWidth: 960, margin: "0 auto" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.65rem", letterSpacing: "0.28em",
          textTransform: "uppercase", color: "#555", marginBottom: 40, textAlign: "center",
        }}>
          Booking details
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
          {[
            {
              heading: "Booking & Payment",
              items: [
                "A 50% deposit is required to secure your session",
                "The remaining balance is due on the day of the photoshoot",
                "A signed contract is required prior to the session",
              ],
            },
            {
              heading: "Session Details",
              items: [
                "All rates are hourly",
                "Session length scales based on group size",
              ],
            },
            {
              heading: "Travel",
              items: [
                "Locations outside a 20-mile radius of San Francisco may include a travel fee ranging from $20–$75",
              ],
            },
          ].map(({ heading, items }) => (
            <div key={heading}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.58rem", letterSpacing: "0.24em",
                textTransform: "uppercase", color: "#555", marginBottom: 14,
              }}>
                {heading}
              </p>
              {items.map((item) => (
                <p key={item} style={{
                  fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                  fontSize: "0.88rem", color: "#555", lineHeight: 1.8,
                  marginBottom: 8, paddingLeft: 16, position: "relative",
                }}>
                  <span style={{ position: "absolute", left: 0, fontStyle: "normal", color: "#555" }}>—</span>
                  {item}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── STANDARD PACKAGE ── */}
      <section className="pricing-section" style={{ padding: "0 60px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 72 }}>
          <div className="split-layout" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>

            {/* Text */}
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem", letterSpacing: "0.28em",
                textTransform: "uppercase", color: "#555", marginBottom: 16,
              }}>
                Standard
              </p>
              <h2 style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(1.6rem, 3vw, 2.6rem)", fontWeight: 300,
                letterSpacing: "0.05em", color: "#111",
                margin: "0 0 24px", lineHeight: 1.15,
              }}>
                Graduation Package
              </h2>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.92rem", color: "#555", lineHeight: 1.85, marginBottom: 32,
              }}>
                Ideal for graduates who want a cohesive, elevated gallery without feeling rushed or over-posed.
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px" }}>
                {[
                  "Approximately 1 hour on campus",
                  "Professionally guided session with posing and direction throughout",
                  "One curated outfit look",
                  "Multiple on-campus location selection",
                  "Private online gallery",
                  "50+ professionally edited images",
                  "Standard two-week turnaround",
                ].map((item) => (
                  <li key={item} style={{
                    fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                    fontSize: "0.9rem", color: "#555", lineHeight: 1.7,
                    marginBottom: 10, paddingLeft: 18, position: "relative",
                  }}>
                    <span style={{ position: "absolute", left: 0, fontStyle: "normal", color: "#555" }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>

              {/* Add-ons */}
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.58rem", letterSpacing: "0.24em",
                textTransform: "uppercase", color: "#555", marginBottom: 6,
              }}>
                Add-ons
              </p>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.78rem", color: "#555", marginBottom: 16,
              }}>
                Available upon request and subject to scheduling
              </p>
              {addOns.map((item) => (
                <div key={item.label} style={{
                  display: "flex", justifyContent: "space-between",
                  borderBottom: "1px solid rgba(0,0,0,0.05)", padding: "10px 0", maxWidth: 440,
                }}>
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                    fontSize: "0.85rem", color: "#555",
                  }}>
                    {item.label}
                  </p>
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "0.85rem", color: "#333",
                    whiteSpace: "nowrap", marginLeft: 20,
                  }}>
                    {item.price}
                  </p>
                </div>
              ))}

              {/* Price */}
              <div style={{ marginTop: 44, paddingTop: 36, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.58rem", letterSpacing: "0.24em",
                  textTransform: "uppercase", color: "#555", marginBottom: 10,
                }}>
                  Investment
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "3rem", fontWeight: 300, color: "#111",
                  margin: "0 0 4px", letterSpacing: "0.02em",
                }}>
                  $350
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                  fontSize: "0.85rem", color: "#555",
                }}>
                  per hour
                </p>
              </div>

              <Link href="/contact" style={{
                display: "inline-block", marginTop: 32,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.72rem", letterSpacing: "0.18em",
                textTransform: "uppercase", color: "#fff",
                background: "#1a1a1a", padding: "13px 32px",
                textDecoration: "none",
              }}>
                Book this session →
              </Link>
            </div>

            {/* Image */}
            {packageImage && (
              <div className="split-img" style={{ flex: "0 0 400px", height: 580, overflow: "hidden" }}>
                <img
                  src={packageImage}
                  alt="Graduation portrait"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── GROUP PACKAGE ── */}
      <section className="pricing-section" style={{ padding: "0 60px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 72 }}>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.65rem", letterSpacing: "0.28em",
            textTransform: "uppercase", color: "#555", marginBottom: 16,
          }}>
            Group sessions
          </p>
          <h2 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(1.6rem, 3vw, 2.6rem)", fontWeight: 300,
            letterSpacing: "0.05em", color: "#111",
            margin: "0 0 24px", lineHeight: 1.15,
          }}>
            Group Grad Package
          </h2>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
            fontSize: "0.92rem", color: "#555", lineHeight: 1.85,
            marginBottom: 10, maxWidth: 620,
          }}>
            Perfect for friends who want individual portraits and celebratory group photos all in one experience.
            Each graduate receives dedicated posing, direction, and time in front of the camera.
          </p>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
            fontSize: "0.88rem", color: "#555", lineHeight: 1.75,
            marginBottom: 52, maxWidth: 520,
          }}>
            Sessions are designed to feel organized, efficient, and elevated — not rushed.
          </p>

          {groupImage && (
            <div className="group-image" style={{ height: 420, margin: "0 0 56px", overflow: "hidden" }}>
              <img
                src={groupImage}
                alt="Group graduation portraits"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 62%", display: "block" }}
              />
            </div>
          )}

          <div className="group-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60 }}>
            {/* Services */}
            <div>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.58rem", letterSpacing: "0.24em",
                textTransform: "uppercase", color: "#555", marginBottom: 16,
              }}>
                What&apos;s included
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "Individual portraits for each graduate",
                  "Multiple group photo combinations",
                  "Professionally guided posing and direction",
                  "Strategic on-campus location planning",
                  "Private online gallery delivery",
                  "Professionally edited images per person",
                ].map((item) => (
                  <li key={item} style={{
                    fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                    fontSize: "0.9rem", color: "#555", lineHeight: 1.7,
                    marginBottom: 10, paddingLeft: 18, position: "relative",
                  }}>
                    <span style={{ position: "absolute", left: 0, fontStyle: "normal", color: "#555" }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pricing */}
            <div>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.58rem", letterSpacing: "0.24em",
                textTransform: "uppercase", color: "#555", marginBottom: 16,
              }}>
                Pricing
              </p>
              {groupPricing.map((row) => (
                <div key={row.people} style={{
                  display: "flex", alignItems: "baseline",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "13px 0",
                }}>
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "0.92rem", color: "#555",
                  }}>
                    {row.people}
                  </p>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "1.15rem", fontWeight: 300, color: "#111",
                    }}>
                      {row.price}
                    </span>
                    <span style={{
                      fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                      fontSize: "0.78rem", color: "#555", marginLeft: 6,
                    }}>
                      {row.unit}
                    </span>
                  </div>
                </div>
              ))}
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.82rem", color: "#555", lineHeight: 1.7, marginTop: 20,
              }}>
                Sessions with 3 or more graduates require at least 90 minutes to maintain quality and flow.
              </p>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.82rem", color: "#555", lineHeight: 1.7, marginTop: 8,
              }}>
                Add-ons available upon request including additional outfits, extended time, and expedited delivery.
              </p>
            </div>
          </div>

          <Link href="/contact" style={{
            display: "inline-block", marginTop: 44,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.72rem", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#fff",
            background: "#1a1a1a", padding: "13px 32px",
            textDecoration: "none",
          }}>
            Inquire about group session →
          </Link>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop: "1px solid rgba(0,0,0,0.07)", padding: "80px 60px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
          fontSize: "clamp(1rem, 2vw, 1.3rem)", color: "#555", marginBottom: 32,
        }}>
          Ready to book your grad session?
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
