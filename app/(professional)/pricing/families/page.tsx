import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings } from "@/lib/professionalData";

export const metadata: Metadata = {
  title: "Family Pricing | soloxsnaps",
  description: "Family photography pricing by Chris Solorzano — Bay Area family portraits.",
  alternates: { canonical: "/pricing/families" },
};

const CSS = `
  .pricing-page {
    --pricing-ink: #111513;
    --pricing-copy: #303635;
    --pricing-muted: #596260;
    --pricing-surface: #f7f8f5;
    --pricing-line: rgba(17, 21, 19, 0.1);
    background: #fff;
    color: var(--pricing-ink);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .pricing-page h2,
  .pricing-page p,
  .pricing-page li,
  .pricing-page span,
  .pricing-page a {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    letter-spacing: 0 !important;
  }
  .pricing-page h2 {
    color: var(--pricing-ink) !important;
    font-weight: 720 !important;
    line-height: 1.05 !important;
  }
  .pricing-page p,
  .pricing-page li,
  .pricing-page span {
    color: var(--pricing-copy) !important;
  }
  .pricing-page p,
  .pricing-page li {
    font-style: normal !important;
  }
  .pricing-page li {
    font-size: 1rem !important;
    line-height: 1.75 !important;
    margin-bottom: 12px !important;
  }
  .pricing-page p[style*="text-transform"] {
    color: var(--pricing-muted) !important;
    font-size: 0.76rem !important;
    font-weight: 720 !important;
  }
  .pricing-page [style*="font-size: 3rem"] {
    color: var(--pricing-ink) !important;
    font-size: clamp(3.1rem, 7vw, 4.8rem) !important;
    font-weight: 720 !important;
    line-height: 0.95 !important;
  }
  .pricing-page a {
    border-radius: 8px !important;
    background: #141716 !important;
    color: #fff !important;
    font-weight: 720 !important;
  }
  .booking-details-section {
    max-width: 1160px !important;
    padding-top: 92px !important;
    padding-bottom: 76px !important;
  }
  .pricing-page .booking-details-section > p {
    color: var(--pricing-ink) !important;
    font-size: 1rem !important;
    font-weight: 800 !important;
    margin-bottom: 34px !important;
  }
  .booking-details-section > div {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 18px !important;
  }
  .booking-details-section > div > div {
    min-height: 100%;
    padding: 24px;
    border: 1px solid var(--pricing-line);
    border-radius: 8px;
    background: var(--pricing-surface);
  }
  .pricing-page .booking-details-section > div > div > p:first-child {
    color: var(--pricing-ink) !important;
    font-size: 0.86rem !important;
    font-weight: 800 !important;
    margin-bottom: 16px !important;
  }
  .booking-details-section > div > div > p:not(:first-child) {
    color: var(--pricing-copy) !important;
    font-size: 1.04rem !important;
    line-height: 1.65 !important;
    margin-bottom: 14px !important;
    padding-left: 22px !important;
  }
  .booking-details-section span {
    color: #6e7673 !important;
  }
  @media (max-width: 760px) {
    .split-layout { flex-direction: column !important; }
    .split-img { flex: unset !important; height: 300px !important; width: 100% !important; }
    .pricing-section { padding-left: 24px !important; padding-right: 24px !important; }
    .booking-details-section {
      padding-top: 64px !important;
      padding-bottom: 58px !important;
    }
    .booking-details-section > div {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
    .booking-details-section > div > div {
      padding: 20px;
    }
    .booking-details-section > div > div > p:not(:first-child) {
      font-size: 1rem !important;
    }
  }
`;

const addOns = [
  { label: "Additional nearby location", price: "$25" },
  { label: "72-hour expedited delivery", price: "$75" },
  { label: "Extended family members (beyond immediate family)", price: "$50–$75" },
  { label: "Additional time (if needed mid-session)", price: "$100 / 30 min" },
];

