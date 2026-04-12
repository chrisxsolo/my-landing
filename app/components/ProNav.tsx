"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const links = [
  { label: "Home",         href: "/" },
  { label: "Grads",        href: "/portfolio?category=grads" },
  { label: "Families",     href: "/portfolio?category=families" },
  { label: "About",        href: "/about" },
  { label: "Availability", href: "/availability" },
  { label: "Contact",      href: "/contact" },
  { label: "Blog",         href: "/blog" },
];

const pricingLinks = [
  { label: "Grad Pricing",   href: "/pricing/grads" },
  { label: "Family Pricing", href: "/pricing/families" },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

export default function ProNav() {
  const pathname = usePathname();
  const [atTop, setAtTop] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pricingRef.current && !pricingRef.current.contains(e.target as Node)) {
        setPricingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setPricingOpen(false); }, [pathname]);

  const isHeroPage = pathname === "/";
  const overlaid = isHeroPage && atTop;
  const linkColor = (active: boolean) => overlaid ? "rgba(255,255,255,0.85)" : (active ? "#111" : "#666");
  const isPricingActive = pricingLinks.some(l => isActive(pathname, l.href));

  return (
    <>
      <style>{`
        .pro-nav-link {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          transition: opacity 0.2s ease;
          font-family: var(--font-dm-sans), sans-serif;
          font-weight: 500;
        }
        .pro-nav-link:hover { opacity: 0.45; }
        .pro-pricing-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(250,250,248,0.98);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(0,0,0,0.08);
          padding: 8px 0;
          min-width: 160px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          z-index: 200;
        }
        .pro-pricing-dropdown a {
          display: block;
          padding: 10px 20px;
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          color: #666;
          transition: color 0.15s ease, background 0.15s ease;
          white-space: nowrap;
        }
        .pro-pricing-dropdown a:hover { color: #111; background: rgba(0,0,0,0.03); }
      `}</style>

      <header style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        padding: "20px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: overlaid ? "transparent" : "rgba(250,250,248,0.96)",
        backdropFilter: overlaid ? "none" : "blur(12px)",
        WebkitBackdropFilter: overlaid ? "none" : "blur(12px)",
        borderBottom: overlaid ? "none" : "1px solid rgba(0,0,0,0.06)",
        transition: "background 0.4s ease, border-color 0.4s ease",
      }}>
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link key={link.href} href={link.href} className="pro-nav-link" style={{ color: linkColor(active) }}>
              {link.label}
            </Link>
          );
        })}

        {/* Pricing dropdown */}
        <div ref={pricingRef} style={{ position: "relative" }}>
          <button
            className="pro-nav-link"
            onClick={() => setPricingOpen(o => !o)}
            style={{
              color: linkColor(isPricingActive),
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Pricing
            <span style={{ fontSize: 7, opacity: 0.6, marginTop: 1 }}>{pricingOpen ? "▲" : "▼"}</span>
          </button>
          {pricingOpen && (
            <div className="pro-pricing-dropdown">
              {pricingLinks.map(l => (
                <Link key={l.href} href={l.href} style={{ color: isActive(pathname, l.href) ? "#111" : "#666" }}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
