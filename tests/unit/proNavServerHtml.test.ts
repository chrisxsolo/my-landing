// The primary nav's dropdown and mobile-menu links must be in the server HTML
// (closed menus are hidden, not unmounted) so crawlers can reach the guide,
// pricing and portfolio pages from every page of the site.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ProNav from "@/app/components/ProNav";
import { DEFAULT_NAV_CONFIG } from "@/lib/navConfig";

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }));

const childHrefs = DEFAULT_NAV_CONFIG.primary
  .flatMap((item) => (item.type === "group" ? item.children.map((child) => child.href) : []));

describe("primary nav server HTML", () => {
  const html = renderToStaticMarkup(createElement(ProNav));

  it("contains every dropdown link while the menus are closed", () => {
    expect(childHrefs.length).toBeGreaterThan(5);
    for (const href of childHrefs) {
      expect(html).toContain(`href="${href.replace(/&/g, "&amp;")}"`);
    }
  });

  it("hides the closed menus instead of leaving them visible", () => {
    const hiddenMenus = html.match(/<(?:div|nav)\b[^>]*\bhidden=""/g) ?? [];
    // One dropdown per group on desktop, one submenu per group on mobile, plus the mobile panel.
    const groups = DEFAULT_NAV_CONFIG.primary.filter((item) => item.type === "group").length;
    expect(hiddenMenus).toHaveLength(groups * 2 + 1);
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).not.toMatch(/aria-expanded="true"/);
  });
});
