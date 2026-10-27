import { describe, expect, it } from "vitest";
import { WEBSITE_NAV_GROUPS } from "@/app/admin/AdminWebsiteNavigation";
import { BUSINESS_TABS, MOBILE_NAV_ITEMS, TAB_LABELS, TOOL_TABS, isTab, navItem } from "@/app/admin/adminTabs";

describe("admin tabs", () => {
  it("reaches every labelled tab from the mobile strip exactly once", () => {
    const shown = MOBILE_NAV_ITEMS.map((item) => item.t);
    expect([...shown].sort()).toEqual(Object.keys(TAB_LABELS).sort());
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("shows the Website tabs with the sidebar's own icons and labels", () => {
    for (const group of WEBSITE_NAV_GROUPS) {
      for (const { tab, icon, label } of group.items) {
        expect(MOBILE_NAV_ITEMS).toContainEqual({ t: tab, icon, label });
      }
    }
  });

  it("labels every business and tool tab", () => {
    for (const tab of [...BUSINESS_TABS, ...TOOL_TABS]) expect(TAB_LABELS[tab]).toMatch(/^\S+ \S/);
  });

  it("splits a label into its icon and words", () => {
    expect(navItem("poses")).toEqual({ t: "poses", icon: "📸", label: "Grad Poses" });
    expect(navItem("home")).toEqual({ t: "home", icon: "🏠", label: "Home" });
  });

  it("accepts only tabs it labels for ?tab=", () => {
    expect(isTab("inquiries")).toBe(true);
    expect(isTab("aboutPage")).toBe(true);
    expect(isTab("bogus")).toBe(false);
    expect(isTab("toString")).toBe(false);
    expect(isTab(null)).toBe(false);
  });
});
