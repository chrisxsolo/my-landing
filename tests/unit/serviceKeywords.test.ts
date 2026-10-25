import { describe, it, expect } from "vitest";
import { generateMetaKeywords } from "@/lib/contentEngine/serviceKeywords";
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";

const gradFacts: SessionFactsSnapshot = {
  public_display_name: "Mia", service_type: "grads", school_slug: "sjsu",
  primary_location: "Tower Lawn", secondary_locations: [], session_date: "2026-05-01",
  lighting_condition: "golden_hour", graduation_year: 2026, degree: "B.S. Biology",
  outfit_count: 2, group_size: 1, public_session_summary: "A sunset grad shoot.",
};

const couplesFacts: SessionFactsSnapshot = {
  public_display_name: "Ana & Leo", service_type: "couples", school_slug: null,
  primary_location: "Crissy Field", secondary_locations: [], session_date: "2026-06-20",
  lighting_condition: "golden_hour", graduation_year: null, degree: null,
  outfit_count: null, group_size: 2, public_session_summary: "Foggy golden hour walk.",
  vibe: "playful", relationship_type: "engagement",
};

describe("generateMetaKeywords — grads (regression: pre-service-aware format)", () => {
  it("keeps the exact school, location, service keyword, Bay Area format", () => {
    expect(generateMetaKeywords(gradFacts)).toBe(
      "sjsu, Tower Lawn, graduation photos, Bay Area",
    );
  });

  it("omits missing parts without extra separators", () => {
    expect(generateMetaKeywords({ ...gradFacts, school_slug: null, primary_location: null }))
      .toBe("graduation photos, Bay Area");
  });

  it("non-couples services fall through to the default generator", () => {
    expect(generateMetaKeywords({ ...gradFacts, service_type: "maternity", school_slug: null }))
      .toBe("Tower Lawn, maternity photography, Bay Area");
    expect(generateMetaKeywords({ ...gradFacts, service_type: "prom", school_slug: null }))
      .toContain("prom photography");
  });
});

describe("generateMetaKeywords — couples", () => {
  it("includes service, photographer, location-bank, lighting, vibe, and relationship keywords", () => {
    const kw = generateMetaKeywords(couplesFacts);
    expect(kw).toContain("couple photoshoot in San Francisco");
    expect(kw).toContain("Bay Area couples photographer");
    expect(kw).toContain("Crissy Field couples photoshoot");
    expect(kw).toContain("Golden Gate Bridge couple photos");
    expect(kw).toContain("golden hour couple photos");
    expect(kw).toContain("playful couple photoshoot");
    expect(kw).toContain("San Francisco engagement photos");
    expect(kw).toContain("candid couples photography");
  });

  it("never emits graduation terms", () => {
    expect(generateMetaKeywords(couplesFacts)).not.toMatch(/grad|school|campus|senior/i);
  });

  it("maps known locations to their keyword bank and falls back for unknown ones", () => {
    expect(generateMetaKeywords({ ...couplesFacts, primary_location: "Lovers Lane" }))
      .toContain("Lovers Lane San Francisco couple photos");
    expect(generateMetaKeywords({ ...couplesFacts, primary_location: "Baker Beach" }))
      .toContain("Baker Beach couple photos");
    expect(generateMetaKeywords({ ...couplesFacts, primary_location: "Golden Gate Park" }))
      .toContain("Golden Gate Park couple photos");
    expect(generateMetaKeywords({ ...couplesFacts, primary_location: "Sutro Baths" }))
      .toContain("Sutro Baths couples photos");
  });

  it("uses couples-session phrasing when the relationship is not engagement/proposal", () => {
    const kw = generateMetaKeywords({ ...couplesFacts, relationship_type: "anniversary" });
    expect(kw).toContain("San Francisco couples session");
    expect(kw).not.toContain("engagement photographer");
  });

  it("handles missing optional facets without crashing or leaving gaps", () => {
    const kw = generateMetaKeywords({
      ...couplesFacts, primary_location: null, lighting_condition: null,
      vibe: null, relationship_type: null,
    });
    // no verified place → no city claim at all (never a San Francisco default)
    expect(kw).toContain("couple photoshoot");
    expect(kw).not.toContain("San Francisco");
    expect(kw).not.toMatch(/, ,|^,|,$/);
  });
});

describe("generateMetaKeywords — geography comes from the verified place", () => {
  it("a Shark Fin Cove session gets Santa Cruz keywords and no San Francisco keywords", () => {
    const kw = generateMetaKeywords({ ...couplesFacts, primary_location: "Shark Fin Cove" });
    expect(kw).toContain("couple photoshoot in Santa Cruz");
    expect(kw).toContain("Shark Fin Cove couples photos");
    expect(kw).toContain("Santa Cruz engagement photos");
    expect(kw).not.toMatch(/San Francisco|Ocean Beach/);
  });

  it("aliases resolve to the canonical place name", () => {
    const kw = generateMetaKeywords({ ...couplesFacts, primary_location: "Shark Fin Beach" });
    expect(kw).toContain("Shark Fin Cove couples photos");
  });

  it("an unverified place keeps its name but claims no city", () => {
    const kw = generateMetaKeywords({ ...couplesFacts, primary_location: "Pebble Cove" });
    expect(kw).toContain("Pebble Cove couples photos");
    expect(kw).not.toContain("San Francisco");
  });
});
