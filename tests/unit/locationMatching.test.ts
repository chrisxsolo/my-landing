import { describe, it, expect } from "vitest";
import { KNOWN_PLACES, type KnownPlace } from "@/lib/locations/places";
import {
  matchPlacesByName, normalizePlaceName, resolveLocation, medianCoordinates, placeAtCoordinates,
} from "@/lib/locations/match";
import {
  findGuideForPlace, guideSlugForPlace, parseGuideLocationPath, staticGuideSlugs, LOCATION_GUIDE_TYPES,
} from "@/lib/locations/guideCoverage";
import { mergePlaces } from "@/lib/locations/registry";
import { normalizeServiceType } from "@/lib/contentEngine/taxonomy";

const place = (key: string) => KNOWN_PLACES.find((p) => p.key === key)!;
const resolve = (text: string | null, gps: { latitude: number; longitude: number } | null = null, hints: string[] = []) =>
  resolveLocation({ sessionLocation: text, gps, visualHints: hints }, KNOWN_PLACES);

describe("gazetteer invariants", () => {
  it("every hand-written guide page is a known place (slug == place key)", () => {
    for (const guide of LOCATION_GUIDE_TYPES) {
      for (const slug of staticGuideSlugs(guide)) expect(place(slug), `${guide}/${slug}`).toBeDefined();
    }
  });

  it("no two places share a name or alias — an alias names ONE physical place", () => {
    const owner = new Map<string, string>();
    for (const p of KNOWN_PLACES) {
      for (const n of [p.name, ...p.aliases].map(normalizePlaceName)) {
        expect(owner.get(n) ?? p.key, `"${n}"`).toBe(p.key);
        owner.set(n, p.key);
      }
    }
  });

  it("keys are unique kebab-case", () => {
    const keys = KNOWN_PLACES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("Test A (pure) — existing location", () => {
  it("Palace of Fine Arts resolves to its place and its existing couples guide", () => {
    const r = resolve("Palace of Fine Arts");
    expect(r.status).toBe("verified");
    if (r.status !== "verified") return;
    expect(findGuideForPlace("couples", r.place.key, [])).toMatchObject({
      slug: "palace-of-fine-arts", url: "/couples-guide/locations/palace-of-fine-arts", source: "static",
    });
  });
});

describe("Test B (pure) — new location", () => {
  it("Shark Fin Cove is a verified Santa Cruz County place with no couples guide", () => {
    const r = resolve("Shark Fin Cove");
    expect(r).toMatchObject({ status: "verified", place: { county: "Santa Cruz County", city: "Davenport" } });
    if (r.status !== "verified") return;
    expect(findGuideForPlace("couples", r.place.key, [])).toBeNull();
    expect(guideSlugForPlace(r.place)).toBe("shark-fin-cove-santa-cruz");
  });

  it("San Francisco places keep the bare key as their slug", () => {
    expect(guideSlugForPlace(place("baker-beach"))).toBe("baker-beach");
  });
});

describe("Test C (pure) — similar scenery, different geography", () => {
  it("Shark Fin Cove never resolves to, or is covered by, Ocean Beach", () => {
    const r = resolve("Shark Fin Cove", null, ["beach", "ocean", "cliffs"]);
    if (r.status !== "verified") throw new Error("expected verified");
    expect(r.place.key).not.toBe("ocean-beach");
    expect(findGuideForPlace("couples", r.place.key, [])?.slug).not.toBe("ocean-beach");
  });

  it("generic scenery words never match a place", () => {
    for (const text of ["beach", "the beach", "a beach with cliffs", "Ocean", "cove"]) {
      expect(matchPlacesByName(text, KNOWN_PLACES), text).toEqual([]);
    }
  });
});

describe("Test D (pure) — aliases", () => {
  it.each(["Shark Fin Cove", "Shark Fin Beach", "Shark Fin Cove Beach", "shark fin cove", "  SHARK-FIN COVE "])(
    "%s → shark-fin-cove", (text) => {
      const r = resolve(text);
      expect(r.status === "verified" && r.place.key).toBe("shark-fin-cove");
    },
  );

  it("alias sessions reuse a database guide by place key", () => {
    const db = [{ guide: "couples" as const, slug: "shark-fin-cove-santa-cruz", locationKey: "shark-fin-cove", name: "Shark Fin Cove" }];
    const r = resolve("Shark Fin Beach");
    if (r.status !== "verified") throw new Error("expected verified");
    expect(findGuideForPlace("couples", r.place.key, db)).toMatchObject({ slug: "shark-fin-cove-santa-cruz", source: "db" });
  });

  it("qualifiers must agree with the place's geography", () => {
    expect(resolve("Shark Fin Cove, Santa Cruz").status).toBe("verified");
    expect(resolve("Shark Fin Cove (Shark Fin Beach), Davenport, CA").status).toBe("verified");
    expect(resolve("Lovers Lane, Presidio").status).toBe("verified");
    expect(resolve("Lovers Lane, Los Gatos")).toMatchObject({ status: "needs_confirmation", reason: "unrecognized" });
  });
});

describe("Test E (pure) — uncertain location", () => {
  it("no location text and no GPS → confirmation, with visual hints carried as hints only", () => {
    expect(resolve(null, null, ["beach", "sea stack"])).toMatchObject({
      status: "needs_confirmation", reason: "missing", visualHints: ["beach", "sea stack"], candidates: [],
    });
  });

  it("an unknown name is never mapped to the nearest-sounding place", () => {
    expect(resolve("Pebble Beach Cove")).toMatchObject({ status: "needs_confirmation", reason: "unrecognized" });
  });

  it("two places sharing a typed name → ambiguous, both offered", () => {
    const twin: KnownPlace = { ...place("lovers-lane"), key: "lovers-lane-los-gatos", city: "Los Gatos", aliases: [] };
    const r = resolveLocation({ sessionLocation: "Lovers' Lane", gps: null, visualHints: [] }, [...KNOWN_PLACES, twin]);
    expect(r).toMatchObject({ status: "needs_confirmation", reason: "ambiguous" });
    if (r.status === "needs_confirmation") expect(r.candidates).toHaveLength(2);
  });
});

describe("GPS evidence (priority 3)", () => {
  const sharkFin = { latitude: 37.0036, longitude: -122.1856 };
  const oceanBeach = { latitude: 37.7594, longitude: -122.5108 };

  it("identifies a place only when no location was entered", () => {
    expect(resolve(null, sharkFin)).toMatchObject({ status: "verified", source: "gps", place: { key: "shark-fin-cove" } });
  });

  it("the entered location wins when GPS agrees", () => {
    expect(resolve("Shark Fin Beach", sharkFin)).toMatchObject({ status: "verified", source: "session_location" });
  });

  it("GPS far from the entered place is a conflict, not a silent override", () => {
    expect(resolve("Shark Fin Cove", oceanBeach)).toMatchObject({ status: "needs_confirmation", reason: "conflict" });
  });

  it("a point outside every radius identifies nothing", () => {
    expect(placeAtCoordinates({ latitude: 36.6, longitude: -121.9 }, KNOWN_PLACES)).toBeNull();
  });

  it("median ignores a stray photo", () => {
    const m = medianCoordinates([sharkFin, sharkFin, oceanBeach]);
    expect(m).toEqual(sharkFin);
  });
});

describe("registry merge + paths", () => {
  it("database rows add places and extend code places' aliases without changing geography", () => {
    const db: KnownPlace[] = [
      { ...place("shark-fin-cove"), city: "Nowhere", aliases: ["Sharkfin"], name: "Shark Fin Cove" },
      { ...place("baker-beach"), key: "new-place", name: "New Place", aliases: [] },
    ];
    const merged = mergePlaces(KNOWN_PLACES, db);
    const sfc = merged.find((p) => p.key === "shark-fin-cove")!;
    expect(sfc.city).toBe("Davenport");
    expect(sfc.aliases).toContain("Sharkfin");
    expect(merged.some((p) => p.key === "new-place")).toBe(true);
  });

  it("parses guide location paths", () => {
    expect(parseGuideLocationPath("/couples-guide/locations/shark-fin-cove-santa-cruz"))
      .toEqual({ guide: "couples", slug: "shark-fin-cove-santa-cruz" });
    expect(parseGuideLocationPath("/couples-guide")).toBeNull();
    expect(normalizeServiceType("couples")).toBe("couples");
  });
});