export default async function FamilyPricingPage() {
  const [{ images }, siteSettings] = await Promise.all([getPortfolioData(), getSiteSettings()]);
  const familyImages = images.filter((img) => img.category_slug === "families");
  const sessionImage = siteSettings.pricing_family_session_image || familyImages[1]?.image_url || familyImages[0]?.image_url || null;
  const extendedImage = siteSettings.pricing_family_extended_image || familyImages[2]?.image_url || familyImages[0]?.image_url || null;

  return (
    <main className="pricing-page" style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── IMPORTANT INFO ── */}
      <section className="pricing-section booking-details-section" style={{ padding: "72px 60px 64px", maxWidth: 960, margin: "0 auto" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.65rem", letterSpacing: "0.28em",
          textTransform: "uppercase", color: "#555", marginBottom: 40, textAlign: "center",
        }}>
          Important info
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
          {[
            {
              heading: "Booking & Payment",
              items: [
                "A 50% deposit is required for each photo shoot to book",
                "The remaining balance is paid after the photoshoot",
                "A contract must be signed prior to the photo session",
              ],
            },
            {
              heading: "Session Details",
              items: [
                "All rates are hourly",
                "Some locations will have travel fees",
              ],
            },
            {
              heading: "Travel",
              items: [
                "Locations greater than a 20-mile radius of San Francisco will include a travel fee ranging from $20–$50",
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

      {/* ── FAMILY SESSION ── */}
      <section className="pricing-section" style={{ padding: "0 60px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 72 }}>
          <div className="split-layout" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>

            {/* Text */}
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <h2 style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(1.6rem, 3vw, 2.6rem)", fontWeight: 300,
                letterSpacing: "0.05em", color: "#111",
                margin: "0 0 20px", lineHeight: 1.15,
              }}>
                Family Session
              </h2>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.92rem", color: "#555", lineHeight: 1.85, marginBottom: 32,
              }}>
                Ideal for families who want updated photos without a long session or overstimulation.
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px" }}>
                {[
                  "Up to 30 minutes",
                  "One location",
                  "Guided, relaxed session",
                  "Minimum 10 professionally edited images",
                  "Private online gallery",
                  "Standard turnaround",
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
                textTransform: "uppercase", color: "#555", marginBottom: 16,
              }}>
                Add-ons
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
                  textTransform: "uppercase", color: "#555", marginBottom: 6,
                }}>
                  Investment
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.78rem", fontStyle: "italic", color: "#555", marginBottom: 8,
                }}>
                  Starting from
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "3rem", fontWeight: 300, color: "#111",
                  margin: "0", letterSpacing: "0.02em",
                }}>
                  $350
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
            {sessionImage && (
              <div className="split-img" style={{ flex: "0 0 400px", height: 540, overflow: "hidden" }}>
                <img
                  src={sessionImage}
                  alt="Family portrait"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── EXTENDED FAMILY SESSION ── */}
      <section className="pricing-section" style={{ padding: "0 60px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 72 }}>
          <div className="split-layout" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>

            {/* Image first */}
            {extendedImage && (
              <div className="split-img" style={{ flex: "0 0 400px", height: 540, overflow: "hidden" }}>
                <img
                  src={extendedImage}
                  alt="Extended family portrait"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
                />
              </div>
            )}

            {/* Text */}
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <h2 style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(1.6rem, 3vw, 2.6rem)", fontWeight: 300,
                letterSpacing: "0.05em", color: "#111",
                margin: "0 0 20px", lineHeight: 1.15,
              }}>
                Extended Family Session
              </h2>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
                fontSize: "0.92rem", color: "#555", lineHeight: 1.85, marginBottom: 32,
              }}>
                Best for larger families, younger kids, or anyone who wants more variety and flexibility.
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px" }}>
                {[
                  "Up to 60 minutes",
                  "One location",
                  "More time for kids to warm up",
                  "Greater variety of groupings and moments",
                  "Minimum 30 professionally edited images",
                  "Private online gallery",
                  "Standard turnaround",
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
                textTransform: "uppercase", color: "#555", marginBottom: 16,
              }}>
                Add-ons
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
                  textTransform: "uppercase", color: "#555", marginBottom: 6,
                }}>
                  Investment
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.78rem", fontStyle: "italic", color: "#555", marginBottom: 8,
                }}>
                  Starting from
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "3rem", fontWeight: 300, color: "#111",
                  margin: "0", letterSpacing: "0.02em",
                }}>
                  $500
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
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop: "1px solid rgba(0,0,0,0.07)", padding: "80px 60px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
          fontSize: "clamp(1rem, 2vw, 1.3rem)", color: "#555", marginBottom: 32,
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
