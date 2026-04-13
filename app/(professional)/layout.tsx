import Link from "next/link";
import ProNav from "@/app/components/ProNav";

const footerLinks = [
  { label: "Grad gallery", href: "/portfolio?category=grads" },
  { label: "Family gallery", href: "/portfolio?category=families" },
  { label: "Grad rates", href: "/pricing/grads" },
  { label: "Family rates", href: "/pricing/families" },
  { label: "Dates", href: "/availability" },
  { label: "Contact", href: "/contact" },
];

export default function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="professional-shell">
      <style>{`
        .professional-shell {
          min-height: 100vh;
          background: #f7faf8;
          color: #101412;
          font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
        }
        .professional-shell * {
          box-sizing: border-box;
        }
        .professional-shell img {
          max-width: 100%;
        }
        .professional-footer {
          padding: 72px 24px 36px;
          background: #f7faf8;
        }
        .professional-footer-inner {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 28px;
          border: 1px solid rgba(18, 24, 22, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 0 14px 34px rgba(18, 24, 22, 0.06);
        }
        .professional-footer-top {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 40px;
          align-items: end;
          padding-bottom: 28px;
          border-bottom: 1px solid rgba(18, 24, 22, 0.1);
        }
        .professional-footer-brand {
          margin: 0 0 14px;
          color: #0e1412;
          font-size: 28px;
          font-weight: 860;
          letter-spacing: 0;
          line-height: 1;
        }
        .professional-footer-copy {
          max-width: 520px;
          margin: 0;
          color: #4d5a55;
          font-size: 16px;
          line-height: 1.75;
        }
        .professional-footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }
        .professional-footer-link {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          padding: 0 13px;
          border: 1px solid rgba(18, 24, 22, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.72);
          color: #26312d;
          font-size: 13px;
          font-weight: 760;
          letter-spacing: 0;
          text-decoration: none;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .professional-footer-link:hover {
          background: #ffffff;
          transform: translateY(-1px);
        }
        .professional-footer-bottom {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding-top: 24px;
          color: #64716d;
          font-size: 13px;
          font-weight: 680;
          letter-spacing: 0;
        }
        @media (max-width: 760px) {
          .professional-shell main {
            padding-top: 76px !important;
          }
          .professional-shell section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .professional-shell h1,
          .professional-shell h2 {
            overflow-wrap: anywhere;
          }
          .professional-footer {
            padding: 48px 14px 24px;
          }
          .professional-footer-inner {
            padding: 20px;
          }
          .professional-footer-top {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .professional-footer-brand {
            font-size: 24px;
          }
          .professional-footer-links {
            justify-content: flex-start;
          }
          .professional-footer-bottom {
            flex-direction: column;
          }
        }
      `}</style>
      <ProNav />
      {children}

      <footer className="professional-footer">
        <div className="professional-footer-inner">
          <div className="professional-footer-top">
            <div>
              <p className="professional-footer-brand">soloxsnaps</p>
              <p className="professional-footer-copy">
                Bay Area graduation and family photography with clean direction, real light, and galleries that feel ready to share.
              </p>
            </div>

            <nav className="professional-footer-links" aria-label="Footer navigation">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="professional-footer-link">
                  {link.label}
                </Link>
              ))}
              <a
                href="https://www.instagram.com/soloxsnaps"
                target="_blank"
                rel="noopener noreferrer"
                className="professional-footer-link"
              >
                Instagram
              </a>
            </nav>
          </div>

          <div className="professional-footer-bottom">
            <span>© {new Date().getFullYear()} soloxsnaps</span>
            <span>San Francisco, California</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
