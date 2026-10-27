// Public pages only link to location guides that are indexable: an unpublished
// guide renders noindex, so pointing a campus guide at it leaks link equity
// into a page search engines are told to ignore.
import { describe, expect, it } from "vitest";
import { SF_OFF_CAMPUS_SPOTS } from "@/app/(professional)/grads/sfOffCampus";
import { getCouplesLocation, getPublishedCouplesLocations } from "@/lib/couplesGuide/locations";
import { getFamilyLocation } from "@/lib/familyGuide/locations";
import { getPortraitLocation } from "@/lib/portraitGuide/locations";
import { parseGuideLocationPath, type LocationGuideType } from "@/lib/locations/guideCoverage";

const STATIC_GUIDE = {
  couples: getCouplesLocation,
  family: getFamilyLocation,
  portrait: getPortraitLocation,
} satisfies Record<LocationGuideType, (slug: string) => { published: boolean } | null>;

describe("Palace of Fine Arts couples guide", () => {
  it("is published, so it is indexable and enters the sitemap", () => {
    expect(getCouplesLocation("palace-of-fine-arts")?.published).toBe(true);
    expect(getPublishedCouplesLocations().map((l) => l.slug)).toContain("palace-of-fine-arts");
  });
});

describe("San Francisco off-campus guide links", () => {
  const linked = SF_OFF_CAMPUS_SPOTS.filter((s) => s.guideLink);

  it("includes the Palace of Fine Arts guide link", () => {
    expect(linked.map((s) => s.key)).toContain("palace-of-fine-arts");
  });

  it.each(linked.map((s) => [s.key, s.guideLink!.href] as const))(
    "%s links to a published location guide (%s)",
    (_key, href) => {
      const target = parseGuideLocationPath(href);
      expect(target).not.toBeNull();
      expect(STATIC_GUIDE[target!.guide](target!.slug)?.published).toBe(true);
    },
  );
});
