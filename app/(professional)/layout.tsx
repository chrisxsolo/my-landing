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
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#1a1a1a" }}>
      <ProNav />
      {children}

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "72px 60px 48px",
        background: "#ffffff",
      }}>
        <div style={{
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
              color: "#666",
              marginBottom: 16,
            }}>
              graduation &amp; family photography
            </p>
            <p style={{ fontSize: "0.82rem", lineHeight: 1.75, color: "#666", maxWidth: 280 }}>
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
              color: "#888",
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
              color: "#888",
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
        <div style={{
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
          <p style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: "#888", textTransform: "uppercase" }}>
            © {new Date().getFullYear()} soloxsnaps
          </p>
          <p style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: "#888", textTransform: "uppercase" }}>
            San Francisco, CA
          </p>
        </div>
      </footer>
    </div>
  );
}
