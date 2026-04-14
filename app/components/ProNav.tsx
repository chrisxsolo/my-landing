"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryLinks = [
  { label: "Home", href: "/" },
  { label: "Dates", href: "/availability" },
  { label: "About", href: "/about" },
  { label: "Journal", href: "/blog" },
];

const portfolioLinks = [
  { label: "Grad gallery", href: "/portfolio?category=grads" },
  { label: "Family gallery", href: "/portfolio?category=families" },
];

const pricingLinks = [
  { label: "Grad rates", href: "/pricing/grads" },
  { label: "Family rates", href: "/pricing/families" },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

export default function ProNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const isPortfolioActive = portfolioLinks.some((link) => isActive(pathname, link.href));
  const isPricingActive = pricingLinks.some((link) => isActive(pathname, link.href));

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setPortfolioOpen(false);
        setPricingOpen(false);
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setPortfolioOpen(false);
        setPricingOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setPortfolioOpen(false);
    setPricingOpen(false);
  }, [pathname]);

  const renderDropdownLink = (link: { label: string; href: string }) => (
    <Link
      key={link.href}
      href={link.href}
      className="pro-nav-dropdown-link"
      aria-current={isActive(pathname, link.href) ? "page" : undefined}
    >
      {link.label}
    </Link>
  );

  return (
    <>
      <style>{`
        .pro-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          padding: 14px 24px;
          pointer-events: none;
        }
        .pro-nav-shell {
          width: min(1180px, 100%);
          min-height: 58px;
          margin: 0 auto;
          padding: 7px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
          border: 1px solid rgba(18, 24, 22, 0.11);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 12px 28px rgba(16, 24, 22, 0.1);
          pointer-events: auto;
        }
        .pro-nav-brand,
        .pro-nav-link,
        .pro-nav-button,
        .pro-nav-cta,
        .pro-nav-dropdown-link {
          font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0;
          text-decoration: none;
        }
        .pro-nav-brand {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
          padding: 0 14px;
          color: #0e1412;
          font-size: 17px;
          font-weight: 820;
          line-height: 1;
        }
        .pro-desktop-nav {
          justify-self: center;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 8px;
          background: rgba(245, 249, 247, 0.72);
        }
        .pro-nav-link,
        .pro-nav-button {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 12px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #2f3835;
          cursor: pointer;
          font-size: 13px;
          font-weight: 740;
          line-height: 1;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }
        .pro-nav-link:hover,
        .pro-nav-button:hover,
        .pro-nav-link[aria-current="page"],
        .pro-nav-button[aria-current="page"] {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(18, 24, 22, 0.1);
          color: #0e1412;
        }
        .pro-nav-caret {
          color: #687571;
          font-size: 10px;
          line-height: 1;
        }
        .pro-nav-actions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pro-nav-cta {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 18px;
          border: 1px solid rgba(112, 139, 133, 0.22);
          border-radius: 8px;
          background: rgba(246, 250, 248, 0.94);
          color: #4f6d67;
          box-shadow: 0 8px 20px rgba(112, 139, 133, 0.05);
          font-size: 13px;
          font-weight: 820;
          line-height: 1;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .pro-nav-cta:hover {
          transform: translateY(-1px);
          border-color: rgba(112, 139, 133, 0.32);
          background: rgba(239, 246, 244, 0.98);
          box-shadow: 0 12px 26px rgba(112, 139, 133, 0.07);
        }
        .pro-dropdown-wrap {
          position: relative;
        }
        .pro-nav-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          min-width: 194px;
          padding: 7px;
          display: grid;
          gap: 3px;
          border: 1px solid rgba(18, 24, 22, 0.12);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 16px 34px rgba(16, 24, 22, 0.14);
          transform: translateX(-50%);
        }
        .pro-nav-dropdown-link {
          min-height: 40px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 8px;
          color: #2f3835;
          font-size: 13px;
          font-weight: 720;
        }
        .pro-nav-dropdown-link:hover,
        .pro-nav-dropdown-link[aria-current="page"] {
          background: rgba(112, 139, 133, 0.1);
          color: #0d1412;
        }
        .pro-mobile-button,
        .pro-mobile-panel {
          display: none;
        }
        @media (max-width: 880px) {
          .pro-header {
            padding: 10px 12px;
          }
          .pro-nav-shell {
            grid-template-columns: 1fr auto;
            min-height: 56px;
          }
          .pro-desktop-nav,
          .pro-nav-actions {
            display: none;
          }
          .pro-mobile-button {
            display: inline-flex;
          }
          .pro-mobile-panel {
            position: absolute;
            top: calc(100% + 10px);
            left: 0;
            right: 0;
            display: grid;
            gap: 8px;
            max-height: calc(100svh - 86px);
            overflow-y: auto;
            padding: 10px;
            border: 1px solid rgba(18, 24, 22, 0.12);
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 16px 34px rgba(16, 24, 22, 0.14);
          }
          .pro-mobile-panel .pro-nav-link,
          .pro-mobile-panel .pro-nav-button,
          .pro-mobile-panel .pro-nav-cta {
            width: 100%;
            min-height: 46px;
            justify-content: space-between;
            padding: 0 14px;
          }
          .pro-mobile-panel .pro-nav-cta {
            justify-content: center;
            margin-top: 6px;
          }
          .pro-mobile-submenu {
            display: grid;
            gap: 4px;
            padding: 4px 0 8px 12px;
          }
          .pro-mobile-submenu .pro-nav-dropdown-link {
            min-height: 40px;
            background: rgba(245, 249, 247, 0.82);
          }
        }
      `}</style>

      <header ref={navRef} className="pro-header">
        <div className="pro-nav-shell">
          <Link href="/" className="pro-nav-brand" aria-label="soloxsnaps home">
            soloxsnaps
          </Link>

          <nav className="pro-desktop-nav" aria-label="Primary navigation">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="pro-nav-link"
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}

            <div className="pro-dropdown-wrap">
              <button
                className="pro-nav-button"
                type="button"
                aria-current={isPortfolioActive ? "page" : undefined}
                aria-expanded={portfolioOpen}
                onClick={() => {
                  setPortfolioOpen((open) => !open);
                  setPricingOpen(false);
                }}
              >
                Work <span className="pro-nav-caret">{portfolioOpen ? "^" : "v"}</span>
              </button>
              {portfolioOpen && <div className="pro-nav-dropdown">{portfolioLinks.map(renderDropdownLink)}</div>}
            </div>

            <div className="pro-dropdown-wrap">
              <button
                className="pro-nav-button"
                type="button"
                aria-current={isPricingActive ? "page" : undefined}
                aria-expanded={pricingOpen}
                onClick={() => {
                  setPricingOpen((open) => !open);
                  setPortfolioOpen(false);
                }}
              >
                Rates <span className="pro-nav-caret">{pricingOpen ? "^" : "v"}</span>
              </button>
              {pricingOpen && <div className="pro-nav-dropdown">{pricingLinks.map(renderDropdownLink)}</div>}
            </div>
          </nav>

          <div className="pro-nav-actions">
            <Link href="/contact" className="pro-nav-cta">
              Book a shoot
            </Link>
          </div>

          <button
            className="pro-nav-button pro-mobile-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="pro-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu <span className="pro-nav-caret">{menuOpen ? "x" : "v"}</span>
          </button>

          {menuOpen && (
            <nav id="pro-mobile-menu" className="pro-mobile-panel" aria-label="Mobile navigation">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pro-nav-link"
                  aria-current={isActive(pathname, link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}

              <button
                className="pro-nav-button"
                type="button"
                aria-expanded={portfolioOpen}
                onClick={() => {
                  setPortfolioOpen((open) => !open);
                  setPricingOpen(false);
                }}
              >
                Work <span className="pro-nav-caret">{portfolioOpen ? "^" : "v"}</span>
              </button>
              {portfolioOpen && <div className="pro-mobile-submenu">{portfolioLinks.map(renderDropdownLink)}</div>}

              <button
                className="pro-nav-button"
                type="button"
                aria-expanded={pricingOpen}
                onClick={() => {
                  setPricingOpen((open) => !open);
                  setPortfolioOpen(false);
                }}
              >
                Rates <span className="pro-nav-caret">{pricingOpen ? "^" : "v"}</span>
              </button>
              {pricingOpen && <div className="pro-mobile-submenu">{pricingLinks.map(renderDropdownLink)}</div>}

              <Link href="/contact" className="pro-nav-cta">
                Book a shoot
              </Link>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
