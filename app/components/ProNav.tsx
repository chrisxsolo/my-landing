"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const links = [
  { label: "Home",         href: "/" },
  { label: "Grads",        href: "/portfolio?category=grads" },
  { label: "Families",     href: "/portfolio?category=families" },
  { label: "About",        href: "/about" },
  { label: "Availability", href: "/availability" },
  { label: "Contact",      href: "/contact" },
  { label: "Blog",         href: "/blog" },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

export default function ProNav() {
  const pathname = usePathname();
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On hero pages (root "/"), nav is overlaid on image when at top
  const isHeroPage = pathname === "/";
  const overlaid = isHeroPage && atTop;

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
        transition: "background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease",
      }}>
        {links.map((link) => {
          const active = link.href.startsWith("http") ? false : isActive(pathname, link.href);
          const color = overlaid ? "rgba(255,255,255,0.85)" : (active ? "#111" : "#666");
          return link.href.startsWith("http") ? (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pro-nav-link"
              style={{ color }}
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className="pro-nav-link"
              style={{ color }}
            >
              {link.label}
            </Link>
          );
        })}
      </header>
    </>
  );
}
