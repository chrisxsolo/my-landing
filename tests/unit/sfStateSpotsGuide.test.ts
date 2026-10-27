import { describe, expect, it } from "vitest";
import { data as sfState } from "@/app/(professional)/grads/sf-state/data";
import { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";
import { builtInSchool, schoolMatchesText } from "@/lib/contentEngine/schools";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { matchPlacesByName } from "@/lib/locations/match";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { candidatesForPage } from "@/lib/pagePhotos/candidates";
import type { PageCandidate } from "@/lib/pagePhotos/curate";
import type { PhotoPool, SpotTag } from "@/lib/pagePhotos/pool";
import {
  enginePhotoPlace, inferSchoolFromText, resolvePhoto,
  type EngineSource, type PortfolioSource, type ResolveContext,
} from "@/lib/pagePhotos/resolve";
import { buildSpotPhotoLayout, type SpotPhotoInput } from "@/lib/pagePhotos/spotPhotos";
import { isSchoolSpotKey, spotKeysByPlace, spotsForSchool, suggestSpotFromText } from "@/lib/schoolSpots";

const guide = sfState.spotsGuide!;
const offCampus = guide.offCampus!;
const allGuideText = JSON.stringify(sfState);
const CAMPUS_KEYS = [
  "sfsu-entrance-sign", "sfsu-main-quad", "j-paul-leonard-library", "sfsu-gator-statue", "garden-of-remembrance",
];
const OFF_CAMPUS_KEYS = ["palace-of-fine-arts", "legion-of-honor", "crissy-field", "golden-gate-bridge-welcome-center"];

describe("SF State location guide content", () => {
  it("covers Chris's five campus spots and four off-campus places, all registered photo keys", () => {
    expect(sfState.spots.map((s) => s.key)).toEqual(CAMPUS_KEYS);
    expect(offCampus.spots.map((s) => s.key)).toEqual(OFF_CAMPUS_KEYS);
    expect(spotsForSchool("sf-state").map((s) => s.key)).toEqual([...CAMPUS_KEYS, ...OFF_CAMPUS_KEYS]);
  });

  it("makes the 19th & Holloway sign the one must-have", () => {
    const musts = sfState.spots.filter((s) => s.priority === "must-have");
    expect(musts.map((s) => s.key)).toEqual(["sfsu-entrance-sign"]);
    expect(musts[0].role).toMatch(/19th Ave & Holloway Ave/);
  });

  it("names the Gator's plaza and the garden as a memorial, respectfully", () => {
    expect(sfState.spots.find((s) => s.key === "sfsu-gator-statue")!.role).toBe("Don Nasser Family Plaza");
    const garden = sfState.spots.find((s) => s.key === "garden-of-remembrance")!;
    expect(garden.name).toBe("Ruth Asawa Garden of Remembrance");
    expect(garden.details!.join(" ")).toMatch(/memorial/);
    expect(garden.details!.join(" ")).toMatch(/never climb the rocks/);
  });

  it("presents cloudy days as a benefit without promising perfect light", () => {
    const timing = [...guide.bestTime.paragraphs, guide.bestTime.weather].join(" ");
    expect(timing).toMatch(/sunrise/i);
    expect(timing).toMatch(/golden hour/i);
    expect(timing).toMatch(/diffuse/);
    expect(timing).toMatch(/heavy cloud/);
    expect(guide.bestTime.lists!.map((l) => l.label)).toEqual(["Sunny days", "Cloudy days"]);
    expect(allGuideText).not.toMatch(/sunset is the only|guarantee(?:d)? (?:sun|clear|perfect)/i);
  });

  it("frames the sign wait as Chris's own experience, never a promise", () => {
    const crowds = guide.sections!.find((s) => s.id === "crowds")!.paragraphs.join(" ");
    expect(crowds).toMatch(/In my experience[^.]*around 15 minutes/);
    expect(allGuideText).not.toMatch(/never (?:gets )?busy|no crowds|guaranteed? (?:empty|quiet)/i);
  });

  it("keeps Berkeley's and SJSU's advice out", () => {
    expect(allGuideText).not.toMatch(/Doe Library|Sather Gate|Tower Hall|Malcolm X|Lake Merced|Administration Building/);
  });

  it("uses official place names and never promises empty backgrounds or a visible bridge", () => {
    expect(allGuideText).not.toMatch(/Crissy Fields/);
    expect(allGuideText).toMatch(/Golden Gate Bridge Welcome Center/);
    const palaceTip = offCampus.spots[0].tip!;
    expect(palaceTip).toMatch(/weekdays/);
    expect(palaceTip).toMatch(/expect some people in the background/);
    expect(offCampus.spots[2].tip).toMatch(/isn't always clearly visible/);
  });

  it("routes through each campus spot once, as a checklist rather than a measured walk", () => {
    const keys = guide.route.steps.map((s) => s.spotKey);
    expect(keys).toEqual(CAMPUS_KEYS);
    expect(keys.every((k) => isSchoolSpotKey("sf-state", k))).toBe(true);
    expect(guide.route.notes.join(" ")).toMatch(/not a fixed walking order/);
  });

  it("takes add-on prices from the pricing catalog and makes no duration promise", () => {
    const notes = guide.plans!.notes.join(" ");
    const { secondLocation, extra30Minutes } = PRICING_CATALOG.graduation.addOns;
    expect(notes).toContain(`$${secondLocation.price}`);
    expect(notes).toContain(`$${extra30Minutes.price}`);
    expect(guide.plans!.options.map((o) => o.label)).toEqual(["Option A", "Option B", "Option C", "Option D", "Option E"]);
    expect(allGuideText).not.toMatch(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i);
    expect(allGuideText).not.toMatch(/parking|minutes? walk|walking time|four locations? (?:in|within) (?:an|one)/i);
  });

  it("has ten guide FAQs, distinct from the landing page's", () => {
    const landing = new Set((sfState.faqs ?? []).map((f) => f.q));
    expect(guide.faqs).toHaveLength(10);
    expect(guide.faqs.filter((f) => landing.has(f.q))).toEqual([]);
  });

  it("uses the requested title and description on the existing /spots URL", () => {
    const meta = buildSpotsMetadata(sfState);
    expect(meta.title).toBe("Best SFSU Graduation Photo Locations");
    expect(meta.alternates?.canonical).toBe("/grads/sf-state/spots");
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.description).toMatch(/Palace of Fine Arts/);
  });
});

describe("SF State school-name normalization", () => {
  it.each(["SFSU", "SF State", "San Francisco State", "San Francisco State University"])("%s → sf-state", (name) => {
    expect(schoolMatchesText(builtInSchool("sf-state")!, name)).toBe(true);
    expect(inferSchoolFromText(`${name} graduation portrait`).school).toBe("sf-state");
  });

  it.each(["USF", "University of San Francisco", "City College of San Francisco", "UC Law San Francisco"])(
    "%s is never SF State", (name) => {
      expect(schoolMatchesText(builtInSchool("sf-state")!, name)).toBe(false);
      expect(inferSchoolFromText(`${name} graduation portrait`).school).not.toBe("sf-state");
    },
  );
});

describe("off-campus places", () => {
  it("each off-campus spot is a distinct known place", () => {
    const places = new Set(KNOWN_PLACES.map((p) => p.key));
    expect(OFF_CAMPUS_KEYS.every((k) => places.has(k))).toBe(true);
    expect(spotKeysByPlace("sf-state")).toEqual(Object.fromEntries(OFF_CAMPUS_KEYS.map((k) => [k, k])));
  });

  it("keeps the Welcome Center and Crissy Field apart, and bare 'Golden Gate Bridge' names neither", () => {
    expect(matchPlacesByName("Golden Gate Bridge Welcome Center", KNOWN_PLACES).map((p) => p.key))
      .toEqual(["golden-gate-bridge-welcome-center"]);
    expect(matchPlacesByName("Crissy Field", KNOWN_PLACES).map((p) => p.key)).toEqual(["crissy-field"]);
    expect(matchPlacesByName("Golden Gate Bridge", KNOWN_PLACES)).toEqual([]);
  });

  it("suggests spots from a photo's own text as admin hints", () => {
    expect(suggestSpotFromText("sf-state", "SF State nursing grad at Legion of Honor")?.key).toBe("legion-of-honor");
    expect(suggestSpotFromText("sf-state", "Cap toss by the SFSU waterfall")?.key).toBe("garden-of-remembrance");
    expect(suggestSpotFromText("sf-state", "Grad at the Golden Gate Bridge")).toBeNull();
  });
});

// ── Photo association ───────────────────────────────────────────────────────

const PALACE = KNOWN_PLACES.find((p) => p.key === "palace-of-fine-arts")!;
const ctx: ResolveContext = { places: KNOWN_PLACES, dbGuides: [] };

function engine(overrides: Partial<EngineSource> = {}): EngineSource {
  return {
    url: "u", contentHash: null, sessionId: "s1", sessionName: "Ana", serviceType: "grads",
    schoolSlug: "sf-state", primaryLocation: null, secondaryLocations: [], gpsLatitude: null, gpsLongitude: null,
    publishable: true, excluded: false, quality: 8, width: 4000, height: 6000, ...overrides,
  };
}

function portfolio(id: number, overrides: Partial<PortfolioSource> = {}): PortfolioSource {
  return {
    id, url: `u${id}`, title: "Graduation portrait", alt: "Graduation portrait", category: "grads",
    featured: false, sortOrder: id, width: 4000, height: 6000, contentHash: null,
    school: null, location: null, sessionLabel: null, ...overrides,
  };
}

describe("enginePhotoPlace (multi-location sessions)", () => {
  it("a single-location session places every photo", () => {
    expect(enginePhotoPlace(engine({ primaryLocation: "Legion of honor" }), KNOWN_PLACES)?.key).toBe("legion-of-honor");
  });

  it("a campus + Palace session places a photo only by its own GPS", () => {
    const multi = { primaryLocation: "SF State", secondaryLocations: ["Palace of Fine Arts"] };
    expect(enginePhotoPlace(engine(multi), KNOWN_PLACES)).toBeNull();
    const atPalace = engine({ ...multi, gpsLatitude: PALACE.latitude!, gpsLongitude: PALACE.longitude! });
    expect(enginePhotoPlace(atPalace, KNOWN_PLACES)?.key).toBe("palace-of-fine-arts");
    const onCampus = engine({ ...multi, gpsLatitude: 37.7219, gpsLongitude: -122.4782 });
    expect(enginePhotoPlace(onCampus, KNOWN_PLACES)).toBeNull();
  });

  it("GPS never picks a place the session didn't name", () => {
    const named = engine({ primaryLocation: "SF State", secondaryLocations: ["Legion of Honor"],
      gpsLatitude: PALACE.latitude!, gpsLongitude: PALACE.longitude! });
    expect(enginePhotoPlace(named, KNOWN_PLACES)).toBeNull();
  });
});

describe("school vs place stay separate", () => {
  const sfsuPalace = resolvePhoto(portfolio(1), engine({ url: "u1", primaryLocation: "Palace of Fine Arts" }), ctx);
  const couplesPalace = resolvePhoto(
    portfolio(2, { category: "couples" }),
    engine({ url: "u2", sessionId: "s2", serviceType: "couples", schoolSlug: null, primaryLocation: "Palace of Fine Arts" }),
    ctx,
  );
  const sfsuLegion = resolvePhoto(portfolio(3), engine({ url: "u3", sessionId: "s3", primaryLocation: "Legion of Honor" }), ctx);
  const pool: PhotoPool = {
    photos: [sfsuPalace, couplesPalace, sfsuLegion], explicitSchool: [], sessionSchool: [], journal: [], curation: [], spotTags: [], errors: [],
  };

  it("an SF State grad photo at the Palace reaches the SFSU page and the Palace portrait guide", () => {
    expect(sfsuPalace.pages).toEqual(["grads/sf-state", "portrait/palace-of-fine-arts"]);
    expect(sfsuPalace.placeKey).toBe("palace-of-fine-arts");
  });

  it("a couples session at the Palace never reaches the SFSU guide", () => {
    const urls = candidatesForPage(pool, "grads/sf-state").map((c) => c.url);
    expect(urls).toEqual(["u1", "u3"]);
    expect(candidatesForPage(pool, "grads/sf-state").map((c) => c.placeKey)).toEqual(["palace-of-fine-arts", "legion-of-honor"]);
  });

  it("grad photos never go to couples or family guides", () => {
    expect(sfsuLegion.pages).toEqual(["grads/sf-state"]); // Legion has couples/family guides only
  });
});

describe("SF State spot photo layout", () => {
  const spotKeys = [...CAMPUS_KEYS, ...OFF_CAMPUS_KEYS];
  const cand = (url: string, placeKey: string | null = null): PageCandidate => ({
    id: url, url, alt: url, caption: null, width: 4000, height: 6000, explicit: false, explicitOrder: 0,
    featured: false, quality: 8, sortOrder: 0, sessionKey: "s", placeKey,
  });
  const tag = (imageUrl: string, spotKey: string): SpotTag =>
    ({ schoolSlug: "sf-state", imageUrl, spotKey, isFeatured: false, position: 0 });
  const input = (overrides: Partial<SpotPhotoInput> = {}): SpotPhotoInput => ({
    spotKeys,
    eligible: [cand("hero"), cand("p1", "palace-of-fine-arts"), cand("p2", "palace-of-fine-arts"), cand("l1", "legion-of-honor"), cand("x")],
    hiddenUrls: new Set(), heroUrl: "hero", tags: [], fallbacks: {}, placeSpots: spotKeysByPlace("sf-state"),
    ...overrides,
  });

  it("fills off-campus sections from place evidence and keeps unknown photos in the gallery", () => {
    const layout = buildSpotPhotoLayout(input());
    expect(layout.bySpot["palace-of-fine-arts"].map((p) => [p.url, p.source])).toEqual([["p1", "place"], ["p2", "place"]]);
    expect(layout.bySpot["legion-of-honor"].map((p) => p.url)).toEqual(["l1"]);
    expect(layout.bySpot["sfsu-main-quad"]).toEqual([]);
    expect(layout.gallery.map((c) => c.url)).toEqual(["x"]);
  });

  it("a manual tag elsewhere wins over place evidence", () => {
    const layout = buildSpotPhotoLayout(input({ tags: [tag("p1", "sfsu-entrance-sign")] }));
    expect(layout.bySpot["sfsu-entrance-sign"].map((p) => p.url)).toEqual(["p1"]);
    expect(layout.bySpot["palace-of-fine-arts"].map((p) => p.url)).toEqual(["p2"]);
  });

  it("once Chris tags a photo for a spot, the section is only his picks", () => {
    const layout = buildSpotPhotoLayout(input({ tags: [tag("x", "palace-of-fine-arts")] }));
    expect(layout.bySpot["palace-of-fine-arts"].map((p) => [p.url, p.source])).toEqual([["x", "tag"]]);
    expect(layout.gallery.map((c) => c.url)).toEqual(["p1", "p2"]);
  });

  it("never repeats the hero photo in a section", () => {
    const layout = buildSpotPhotoLayout(input({ heroUrl: "p1", eligible: [cand("p1", "palace-of-fine-arts")] }));
    expect(layout.bySpot["palace-of-fine-arts"]).toEqual([]);
  });
});
