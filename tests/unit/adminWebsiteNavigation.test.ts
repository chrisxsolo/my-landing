import { describe, expect, it } from "vitest";
import {
  getWebsiteGroupId,
  WEBSITE_NAV_GROUPS,
} from "@/app/admin/AdminWebsiteNavigation";

const EXPECTED_TABS = [
  "poses",
  "couplesGuide",
  "couplesLocations",
  "locations",
  "bayGuide",
  "familyGuide",
  "portraitLocations",
  "portfolio",
  "caseStudies",
  "categories",
  "blog",
  "library",
  "navigation",
  "aboutPage",
];

describe("admin Website navigation", () => {
  it("orders links into the approved workflow groups", () => {
    expect(WEBSITE_NAV_GROUPS.map(({ label }) => label)).toEqual([
      "Guides",
      "Showcase",
      "Publishing",
      "Site Setup",
    ]);

    expect(WEBSITE_NAV_GROUPS.map(({ items }) => items.map(({ tab }) => tab))).toEqual([
      ["poses", "couplesGuide", "couplesLocations", "locations", "bayGuide", "familyGuide", "portraitLocations"],
      ["portfolio", "caseStudies", "categories"],
      ["blog", "library"],
      ["navigation", "aboutPage"],
    ]);
  });

  it("includes every Website tab exactly once", () => {
    const tabs = WEBSITE_NAV_GROUPS.flatMap(({ items }) => items.map(({ tab }) => tab));

    expect([...tabs].sort()).toEqual([...EXPECTED_TABS].sort());
    expect(new Set(tabs).size).toBe(tabs.length);
  });

  it("resolves active tabs to their parent group", () => {
    expect(getWebsiteGroupId("couplesLocations")).toBe("guides");
    expect(getWebsiteGroupId("caseStudies")).toBe("showcase");
    expect(getWebsiteGroupId("library")).toBe("publishing");
    expect(getWebsiteGroupId("aboutPage")).toBe("site-setup");
    expect(getWebsiteGroupId("clients")).toBeNull();
  });
});
