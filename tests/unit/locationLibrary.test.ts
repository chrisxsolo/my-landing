import { describe, it, expect } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { planSessionSync, resolveSessionPlaces, type SyncSession } from "@/lib/locationLibrary/syncPlan";
import { chooseHero, classifyPhoto, rankPublicPhotos, type MemberPhoto, type MemberSession } from "@/lib/locationLibrary/membership";
import { applyFilters, facetOptions, EMPTY_FILTERS, type FilterableLocation } from "@/lib/locationLibrary/publicFilters";
import { regionForPlace, sessionKindsFor } from "@/lib/locationLibrary/taxonomy";
import { nextLockedFields, parseLocationPatch, publishProblems } from "@/lib/locationLibrary/editRules";
import { parseLocationProfile } from "@/lib/locationLibrary/profilePrompt";

const place = (key: string) => KNOWN_PLACES.find((p) => p.key === key)!;
const session = (primary: string | null, extra: Partial<SyncSession> = {}): SyncSession => ({
  id: "s1", primaryLocation: primary, secondaryLocations: [], gps: null, approved: true, ...extra,
});

describe("resolveSessionPlaces", () => {
  it("matches by name/alias with a fitting qualifier and never by scenery", () => {
    expect(resolveSessionPlaces(session("Shark Fin Cove, Santa Cruz"), KNOWN_PLACES).places.map((p) => p.key)).toEqual(["shark-fin-cove"]);
    expect(resolveSessionPlaces(session("a beach with cliffs"), KNOWN_PLACES).places).toEqual([]);
    expect(resolveSessionPlaces(session("Lovers Lane, Los Gatos"), KNOWN_PLACES).places).toEqual([]);
  });

  it("splits a multi-place text only when every part is a known place", () => {
    expect(resolveSessionPlaces(session("Baker Beach & Lands End"), KNOWN_PLACES).places.map((p) => p.key))
      .toEqual(["baker-beach", "lands-end"]);
    const partial = resolveSessionPlaces(session("Baker Beach, Some Cafe"), KNOWN_PLACES);
    expect(partial.places).toEqual([]);
    expect(partial.unresolved).toHaveLength(1);
  });

  it("uses GPS only when no location was entered", () => {
    const gps = { latitude: 37.0036, longitude: -122.1856 };
    expect(resolveSessionPlaces(session(null, { gps }), KNOWN_PLACES).places.map((p) => p.key)).toEqual(["shark-fin-cove"]);
  });
});

describe("planSessionSync", () => {
  const rows = [{ id: 1, locationKey: "palace-of-fine-arts", aliasKeys: [] }, { id: 2, locationKey: "mission-murals", aliasKeys: ["lovers-lane"] }];

  it("reuses existing rows (including merged alias keys) and creates only missing ones", () => {
    const plan = planSessionSync(session("Palace of Fine Arts", { secondaryLocations: ["Lover's Lane", "Baker Beach"] }), KNOWN_PLACES, rows, []);
    expect(plan.createFor.map((p) => p.key)).toEqual(["baker-beach"]);
    expect(plan.status).toBe("synced");
  });

  it("removes stale auto links but never manual or excluded ones", () => {
    const links = [
      { id: "a", locationId: 2, source: "auto" as const, excluded: false },
      { id: "b", locationId: 2, source: "manual" as const, excluded: false },
      { id: "c", locationId: 9, source: "auto" as const, excluded: true },
    ];
    expect(planSessionSync(session("Palace of Fine Arts"), KNOWN_PLACES, rows, links).removeLinkIds).toEqual(["a"]);
  });

  it("changes nothing while the session has no approved photo", () => {
    const plan = planSessionSync(session("Baker Beach", { approved: false }), KNOWN_PLACES, rows, []);
    expect(plan).toMatchObject({ status: "waiting", createFor: [], linkKeys: [], removeLinkIds: [] });
  });
});

