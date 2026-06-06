// ─────────────────────────────────────────────────────────────────────────────
// PRONAV  →  floating fixed navigation bar on all professional pages
// ─────────────────────────────────────────────────────────────────────────────
// The nav contents (order, labels, links, dropdowns, visibility) are now edited
// from the admin dashboard → "Navigation" tab, persisted in site_settings, and
// passed in here as `config`. To change the structure, edit it there — not here.
// This file owns only the markup, styling, and open/close interaction.
//   → Nav pill color: change .pro-nav-shell background/border values below.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { DEFAULT_NAV_CONFIG, type NavConfig, type NavGroup } from "@/lib/navConfig";

// The client portal "active" state also covers the logged-in dashboard route,
// which isn't itself a nav link.
const CLIENT_DASHBOARD_HREF = "/dashboard";

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

function isGroupActive(pathname: string, group: NavGroup) {
  if (group.href && isActive(pathname, group.href)) return true;
  return group.children.some((link) => isActive(pathname, link.href));
}

export default function ProNav({ config = DEFAULT_NAV_CONFIG }: { config?: NavConfig }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const { clientLogin, cta } = config;
  const primary = config.primary.filter((item) => item.visible);
  const isPortalActive =
    isActive(pathname, clientLogin.href) || isActive(pathname, CLIENT_DASHBOARD_HREF);

  const closeMenus = () => {
    setMenuOpen(false);
    setOpenGroupId(null);
  };
  const toggleGroup = (id: string) => setOpenGroupId((cur) => (cur === id ? null : id));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setOpenGroupId(null);
      }
    }
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setOpenGroupId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  const renderDropdownLink = (link: { id: string; label: string; href: string }) => (
    <Link
      key={link.id}
      href={link.href}
      className="pro-nav-dropdown-link"
      aria-current={isActive(pathname, link.href) ? "page" : undefined}
      onClick={closeMenus}
    >
      {link.label}
    </Link>
  );

  const renderDesktopGroup = (group: NavGroup) => {
    const open = openGroupId === group.id;
    const active = isGroupActive(pathname, group);

    // href === null → a plain dropdown button (e.g. "Guides").
    if (group.href == null) {
      return (
        <div key={group.id} className="pro-dropdown-wrap">
          <button className="pro-nav-button" type="button"
            aria-expanded={open}
            aria-current={active ? "page" : undefined}
            onClick={() => toggleGroup(group.id)}>
            {group.label} <span className="pro-nav-caret">{open ? "▲" : "▼"}</span>
          </button>
          {open && <div className="pro-nav-dropdown">{group.children.map(renderDropdownLink)}</div>}
        </div>
      );
    }

    // href set → split button: a real link + a caret that opens the dropdown.
    return (
      <div key={group.id} className="pro-dropdown-wrap" style={{ display: "flex" }}>
        <Link href={group.href} className="pro-nav-link"
          style={{ borderRadius: "8px 0 0 8px", paddingRight: 8 }}
          aria-current={active ? "page" : undefined}
          onClick={closeMenus}>
          {group.label}
        </Link>
        <button className="pro-nav-button" type="button"
          style={{ borderRadius: "0 8px 8px 0", paddingLeft: 6, paddingRight: 8, minWidth: 0 }}
          aria-expanded={open}
          onClick={() => toggleGroup(group.id)}>
          <span className="pro-nav-caret">{open ? "▲" : "▼"}</span>
        </button>
        {open && <div className="pro-nav-dropdown">{group.children.map(renderDropdownLink)}</div>}
      </div>
    );
  };

  // Mobile groups use Fragments so the button / split stays a direct child of
  // .pro-mobile-panel (its full-width styling relies on the `>` child selector).
  const renderMobileGroup = (group: NavGroup) => {
    const open = openGroupId === group.id;
    const active = isGroupActive(pathname, group);
    return (
      <Fragment key={group.id}>
        {group.href == null ? (
          <button className="pro-nav-button" type="button"
            aria-expanded={open}
            aria-current={active ? "page" : undefined}
            onClick={() => toggleGroup(group.id)}>
            {group.label} <span className="pro-nav-caret">{open ? "▲" : "▼"}</span>
          </button>
        ) : (
          <div className="pro-mobile-split">
            <Link href={group.href} className="pro-nav-link"
              aria-current={active ? "page" : undefined}
              onClick={closeMenus}>
              {group.label}
            </Link>
            <button className="pro-nav-button" type="button"
              aria-expanded={open}
              onClick={() => toggleGroup(group.id)}>
              <span className="pro-nav-caret">{open ? "▲" : "▼"}</span>
            </button>
          </div>
        )}
        {open && <div className="pro-mobile-submenu">{group.children.map(renderDropdownLink)}</div>}
      </Fragment>
    );
  };

  return (
    <>
      <style>{`
        .pro-header {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 14px 24px;
          pointer-events: none;
        }

        /* ── NAV PILL ─────────────────────────────────────────────────────────
           White frosted glass — clean light appearance on all pages.
           To change color: adjust background rgba values.
           backdrop-filter adds the frosted blur effect. */
        .pro-nav-shell {
          width: min(1180px, 100%);
          min-height: 58px;
          margin: 0 auto;
          padding: 7px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
          border: 1px solid rgba(18, 24, 22, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 8px 28px rgba(16, 24, 22, 0.09), inset 0 1px 0 rgba(255,255,255,0.9);
          pointer-events: auto;
        }

        .pro-nav-brand, .pro-nav-link, .pro-nav-button, .pro-nav-cta, .pro-nav-dropdown-link {
          font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0;
          text-decoration: none;
        }

        /* ── BRAND ─────────────────────────────────────────────────────────── */
        .pro-nav-brand {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
          padding: 0 14px;
          color: #0e1412;
          font-size: 17px;
          font-weight: 860;
          line-height: 1;
        }

        /* ── INNER NAV GROUP ───────────────────────────────────────────────── */
        .pro-desktop-nav {
          justify-self: center;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 8px;
          background: rgba(245, 249, 247, 0.72);
        }

        /* ── LINKS & BUTTONS ───────────────────────────────────────────────── */
        .pro-nav-link, .pro-nav-button {
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
        .pro-nav-link:hover, .pro-nav-button:hover,
        .pro-nav-link[aria-current="page"], .pro-nav-button[aria-current="page"] {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(18, 24, 22, 0.1);
          color: #0e1412;
        }

        .pro-nav-caret { color: #687571; font-size: 10px; line-height: 1; }

        /* ── ACTIONS (right side) ──────────────────────────────────────────── */
        .pro-nav-actions { justify-self: end; display: flex; align-items: center; gap: 8px; }

        /* ── CTA BUTTON ────────────────────────────────────────────────────── */
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

        /* ── DROPDOWN ──────────────────────────────────────────────────────── */
        .pro-dropdown-wrap { position: relative; }
        .pro-nav-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          min-width: 194px;
          padding: 7px;
          display: grid;
          gap: 3px;
          border: 1px solid rgba(18, 24, 22, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 16px 34px rgba(16, 24, 22, 0.12);
          transform: translateX(-50%);
        }
        .pro-nav-dropdown-link {
          min-height: 40px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 7px;
          color: #2f3835;
          font-size: 13px;
          font-weight: 720;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .pro-nav-dropdown-link:hover, .pro-nav-dropdown-link[aria-current="page"] {
          background: rgba(112, 139, 133, 0.09);
          color: #0d1412;
        }

        /* ── MOBILE ────────────────────────────────────────────────────────── */
        .pro-mobile-button, .pro-mobile-panel { display: none; }

        @media (max-width: 880px) {
          .pro-header { padding: 10px 12px; }
          .pro-nav-shell { grid-template-columns: 1fr auto; min-height: 56px; }
          .pro-desktop-nav, .pro-nav-actions { display: none; }
          .pro-mobile-button { display: inline-flex; }
          .pro-mobile-panel {
            position: absolute;
            top: calc(100% + 10px);
            left: 0; right: 0;
            display: grid;
            gap: 8px;
            max-height: calc(100svh - 86px);
            overflow-y: auto;
            padding: 10px;
            border: 1px solid rgba(18, 24, 22, 0.1);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.97);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 16px 34px rgba(16, 24, 22, 0.12);
          }
          .pro-mobile-panel > .pro-nav-link,
          .pro-mobile-panel > .pro-nav-button,
          .pro-mobile-panel > .pro-nav-cta {
            width: 100%; min-height: 46px; justify-content: space-between; padding: 0 14px;
          }
          .pro-mobile-panel > .pro-nav-cta { justify-content: center; margin-top: 6px; }
          .pro-mobile-split {
            display: flex; width: 100%; min-height: 46px;
            border: 1px solid rgba(18,24,22,0.1); border-radius: 8px; overflow: hidden;
          }
          .pro-mobile-split .pro-nav-link {
            flex: 1; min-height: 46px; border-radius: 0; border: none;
            justify-content: flex-start; padding: 0 14px;
          }
          .pro-mobile-split .pro-nav-button {
            min-height: 46px; border-radius: 0; border: none;
            border-left: 1px solid rgba(18,24,22,0.1);
            padding: 0 14px; min-width: 0;
          }
          .pro-mobile-submenu { display: grid; gap: 4px; padding: 4px 0 8px 12px; }
          .pro-mobile-submenu .pro-nav-dropdown-link { min-height: 40px; background: rgba(245, 249, 247, 0.82); }
        }
      `}</style>

      <header ref={navRef} className="pro-header">
        <div className="pro-nav-shell">
          <Link href="/" className="pro-nav-brand" aria-label="soloxsnaps home" onClick={closeMenus}>soloxsnaps</Link>

          <nav className="pro-desktop-nav" aria-label="Primary navigation">
            {primary.map((item) =>
              item.type === "link" ? (
                <Link key={item.id} href={item.href} className="pro-nav-link"
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  onClick={closeMenus}>
                  {item.label}
                </Link>
              ) : (
                renderDesktopGroup(item)
              )
            )}
          </nav>

          <div className="pro-nav-actions">
            {clientLogin.visible && (
              <Link
                href={clientLogin.href}
                className="pro-nav-link"
                aria-current={isPortalActive ? "page" : undefined}
                onClick={closeMenus}
              >
                {clientLogin.label}
              </Link>
            )}
            {cta.visible && (
              <Link href={cta.href} className="pro-nav-cta" onClick={closeMenus}>{cta.label}</Link>
            )}
          </div>

          <button className="pro-nav-button pro-mobile-button" type="button"
            aria-expanded={menuOpen} aria-controls="pro-mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}>
            Menu <span className="pro-nav-caret">{menuOpen ? "✕" : "▼"}</span>
          </button>

          {menuOpen && (
            <nav id="pro-mobile-menu" className="pro-mobile-panel" aria-label="Mobile navigation">
              {primary.map((item) =>
                item.type === "link" ? (
                  <Link key={item.id} href={item.href} className="pro-nav-link"
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    onClick={closeMenus}>
                    {item.label}
                  </Link>
                ) : (
                  renderMobileGroup(item)
                )
              )}
              {clientLogin.visible && (
                <Link
                  href={clientLogin.href}
                  className="pro-nav-link"
                  aria-current={isPortalActive ? "page" : undefined}
                  onClick={closeMenus}
                >
                  {clientLogin.label}
                </Link>
              )}
              {cta.visible && (
                <Link href={cta.href} className="pro-nav-cta" onClick={closeMenus}>{cta.label}</Link>
              )}
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
