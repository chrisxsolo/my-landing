import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  SERVICE_TYPES, SCHOOL_SLUGS, LIGHTING_CONDITIONS, VIBES, RELATIONSHIP_TYPES,
  CONTENT_TYPES, GENERATABLE_CONTENT_TYPES, PUBLICATION_TARGET_TYPES,
  CANONICAL_INTERNAL_LINKS, internalLinksForService,
  isServiceType, isSchoolSlug, isPortfolioCategory, isLightingCondition,
  isVibe, isRelationshipType,
  isContentType, isGuideType, isGuideLocationKey, isCanonicalInternalLink,
  guideLocationKeys, normalizeServiceType, guideTypeForService,
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

describe("normalizeServiceType (tolerant singular/plural/case, 2026-07-07)", () => {
  it("passes canonical values through and fixes case", () => {
    for (const s of SERVICE_TYPES) expect(normalizeServiceType(s)).toBe(s);
    expect(normalizeServiceType("Couples")).toBe("couples");
    expect(normalizeServiceType(" GRADS ")).toBe("grads");
  });

  it("maps singular/plural and embedded variants onto the canonical value", () => {
    expect(normalizeServiceType("couple")).toBe("couples");
    expect(normalizeServiceType("couples session")).toBe("couples");
    expect(normalizeServiceType("engagement")).toBe("couples");
    expect(normalizeServiceType("family")).toBe("families");
    expect(normalizeServiceType("Family mini")).toBe("families");
    expect(normalizeServiceType("Graduation Session")).toBe("grads");
    expect(normalizeServiceType("Senior portraits")).toBe("portraits");
  });

  it("returns null for unknown values, blanks, and non-strings", () => {
    expect(normalizeServiceType("weddings")).toBeNull();
    expect(normalizeServiceType("")).toBeNull();
    expect(normalizeServiceType(null)).toBeNull();
    expect(normalizeServiceType(42)).toBeNull();
  });
});

describe("guideTypeForService (single source of guide-destination truth)", () => {
  it("couples/families/portraits/grads each resolve to their guide", () => {
    for (const v of ["couples", "couple", "Couples", "couples session", "engagement"]) {
      expect(guideTypeForService(v)).toBe("couples");
    }
    for (const v of ["families", "family", "Family mini"]) {
      expect(guideTypeForService(v)).toBe("family");
    }
    for (const v of ["portraits", "portrait", "Senior portraits"]) {
      expect(guideTypeForService(v)).toBe("portrait");
    }
    for (const v of ["grads", "grad", "Graduation Session"]) {
      expect(guideTypeForService(v)).toBe("grad");
    }
  });

  it("every other service type has no guide destination", () => {
    for (const v of ["maternity", "prom", "events", "other", "weddings", null]) {
      expect(guideTypeForService(v)).toBeNull();
    }
  });

  it("grad location keys are numeric location_spots ids, not a static registry", () => {
    expect(guideLocationKeys("grad")).toEqual([]);
    expect(isGuideLocationKey("grad", "12")).toBe(true);
    expect(isGuideLocationKey("grad", "tower-hall")).toBe(false);
    expect(isGuideLocationKey("grad", "")).toBe(false);
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

describe("service-aware additions (2026-07-02)", () => {
  it("service types include prom; couples facets validate against their closed lists", () => {
    expect(SERVICE_TYPES).toContain("prom");
    expect(isServiceType("prom")).toBe(true);
    expect(VIBES).toContain("romantic");
    expect(RELATIONSHIP_TYPES).toContain("date_night");
    expect(isVibe("candid")).toBe(true);
    expect(isVibe("sparkly")).toBe(false);
    expect(isRelationshipType("engagement")).toBe(true);
    expect(isRelationshipType("situationship")).toBe(false);
  });

  it("lighting keeps the original values and adds the couples-facing ones", () => {
    for (const v of ["morning", "midday", "afternoon", "golden_hour", "blue_hour", "night", "mixed"]) {
      expect(isLightingCondition(v)).toBe(true);
    }
    for (const v of ["sunset", "soft_shade", "overcast", "harsh_light", "flash"]) {
      expect(isLightingCondition(v)).toBe(true);
    }
  });

  it("internalLinksForService: grads keeps the pre-service-aware list + grad pricing, never other services' pricing", () => {
    const links = internalLinksForService("grads");
    // everything except per-service pricing pages is the full canonical list
    expect(links.filter((l) => !l.startsWith("/pricing/")))
      .toEqual(CANONICAL_INTERNAL_LINKS.filter((l) => !l.startsWith("/pricing/")));
    expect(links).toContain("/pricing/grads");
    expect(links).not.toContain("/pricing/couples");
    expect(links).not.toContain("/pricing/families");
  });

  it("internalLinksForService: couples gets only couples pages + couples/hub pricing, all canonical", () => {
    const links = internalLinksForService("couples");
    expect(links).toContain("/couples-guide");
    expect(links).toContain("/couples-guide/locations/crissy-field");
    expect(links).toContain("/pricing/couples");
    expect(links).toContain("/pricing");
    expect(links).not.toContain("/pricing/grads");
    expect(links.some((l) => l.startsWith("/grads/"))).toBe(false);
    expect(links.some((l) => l.startsWith("/family-guide"))).toBe(false);
    for (const l of links) expect(isCanonicalInternalLink(l)).toBe(true);
  });

  it("internalLinksForService: families and other services never see grad pages", () => {
    const familyLinks = internalLinksForService("families");
    expect(familyLinks.some((l) => l.startsWith("/grads/"))).toBe(false);
    expect(familyLinks).toContain("/pricing/families");
    expect(internalLinksForService("events")).toContain("/pricing/events");
    for (const svc of ["portraits", "maternity", "prom", "events", "other"] as const) {
      const links = internalLinksForService(svc);
      expect(links.some((l) => l.startsWith("/grads/"))).toBe(false);
      expect(links).toContain("/pricing");
      expect(links).not.toContain("/pricing/grads");
      for (const l of links) expect(isCanonicalInternalLink(l)).toBe(true);
    }
  });

  it("per-service pricing links match the app/(professional)/pricing/* route directories", () => {
    const dirs = readdirSync(path.join(process.cwd(), "app", "(professional)", "pricing"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `/pricing/${e.name}`)
      .sort();
    const canonicalPricing = CANONICAL_INTERNAL_LINKS.filter((l) => l.startsWith("/pricing/")).sort();
    expect(canonicalPricing).toEqual(dirs);
  });
});
