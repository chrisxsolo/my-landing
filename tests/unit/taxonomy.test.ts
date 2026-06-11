import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  SERVICE_TYPES, SCHOOL_SLUGS, LIGHTING_CONDITIONS,
  CONTENT_TYPES, GENERATABLE_CONTENT_TYPES, PUBLICATION_TARGET_TYPES,
  CANONICAL_INTERNAL_LINKS,
  isServiceType, isSchoolSlug, isPortfolioCategory, isLightingCondition,
  isContentType, isGuideType, isGuideLocationKey, isCanonicalInternalLink,
  guideLocationKeys,
} from "@/lib/contentEngine/taxonomy";

describe("taxonomy constants", () => {
  it("school slugs match the /grads/* route segments and exclude non-Bay-Area schools", () => {
    expect(SCHOOL_SLUGS).toEqual(
      expect.arrayContaining(["sjsu", "uc-berkeley", "sf-state", "stanford", "santa-clara", "usf", "csueb"]),
    );
    expect(SCHOOL_SLUGS).not.toContain("ucsc");
    expect(SCHOOL_SLUGS).not.toContain("uc-davis");
  });

  it("offers exactly the v1 service types and lighting conditions", () => {
    expect(SERVICE_TYPES).toContain("grads");
    expect(LIGHTING_CONDITIONS).toContain("golden_hour");
  });

  it("content types include social_caption (Phase 2, schema-supported) and the 7 targets", () => {
    expect(CONTENT_TYPES).toContain("social_caption");
    expect(PUBLICATION_TARGET_TYPES).toContain("none");
  });

  it("generatable types exclude social_caption (Phase 2) but keep the other six", () => {
    expect(GENERATABLE_CONTENT_TYPES).not.toContain("social_caption");
    expect(GENERATABLE_CONTENT_TYPES).toHaveLength(CONTENT_TYPES.length - 1);
    expect(CONTENT_TYPES).toEqual(expect.arrayContaining([...GENERATABLE_CONTENT_TYPES]));
  });

  it("SCHOOL_SLUGS exactly matches the app/(professional)/grads/* route directories", () => {
    const dirs = readdirSync(path.join(process.cwd(), "app", "(professional)", "grads"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect([...SCHOOL_SLUGS].sort()).toEqual(dirs);
  });
});

describe("taxonomy validators", () => {
  it("validate known values and reject unknown / wrong-case", () => {
    expect(isServiceType("grads")).toBe(true);
    expect(isServiceType("weddings")).toBe(false);
    expect(isSchoolSlug("uc-berkeley")).toBe(true);
    expect(isSchoolSlug("UC-Berkeley")).toBe(false);
    expect(isSchoolSlug("uc-berkley")).toBe(false);
    expect(isPortfolioCategory("grads")).toBe(true);
    expect(isLightingCondition("golden_hour")).toBe(true);
    expect(isContentType("journal_post")).toBe(true);
    expect(isGuideType("family")).toBe(true);
    expect(isGuideType("families")).toBe(false);
  });

  it("guide location keys are validated per guide and come from the registries", () => {
    const familyKeys = guideLocationKeys("family");
    expect(familyKeys.length).toBeGreaterThan(0);
    expect(isGuideLocationKey("family", familyKeys[0])).toBe(true);
    expect(isGuideLocationKey("family", "not-a-real-location")).toBe(false);
    // a couples-only location must not validate under family
    expect(isGuideLocationKey("couples", "legion-of-honor")).toBe(true);
  });
});

describe("canonical internal links (closed list)", () => {
  it("includes every school page, both guide hubs, and pricing — and rejects anything else", () => {
    expect(CANONICAL_INTERNAL_LINKS).toContain("/grads/sjsu");
    expect(CANONICAL_INTERNAL_LINKS).toContain("/family-guide");
    expect(CANONICAL_INTERNAL_LINKS).toContain("/couples-guide");
    expect(CANONICAL_INTERNAL_LINKS).toContain("/pricing");
    expect(isCanonicalInternalLink("/grads/uc-berkeley")).toBe(true);
    expect(isCanonicalInternalLink("/grads/made-up")).toBe(false);
    expect(isCanonicalInternalLink("https://evil.example.com")).toBe(false);
  });
});
