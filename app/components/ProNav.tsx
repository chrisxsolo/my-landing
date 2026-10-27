"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { C } from "@/lib/colors";
import { DEFAULT_NAV_CONFIG, type NavConfig, type NavGroup } from "@/lib/navConfig";
import { useHomepageHeroNavState } from "@/app/components/useHomepageHeroNavState";
import heroStyles from "@/app/components/ProNavHero.module.css";
import styles from "@/app/components/ProNav.module.css";

const CLIENT_DASHBOARD_HREF = "/dashboard";
const MOBILE_MENU_ID = "pro-mobile-menu";

// Dropdown and mobile-menu links are always in the server HTML so crawlers can
// follow them; a closed menu is hidden with the `hidden` attribute (display:
// none), which also keeps its links out of the tab order.
const dropdownId = (groupId: string) => `pro-nav-dropdown-${groupId}`;

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
  const isHomepageHero = useHomepageHeroNavState(pathname) && !menuOpen;
  const heroVariables = { "--nav-hero-border": C.white_22, "--nav-hero-ink": C.ink, "--nav-hero-paper": C.white } as CSSProperties;

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
      className={styles.proNavDropdownLink}
      aria-current={isActive(pathname, link.href) ? "page" : undefined}
      onClick={closeMenus}
    >
      {link.label}
    </Link>
  );

  const renderDesktopGroup = (group: NavGroup) => {
    const open = openGroupId === group.id;
    const active = isGroupActive(pathname, group);
    if (group.href == null) {
      return (
        <div key={group.id} className={styles.proDropdownWrap}>
          <button className={styles.proNavButton} type="button"
            aria-expanded={open} aria-controls={dropdownId(group.id)}
            aria-current={active ? "page" : undefined}
            onClick={() => toggleGroup(group.id)}>
            {group.label} <span className={styles.proNavCaret}>{open ? "▲" : "▼"}</span>
          </button>
          <div id={dropdownId(group.id)} className={styles.proNavDropdown} hidden={!open}>
            {group.children.map(renderDropdownLink)}
          </div>
        </div>
      );
    }
    return (
      <div key={group.id} className={styles.proDropdownWrap} style={{ display: "flex" }}>
        <Link href={group.href} className={styles.proNavLink}
          style={{ borderRadius: "8px 0 0 8px", paddingRight: 8 }}
          aria-current={active ? "page" : undefined}
          onClick={closeMenus}>
          {group.label}
        </Link>
        <button className={styles.proNavButton} type="button"
          style={{ borderRadius: "0 8px 8px 0", paddingLeft: 6, paddingRight: 8, minWidth: 0 }}
          aria-expanded={open} aria-controls={dropdownId(group.id)}
          onClick={() => toggleGroup(group.id)}>
          <span className={styles.proNavCaret}>{open ? "▲" : "▼"}</span>
        </button>
        <div id={dropdownId(group.id)} className={styles.proNavDropdown} hidden={!open}>
          {group.children.map(renderDropdownLink)}
        </div>
      </div>
    );
  };

  const renderMobileGroup = (group: NavGroup) => {
    const open = openGroupId === group.id;
    const active = isGroupActive(pathname, group);
    return (
      <Fragment key={group.id}>
        {group.href == null ? (
          <button className={styles.proNavButton} type="button"
            aria-expanded={open}
            aria-current={active ? "page" : undefined}
            onClick={() => toggleGroup(group.id)}>
            {group.label} <span className={styles.proNavCaret}>{open ? "▲" : "▼"}</span>
          </button>
        ) : (
          <div className={styles.proMobileSplit}>
            <Link href={group.href} className={styles.proNavLink}
              aria-current={active ? "page" : undefined}
              onClick={closeMenus}>
              {group.label}
            </Link>
            <button className={styles.proNavButton} type="button"
              aria-expanded={open}
              onClick={() => toggleGroup(group.id)}>
              <span className={styles.proNavCaret}>{open ? "▲" : "▼"}</span>
            </button>
          </div>
        )}
        <div className={styles.proMobileSubmenu} hidden={!open}>{group.children.map(renderDropdownLink)}</div>
      </Fragment>
    );
  };

  return (
    <header ref={navRef} className={styles.proHeader}>
      <div
        className={`${styles.proNavShell}${isHomepageHero ? ` ${heroStyles.hero}` : ""}`}
        style={heroVariables}
      >
        <Link href="/" className={styles.proNavBrand} aria-label="soloxsnaps home" onClick={closeMenus}>soloxsnaps</Link>

        <nav className={styles.proDesktopNav} aria-label="Primary navigation">
          {primary.map((item) =>
            item.type === "link" ? (
              <Link key={item.id} href={item.href} className={styles.proNavLink}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                onClick={closeMenus}>
                {item.label}
              </Link>
            ) : (
              renderDesktopGroup(item)
            )
          )}
        </nav>

        <div className={styles.proNavActions}>
          {clientLogin.visible && (
            <Link
              href={clientLogin.href}
              className={styles.proNavLink}
              aria-current={isPortalActive ? "page" : undefined}
              onClick={closeMenus}
            >
              {clientLogin.label}
            </Link>
          )}
          {cta.visible && (
            <Link href={cta.href} className={styles.proNavCta} onClick={closeMenus}>{cta.label}</Link>
          )}
        </div>

        <button className={`${styles.proNavButton} ${styles.proMobileButton}`} type="button"
          aria-expanded={menuOpen} aria-controls={MOBILE_MENU_ID}
          onClick={() => setMenuOpen((o) => !o)}>
          Menu <span className={styles.proNavCaret}>{menuOpen ? "✕" : "▼"}</span>
        </button>

        <nav id={MOBILE_MENU_ID} className={styles.proMobilePanel} aria-label="Mobile navigation" hidden={!menuOpen}>
          {primary.map((item) =>
            item.type === "link" ? (
              <Link key={item.id} href={item.href} className={styles.proNavLink}
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
              className={styles.proNavLink}
              aria-current={isPortalActive ? "page" : undefined}
              onClick={closeMenus}
            >
              {clientLogin.label}
            </Link>
          )}
          {cta.visible && (
            <Link href={cta.href} className={styles.proNavCta} onClick={closeMenus}>{cta.label}</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
