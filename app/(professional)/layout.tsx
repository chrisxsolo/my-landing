import Link from "next/link";
import ProNav from "@/app/components/ProNav";
import ScrollReveal from "@/app/components/ScrollReveal";

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
        /* ── DESIGN TOKENS ───────────────────────────────────────────────────────
           Global CSS custom properties used across all professional pages.
           Edit values here to change the look of the whole site at once. */
        :root {
          --ink:           #101412;      /* primary text */
          --ink-muted:     #4b5a55;      /* secondary text */
          --ink-dim:       #667f79;      /* captions, kickers */
          --bg:            #f5f6f4;      /* page background */
          --bg-white:      #ffffff;      /* card/section white */
          --accent:        #3d6b5e;      /* green CTA / link accent */
          --accent-light:  #4f6d67;      /* lighter accent variant */
          --glass:         rgba(255,255,255,0.82);   /* frosted glass card fill */
          --glass-border:  rgba(18,24,22,0.08);      /* card border */
          --glass-shadow:  0 4px 18px rgba(18,24,22,0.06); /* card resting shadow */
          --glass-shadow-lg: 0 12px 36px rgba(18,24,22,0.09); /* card hover shadow */
          --blur:          blur(16px);   /* standard backdrop blur */
          --blur-strong:   blur(24px);   /* nav / prominent elements */
          --radius-sm:     8px;
          --radius-md:     14px;
          --radius-lg:     20px;
          --transition:    0.22s cubic-bezier(0.22,1,0.36,1);
        }

        /* ── SCROLL REVEAL ───────────────────────────────────────────────────────
           Only active when JS has loaded (.js-scroll-reveal on <html>).
           Elements remain fully visible if JS is disabled — no FOIC.

           Usage:
             <div data-reveal>…</div>              → fades up (default)
             <div data-reveal="left">…</div>       → slides from left
             <div data-reveal="scale">…</div>      → scales up
             <div data-reveal data-delay="2">…</div> → staggered (1–5) */
        .js-scroll-reveal [data-reveal] {
          opacity: 0;
          transform: translateY(20px);
          /* will-change tells the browser to promote this to its own GPU layer
             before the animation starts — eliminates jank during scroll */
          will-change: transform, opacity;
          transition: opacity 0.5s cubic-bezier(0.22,1,0.36,1),
                      transform 0.5s cubic-bezier(0.22,1,0.36,1);
        }
        .js-scroll-reveal [data-reveal="left"] {
          transform: translateX(-24px);
        }
        .js-scroll-reveal [data-reveal="scale"] {
          transform: scale(0.95);
        }

        /* Visible state — GPU layer released after animation via will-change: auto */
        .js-scroll-reveal [data-reveal][data-visible="true"] {
          opacity: 1;
          transform: none;
          will-change: auto;
        }

        /* Stagger delays: data-delay="1" through data-delay="5" */
        .js-scroll-reveal [data-delay="1"] { transition-delay: 0.06s; }
        .js-scroll-reveal [data-delay="2"] { transition-delay: 0.12s; }
        .js-scroll-reveal [data-delay="3"] { transition-delay: 0.18s; }
        .js-scroll-reveal [data-delay="4"] { transition-delay: 0.24s; }
        .js-scroll-reveal [data-delay="5"] { transition-delay: 0.30s; }

        /* ── GLASS SHIMMER ───────────────────────────────────────────────────────
           Add class="glass-shimmer" to any card element.
           On hover, a diagonal light sweep crosses the card surface.
           will-change on ::before ensures the sweep is GPU-composited. */
        .glass-shimmer {
          position: relative;
          overflow: hidden;
        }
        .glass-shimmer::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            115deg,
            transparent 30%,
            rgba(255,255,255,0.30) 50%,
            transparent 70%
          );
          transform: translateX(-110%);
          will-change: transform;
          transition: transform 0.55s cubic-bezier(0.22,1,0.36,1);
          pointer-events: none;
          z-index: 1;
        }
        .glass-shimmer:hover::before {
          transform: translateX(110%);
        }

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
      <ScrollReveal />
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
