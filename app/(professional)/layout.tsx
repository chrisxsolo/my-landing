import Link from "next/link";
import ProNav from "@/app/components/ProNav";

const footerLinks = [
  { label: "Grads",    href: "/portfolio?category=grads" },
  { label: "Families", href: "/portfolio?category=families" },
  { label: "About",    href: "/about" },
  { label: "Blog",     href: "/blog" },
  { label: "Contact",  href: "/contact" },
];

export default function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="professional-shell" style={{ minHeight: "100vh", background: "#ffffff", color: "#1a1a1a" }}>
      <style>{`
        @media (max-width: 760px) {
          .professional-shell {
            overflow-x: hidden;
          }
          .professional-shell main {
            padding-top: 72px !important;
          }
          .professional-shell section {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
          .professional-shell header:not(.pro-header) {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
          .professional-shell h1 {
            font-size: clamp(2.2rem, 13vw, 4rem) !important;
            line-height: 1.05 !important;
            overflow-wrap: anywhere;
          }
          .professional-shell h2 {
            overflow-wrap: anywhere;
          }
          .professional-shell img {
            max-width: 100%;
          }
          .professional-shell section[style*="grid-template-columns"],
          .professional-shell section > div[style*="grid-template-columns"],
          .professional-shell article > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
          .professional-footer {
            padding: 56px 24px 36px !important;
          }
          .professional-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 34px !important;
            margin-bottom: 42px !important;
          }
          .professional-footer-bottom {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
        }
      `}</style>
      <ProNav />
      {children}

      {/* ── FOOTER ── */}
      <footer className="professional-footer" style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "72px 60px 48px",
        background: "#ffffff",
      }}>
        <div className="professional-footer-grid" style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr",
          gap: "48px",
          marginBottom: 60,
        }}>
          {/* Brand */}
          <div>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "1.1rem",
              fontWeight: 400,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#111",
              marginBottom: 14,
            }}>
              soloxsnaps
            </p>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: "0.9rem",
              color: "#555",
              marginBottom: 16,
            }}>
              graduation &amp; family photography
            </p>
            <p style={{ fontSize: "0.82rem", lineHeight: 1.75, color: "#555", maxWidth: 280 }}>
              Chris Solorzano — Bay Area photographer specializing in honest graduation portraits and family sessions.
            </p>
          </div>

          {/* Nav */}
          <div>
            <p style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 20,
            }}>
              Navigate
            </p>
            {footerLinks.map((link) =>
              link.href.startsWith("http") ? (
                <a key={link.href} href={link.href} style={{
                  display: "block",
                  fontSize: "0.8rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#555",
                  textDecoration: "none",
                  marginBottom: 12,
                  transition: "color 0.2s ease",
                }}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} style={{
                  display: "block",
                  fontSize: "0.8rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#555",
                  textDecoration: "none",
                  marginBottom: 12,
                }}>
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Connect */}
          <div>
            <p style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 20,
            }}>
              Connect
            </p>
            <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer" style={{
              display: "block", fontSize: "0.8rem", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#555", textDecoration: "none", marginBottom: 12,
            }}>
              Instagram
            </a>
            <Link href="/home" style={{
              display: "block", fontSize: "0.8rem", letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#555", textDecoration: "none", marginBottom: 12,
            }}>
              Fun Site
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="professional-footer-bottom" style={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          paddingTop: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1200,
          margin: "0 auto",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <p style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: "#555", textTransform: "uppercase" }}>
            © {new Date().getFullYear()} soloxsnaps
          </p>
          <p style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: "#555", textTransform: "uppercase" }}>
            San Francisco, CA
          </p>
        </div>
      </footer>
    </div>
  );
}