describe("membership", () => {
  const s: MemberSession = { id: "s1", permissionOk: true, multiLocation: false, sessionDate: "2026-05-01" };
  const photo = (over: Partial<MemberPhoto> = {}): MemberPhoto => ({
    id: "p1", sessionId: "s1", publicUrl: "https://x/p1.jpg", excluded: false, qualityScore: 7, sortOrder: 0,
    gpsLatitude: null, gpsLongitude: null, altText: null, ...over,
  });

  it("classifies by permission, web copy, engine exclusion, GPS and overrides", () => {
    expect(classifyPhoto(photo(), s, null, undefined)).toBe("public");
    expect(classifyPhoto(photo({ publicUrl: null }), s, null, undefined)).toBe("not_public");
    expect(classifyPhoto(photo(), { ...s, permissionOk: false }, null, undefined)).toBe("not_public");
    expect(classifyPhoto(photo({ excluded: true }), s, null, undefined)).toBe("excluded");
    expect(classifyPhoto(photo(), s, null, "hide")).toBe("hidden");
    const multi = { ...s, multiLocation: true };
    expect(classifyPhoto(photo(), multi, place("baker-beach"), undefined)).toBe("unassigned");
    expect(classifyPhoto(photo({ gpsLatitude: 37.7936, gpsLongitude: -122.4836 }), multi, place("baker-beach"), undefined)).toBe("public");
    expect(classifyPhoto(photo(), multi, place("baker-beach"), "include")).toBe("public");
  });

  it("prefers the featured photo, then a manual image, then the best of the featured session", () => {
    const sessions = new Map([["s1", s], ["s2", { ...s, id: "s2" }]]);
    const ranked = rankPublicPhotos([
      { ...photo({ id: "a", qualityScore: 9, sessionId: "s2" }), state: "public" },
      { ...photo({ id: "b", qualityScore: 6 }), state: "public" },
    ], sessions);
    expect(chooseHero({ featuredPhotoId: "b", featuredSessionId: null, manualImageUrl: "https://m" }, ranked)?.source).toBe("featured_photo");
    expect(chooseHero({ featuredPhotoId: null, featuredSessionId: null, manualImageUrl: "https://m" }, ranked)?.source).toBe("manual_image");
    expect(chooseHero({ featuredPhotoId: null, featuredSessionId: "s1", manualImageUrl: null }, ranked)?.photoId).toBe("b");
    expect(chooseHero({ featuredPhotoId: null, featuredSessionId: null, manualImageUrl: null }, ranked)?.photoId).toBe("a");
  });
});

describe("taxonomy", () => {
  it("derives the region from verified geography", () => {
    expect(regionForPlace(place("gamble-garden"))).toBe("peninsula");
    expect(regionForPlace(place("shark-fin-cove"))).toBe("coast");
    expect(regionForPlace(place("palace-of-fine-arts"))).toBe("san-francisco");
    expect(regionForPlace({ region: "Alameda County", county: "Alameda County" })).toBe("east-bay");
    expect(regionForPlace({ region: "Elsewhere", county: "Fresno County" })).toBe("other");
  });

  it("only claims session kinds the session data proves", () => {
    expect(sessionKindsFor("grads", null)).toEqual(["graduation"]);
    expect(sessionKindsFor("couples", "proposal")).toEqual(["couples", "proposal"]);
    expect(sessionKindsFor("events", null)).toEqual([]);
  });
});

describe("public filters", () => {
  const loc = (over: Partial<FilterableLocation>): FilterableLocation => ({
    title: "X", city: "San Francisco", neighborhood: null, description: "", best_for: "", best_time: "", tip: "",
    region: "san-francisco", tags: [], environments: [], kinds: [], order: 1, photoCount: 0, sessionCount: 0,
    createdAt: "2026-01-01", ...over,
  });
  const items = [
    loc({ title: "Palace", environments: ["architecture"], kinds: ["couples"], sessionCount: 5, order: 2 }),
    loc({ title: "Baker", environments: ["beach"], kinds: ["couples"], sessionCount: 1, order: 1, createdAt: "2026-09-01" }),
    loc({ title: "Gamble", region: "peninsula", environments: ["garden"], kinds: ["family"], order: 3 }),
  ];

  it("combines region, environment and session type", () => {
    const f = { ...EMPTY_FILTERS, region: "san-francisco", environment: "architecture", kind: "couples" };
    expect(applyFilters(items, f, "featured").map((l) => l.title)).toEqual(["Palace"]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, query: "garden" }, "featured").map((l) => l.title)).toEqual(["Gamble"]);
  });

  it("sorts and only offers facets that exist", () => {
    expect(applyFilters(items, EMPTY_FILTERS, "featured").map((l) => l.title)).toEqual(["Baker", "Palace", "Gamble"]);
    expect(applyFilters(items, EMPTY_FILTERS, "most")[0].title).toBe("Palace");
    expect(applyFilters(items, EMPTY_FILTERS, "recent")[0].title).toBe("Baker");
    const facets = facetOptions(items);
    expect(facets.kinds.map((k) => k.value)).toEqual(["couples", "family"]);
    expect(facets.regions.find((r) => r.value === "san-francisco")?.count).toBe(2);
  });
});

describe("edit rules", () => {
  it("locks edited fields and unlocks on request", () => {
    const patch = parseLocationPatch({ description: " New ", unlock: ["tip"] });
    expect(patch).toMatchObject({ fields: { description: "New" }, lock: ["description"], unlock: ["tip"] });
    expect(nextLockedFields(["tip", "region"], patch.lock, patch.unlock)).toEqual(["region", "description"]);
    expect(() => parseLocationPatch({ region: "atlantis" })).toThrow();
    expect(() => parseLocationPatch({ environments: ["moon"] })).toThrow();
    expect(publishProblems({ title: "X", description: " " })).toEqual(["a description"]);
  });
});

describe("profile parsing", () => {
  it("drops unknown environments and keeps empty answers empty", () => {
    const p = parseLocationProfile('Here: {"description":"D","best_time":"","environments":["beach","moon","nature"]}');
    expect(p).toEqual({ description: "D", best_for: "", best_time: "", tip: "", environments: ["nature", "beach"] });
    expect(() => parseLocationProfile("no json")).toThrow();
  });
});
