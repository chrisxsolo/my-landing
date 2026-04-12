"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const orderedLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Availability", href: "/availability" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" },
];

const portfolioLinks = [
  { label: "Grads", href: "/portfolio?category=grads" },
  { label: "Families", href: "/portfolio?category=families" },
];

const pricingLinks = [
  { label: "Grad Pricing", href: "/pricing/grads" },
  { label: "Family Pricing", href: "/pricing/families" },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

export default function ProNav() {
  const pathname = usePathname();
  const [atTop, setAtTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setPortfolioOpen(false);
        setPricingOpen(false);
      }
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
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

  const isHeroPage = pathname === "/";
  const overlaid = isHeroPage && atTop;
  const isPortfolioActive = portfolioLinks.some((link) => isActive(pathname, link.href));
  const isPricingActive = pricingLinks.some((link) => isActive(pathname, link.href));
  const linkColor = (active: boolean) => overlaid ? "rgba(255,255,255,0.92)" : active ? "#111" : "#343434";
  const mutedLinkColor = overlaid ? "rgba(255,255,255,0.78)" : "#4a4a4a";

  const renderDropdownLink = (link: { label: string; href: string }) => (
    <Link key={link.href} href={link.href} style={{ color: isActive(pathname, link.href) ? "#111" : "#343434" }}>
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
          padding: 20px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          transition: background 0.4s ease, border-color 0.4s ease;
        }
        .pro-nav-link {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          transition: color 0.2s ease, opacity 0.2s ease;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 650;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .pro-nav-link:hover { opacity: 0.58; }
        .pro-desktop-nav {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: clamp(18px, 3vw, 42px);
        }
        .pro-dropdown-wrap { position: relative; }
        .pro-dropdown {
          position: absolute;
          top: calc(100% + 14px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(250,250,248,0.98);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(0,0,0,0.08);
          padding: 8px 0;
          min-width: 178px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          z-index: 200;
        }
        .pro-dropdown a {
          display: block;
          padding: 11px 20px;
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          transition: color 0.15s ease, background 0.15s ease;
          white-space: nowrap;
        }
        .pro-dropdown a:hover { color: #111 !important; background: rgba(0,0,0,0.035); }
        .pro-mobile-button {
          display: none;
          margin-left: auto;
        }
        .pro-mobile-panel { display: none; }
        .pro-mobile-section {
          border-top: 1px solid rgba(0,0,0,0.08);
          padding-top: 14px;
        }
        .pro-mobile-submenu {
          display: grid;
          gap: 12px;
          padding: 4px 0 0 18px;
        }
        .pro-mobile-submenu a {
          color: #343434;
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
        }
        @media (max-width: 760px) {
          .pro-header {
            padding: 16px 22px;
            gap: 16px;
          }
          .pro-desktop-nav { display: none; }
          .pro-mobile-button { display: inline-flex; }
          .pro-mobile-panel {
            display: grid;
            gap: 16px;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            padding: 18px 22px 24px;
            background: rgba(250,250,248,0.98);
            border-top: 1px solid rgba(0,0,0,0.06);
            border-bottom: 1px solid rgba(0,0,0,0.08);
            box-shadow: 0 18px 34px rgba(0,0,0,0.08);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
          }
          .pro-mobile-panel .pro-nav-link {
            color: #343434 !important;
            justify-content: space-between;
            width: 100%;
          }
        }
      `}</style>

      <header
        ref={navRef}
        className="pro-header"
        style={{
          background: overlaid ? "transparent" : "rgba(250,250,248,0.96)",
          backdropFilter: overlaid ? "none" : "blur(12px)",
          WebkitBackdropFilter: overlaid ? "none" : "blur(12px)",
          borderBottom: overlaid ? "none" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <Link href="/" className="pro-nav-link" style={{ color: linkColor(pathname === "/") }}>
          Home
        </Link>

        <nav className="pro-desktop-nav" aria-label="Primary navigation">
          <Link href="/about" className="pro-nav-link" style={{ color: linkColor(isActive(pathname, "/about")) }}>
            About
          </Link>

          <div className="pro-dropdown-wrap">
            <button
              className="pro-nav-link"
              type="button"
              aria-expanded={pricingOpen}
              onClick={() => {
                setPricingOpen((open) => !open);
                setPortfolioOpen(false);
              }}
              style={{ color: linkColor(isPricingActive) }}
            >
              Pricing
              <span aria-hidden="true" style={{ color: mutedLinkColor, fontSize: 8 }}>{pricingOpen ? "▲" : "▼"}</span>
            </button>
            {pricingOpen && <div className="pro-dropdown">{pricingLinks.map(renderDropdownLink)}</div>}
          </div>

          <div className="pro-dropdown-wrap">
            <button
              className="pro-nav-link"
              type="button"
              aria-expanded={portfolioOpen}
              onClick={() => {
                setPortfolioOpen((open) => !open);
                setPricingOpen(false);
              }}
              style={{ color: linkColor(isPortfolioActive) }}
            >
              Portfolio
              <span aria-hidden="true" style={{ color: mutedLinkColor, fontSize: 8 }}>{portfolioOpen ? "▲" : "▼"}</span>
            </button>
            {portfolioOpen && <div className="pro-dropdown">{portfolioLinks.map(renderDropdownLink)}</div>}
          </div>

          {orderedLinks.slice(2).map((link) => (
            <Link key={link.href} href={link.href} className="pro-nav-link" style={{ color: linkColor(isActive(pathname, link.href)) }}>
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className="pro-nav-link pro-mobile-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="pro-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          style={{ color: linkColor(false) }}
        >
          Menu
          <span aria-hidden="true" style={{ color: mutedLinkColor, fontSize: 8 }}>{menuOpen ? "▲" : "▼"}</span>
        </button>

        {menuOpen && (
          <nav id="pro-mobile-menu" className="pro-mobile-panel" aria-label="Mobile navigation">
            <Link href="/" className="pro-nav-link">Home</Link>
            <Link href="/about" className="pro-nav-link">About</Link>

            <div className="pro-mobile-section">
              <button
                className="pro-nav-link"
                type="button"
                aria-expanded={pricingOpen}
                onClick={() => {
                  setPricingOpen((open) => !open);
                  setPortfolioOpen(false);
                }}
              >
                Pricing
                <span aria-hidden="true">{pricingOpen ? "▲" : "▼"}</span>
              </button>
              {pricingOpen && <div className="pro-mobile-submenu">{pricingLinks.map(renderDropdownLink)}</div>}
            </div>

            <div className="pro-mobile-section">
              <button
                className="pro-nav-link"
                type="button"
                aria-expanded={portfolioOpen}
                onClick={() => {
                  setPortfolioOpen((open) => !open);
                  setPricingOpen(false);
                }}
              >
                Portfolio
                <span aria-hidden="true">{portfolioOpen ? "▲" : "▼"}</span>
              </button>
              {portfolioOpen && <div className="pro-mobile-submenu">{portfolioLinks.map(renderDropdownLink)}</div>}
            </div>

            {orderedLinks.slice(2).map((link) => (
              <Link key={link.href} href={link.href} className="pro-nav-link">
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
