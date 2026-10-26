import { describe, expect, it } from "vitest";
import { data as usf } from "@/app/(professional)/grads/usf/data";
import { data as sfState } from "@/app/(professional)/grads/sf-state/data";
import { SF_OFF_CAMPUS_SPOTS } from "@/app/(professional)/grads/sfOffCampus";
import { guideCampusSpots, SYNCED_GUIDE_DATA } from "@/app/(professional)/grad-guide/campus-spots/guideSpots";
import { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";
import { builtInSchool, schoolMatchesText } from "@/lib/contentEngine/schools";
import type { LocationSpot } from "@/lib/gradGuideData";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { matchPlacesByName } from "@/lib/locations/match";
import { candidatesForPage } from "@/lib/pagePhotos/candidates";
import type { PageCandidate } from "@/lib/pagePhotos/curate";
import type { PhotoPool, SpotTag } from "@/lib/pagePhotos/pool";
import type { SchoolSpotsGuidePhotos } from "@/lib/pagePhotos/publicPages";
import {
  enginePhotoPlace, inferSchoolFromText, resolvePhoto,
  type EngineSource, type PortfolioSource, type ResolveContext,
} from "@/lib/pagePhotos/resolve";
import { buildSpotPhotoLayout } from "@/lib/pagePhotos/spotPhotos";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { normalizeSchool } from "@/lib/schoolDetection";
import {
  GUIDE_SYNCED_CAMPUS_SPOTS, isSchoolSpotKey, SF_OFF_CAMPUS_SPOT_DEFS, sectionSpotKeys, spotKeysByPlace, spotsForSchool, suggestSpotFromText,
} from "@/lib/schoolSpots";

const guide = usf.spotsGuide!;
const allGuideText = JSON.stringify(usf);
const SECTION_KEYS = [
  "st-ignatius-church", "gleeson-library", "los-lobos-de-loyola",
  "usf-glass-hallway", "lone-mountain-stairs", "lone-mountain-palm-walkway",
];
const LANDMARK_KEYS = [
  "st-ignatius-church", "st-ignatius-walkway", "gleeson-library", "los-lobos-de-loyola",
  "usf-glass-hallway", "lone-mountain-stairs", "lone-mountain-palm-walkway", "lone-mountain-main-building",
];
const SF_KEYS = SF_OFF_CAMPUS_SPOT_DEFS.map((s) => s.key);
const spot = (key: string) => usf.spots.find((s) => s.key === key)!;

describe("USF location guide content", () => {
  it("covers Chris's six photo areas in his order, each a registered photo key", () => {
    expect(usf.spots.map((s) => s.key)).toEqual(SECTION_KEYS);
    expect(spotsForSchool("usf").map((s) => s.key)).toEqual([...LANDMARK_KEYS, ...SF_KEYS]);
    expect(guide.offCampus!.spots.map((s) => s.key)).toEqual(SF_KEYS);
  });

  it("keeps the walkway and main building as compositions inside their sections, stairs on their own", () => {
    expect(sectionSpotKeys("usf", "st-ignatius-church")).toEqual(["st-ignatius-church", "st-ignatius-walkway"]);
    expect(sectionSpotKeys("usf", "lone-mountain-palm-walkway")).toEqual(["lone-mountain-palm-walkway", "lone-mountain-main-building"]);
    expect(sectionSpotKeys("usf", "lone-mountain-stairs")).toEqual(["lone-mountain-stairs"]);
  });

  it("routes from the main campus and finishes at Lone Mountain at sunset", () => {
    const keys = guide.route.steps.map((s) => s.spotKey);
    expect(keys).toEqual(SECTION_KEYS);
    expect(keys.every((k) => isSchoolSpotKey("usf", k))).toBe(true);
    expect(guide.route.steps.at(-1)!.text).toMatch(/sunset/);
    expect(guide.route.notes.join(" ")).toMatch(/begin near Gleeson Library/);
    expect(spot("lone-mountain-palm-walkway")).toMatchObject({ signature: true, role: "Final stop · sunset" });
  });

  it("qualifies the glass hallway's access and never suggests getting around it", () => {
    const hallway = spot("usf-glass-hallway");
    expect(hallway.name).toBe("USF Glass Hallway");
    expect(hallway.notice!.text).toMatch(/student ID/);
    expect(hallway.notice!.text).toMatch(/doesn't by itself give a professional photographer permission/);
    expect(hallway.notice!.text).toMatch(/never tailgate/);
    expect(allGuideText).not.toMatch(/Lo Schiavo|Harney|Center for Science/);
  });

  it("names the sculpture officially and treats it as artwork", () => {
    const wolves = spot("los-lobos-de-loyola").details!.join(" ");
    expect(wolves).toMatch(/Los Lobos de Loyola/);
    expect(wolves).toMatch(/Pancho Cárdenas/);
    expect(wolves).toMatch(/no climbing, standing, or sitting on it/);
  });

  it("puts the wind warning on Lone Mountain and in a what-to-bring section", () => {
    expect(spot("lone-mountain-palm-walkway").notice!.label).toBe("Wind warning");
    const bring = guide.afterRoute!.find((s) => s.id === "what-to-bring")!;
    expect(bring.heading).toBe("What to Bring to Your USF Graduation Photoshoot");
    expect(bring.bullets).toEqual(expect.arrayContaining(["Bobby pins", "Small clothing clips or safety pins", "Hair ties and hair clips"]));
    expect(bring.paragraphs.join(" ")).toMatch(/rather than pushing pins through delicate fabric/);
  });

  it("recommends golden hour on sunny days and explains overcast flexibility without guarantees", () => {
    const timing = [...guide.bestTime.paragraphs, guide.bestTime.weather].join(" ");
    expect(guide.bestTime.heading).toBe("When Is the Best Time to Take USF Graduation Photos?");
    expect(timing).toMatch(/golden hour before sunset/);
    expect(timing).toMatch(/diffuse/);
    expect(guide.bestTime.lists!.map((l) => l.label)).toEqual(["Sunny days", "Overcast days"]);
    expect(guide.bestTime.weather).toMatch(/can't promise clear skies, sunset colors, or shadow-free light/);
  });

  it("only photographs church and library exteriors and invents no logistics", () => {
    expect(allGuideText).not.toMatch(/interior light|inside the church|inside the library/i);
    expect(allGuideText).not.toMatch(/Kalmanovitz|Welch Field|Golden Gate Park|panoramic/);
    expect(allGuideText).not.toMatch(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i);
    expect(allGuideText).not.toMatch(/parking|minutes? walk|walking time|\bone hour\b|1-hour/i);
  });

  it("recommends off campus only SF State's verified San Francisco locations", () => {
    expect(guide.offCampus!.spots).toEqual(sfState.spotsGuide!.offCampus!.spots);
    expect(guide.offCampus!.spots).toEqual([...SF_OFF_CAMPUS_SPOTS]);
    expect(allGuideText).not.toMatch(/Haight/i);
    const [a, b, c] = guide.plans!.options;
    expect(guide.plans!.options).toHaveLength(3);
    expect(a.body).toMatch(/St\. Ignatius Church, Gleeson Library, the wolf sculpture, the glass hallway when student access allows, and Lone Mountain at sunset/);
    expect(b.title).toBe("USF + Palace of Fine Arts");
    expect(c.title).toBe("USF + Legion of Honor");
  });

  it("prices added locations from the catalog", () => {
    const notes = guide.plans!.notes.join(" ");
    const { secondLocation, extra30Minutes } = PRICING_CATALOG.graduation.addOns;
    expect(notes).toContain(`$${secondLocation.price}`);
    expect(notes).toContain(`$${extra30Minutes.price}`);
    expect(guide.plans!.intro.join(" ")).toMatch(/aren't part of a standard graduation session/);
  });

  it("has ten guide FAQs, distinct from the landing page's", () => {
    const landing = new Set((usf.faqs ?? []).map((f) => f.q));
    expect(guide.faqs).toHaveLength(10);
    expect(guide.faqs.filter((f) => landing.has(f.q))).toEqual([]);
  });

  it("uses the requested title and description on the existing /spots URL", () => {
    const meta = buildSpotsMetadata(usf);
    expect(meta.title).toBe("Best USF Graduation Photo Locations");
    expect(meta.alternates?.canonical).toBe("/grads/usf/spots");
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.description).toMatch(/Gleeson Library, St. Ignatius Church, and Lone Mountain/);
  });
});

describe("USF school-name normalization", () => {
  it.each(["USF", "University of San Francisco", "USF Dons", "University of San Francisco Hilltop Campus", "USFCA"])(
    "%s → usf", (name) => {
      expect(normalizeSchool(name)?.abbreviation).toBe("USF");
      expect(inferSchoolFromText(`${name} graduation portrait`).school).toBe("usf");
    },
  );

  it.each([
    "SFSU", "San Francisco State University", "UCSF", "University of California, San Francisco",
    "University of South Florida", "USF Bulls", "USF Tampa", "USF St. Petersburg",
  ])("%s is never USF", (name) => {
    expect(normalizeSchool(name)?.abbreviation).not.toBe("USF");
    expect(inferSchoolFromText(`${name} graduation portrait`).school).not.toBe("usf");
  });

  it("a USF grad whose family is flying in from Florida is still USF", () => {
    expect(normalizeSchool("USF grad, family flying in from Florida")?.abbreviation).toBe("USF");
  });

  it("the picker finds USF by its Dons alias", () => {
    expect(schoolMatchesText(builtInSchool("usf")!, "USF Dons")).toBe(true);
  });
});

describe("USF landmark hints (admin suggestions only)", () => {
  it.each([
    ["USF Nursing Graduate Portrait at Geschke Center", "gleeson-library"],
    ["USF Graduate Twirls Cap on Palm-Lined Walkway", "lone-mountain-palm-walkway"],
    ["Grad with the wolf sculpture outside the library", "los-lobos-de-loyola"],
    ["Walking on the St. Ignatius walkway", "st-ignatius-walkway"],
    ["In front of St. Ignatius Church", "st-ignatius-church"],
    ["Seated on the Lone Mountain steps", "lone-mountain-stairs"],
  ])("%s → %s", (text, key) => {
    expect(suggestSpotFromText("usf", text)?.key).toBe(key);
  });

  it("never guesses between two spots, from bare Lone Mountain, or from the off-campus Lyon Street Steps", () => {
    expect(suggestSpotFromText("usf", "Gleeson Library and the glass hallway")).toBeNull();
    expect(suggestSpotFromText("usf", "USF grad at Lone Mountain")).toBeNull();
    expect(suggestSpotFromText("usf", "USF Nursing Grad Sunset Portrait on Lyon Street Steps")).toBeNull();
  });
});

// ── School vs. physical place ───────────────────────────────────────────────

const PALACE = KNOWN_PLACES.find((p) => p.key === "palace-of-fine-arts")!;
const ctx: ResolveContext = { places: KNOWN_PLACES, dbGuides: [] };
const LONE_MOUNTAIN_GPS = { gpsLatitude: 37.7785, gpsLongitude: -122.4515 };
const GLEESON_GPS = { gpsLatitude: 37.7765, gpsLongitude: -122.4505 };

function engine(overrides: Partial<EngineSource> = {}): EngineSource {
  return {
    url: "u", contentHash: null, sessionId: "s1", sessionName: "Maya", serviceType: "grads",
    schoolSlug: "usf", primaryLocation: null, secondaryLocations: [], gpsLatitude: null, gpsLongitude: null,
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

describe("off-campus places stay separate from the USF campus", () => {
  it("USF place-matches only the shared SF off-campus spots; Haight-Ashbury is a known place but no USF spot", () => {
    expect(spotKeysByPlace("usf")).toEqual(spotKeysByPlace("sf-state"));
    expect(Object.keys(spotKeysByPlace("usf"))).toEqual(SF_KEYS);
    expect(matchPlacesByName("The Haight", KNOWN_PLACES).map((p) => p.key)).toEqual(["haight-ashbury"]);
    expect(isSchoolSpotKey("usf", "haight-ashbury")).toBe(false);
  });

  it("a USF + Palace session places photos by their own GPS, never campus frames", () => {
    const multi = { primaryLocation: "USF", secondaryLocations: ["Palace of Fine Arts"] };
    expect(enginePhotoPlace(engine({ ...multi, gpsLatitude: PALACE.latitude!, gpsLongitude: PALACE.longitude! }), KNOWN_PLACES)?.key)
      .toBe("palace-of-fine-arts");
    expect(enginePhotoPlace(engine({ ...multi, ...LONE_MOUNTAIN_GPS }), KNOWN_PLACES)).toBeNull();
    expect(enginePhotoPlace(engine({ ...multi, ...GLEESON_GPS }), KNOWN_PLACES)).toBeNull();
    expect(enginePhotoPlace(engine(multi), KNOWN_PLACES)).toBeNull();
  });

  it("school and place stay separate: Palace couples photos never reach the USF page", () => {
    const usfPalace = resolvePhoto(portfolio(1), engine({ url: "u1", primaryLocation: "Palace of Fine Arts" }), ctx);
    const couplesPalace = resolvePhoto(
      portfolio(2, { category: "couples" }),
      engine({ url: "u2", sessionId: "s2", serviceType: "couples", schoolSlug: null, primaryLocation: "Palace of Fine Arts" }),
      ctx,
    );
    expect(usfPalace).toMatchObject({ school: "usf", placeKey: "palace-of-fine-arts" });
    expect(couplesPalace).toMatchObject({ school: null, placeKey: "palace-of-fine-arts" });
    const pool: PhotoPool = {
      photos: [usfPalace, couplesPalace], explicitSchool: [], sessionSchool: [], curation: [], spotTags: [], errors: [],
    };
    expect(candidatesForPage(pool, "grads/usf").map((c) => c.url)).toEqual(["u1"]);
  });

  it("unpublishable or excluded USF photos never reach the page", () => {
    expect(resolvePhoto(portfolio(3), engine({ url: "u3", publishable: false }), ctx).pages).toEqual([]);
    expect(resolvePhoto(portfolio(4), engine({ url: "u4", excluded: true }), ctx).pages).toEqual([]);
  });
});

// ── Photo layout and Campus Spots sync ──────────────────────────────────────

const cand = (url: string, placeKey: string | null = null): PageCandidate => ({
  id: url, url, alt: url, caption: null, width: 4000, height: 6000, explicit: false, explicitOrder: 0,
  featured: false, quality: 8, sortOrder: 0, sessionKey: "s", placeKey,
});
const tag = (imageUrl: string, spotKey: string, isFeatured = false): SpotTag =>
  ({ schoolSlug: "usf", imageUrl, spotKey, isFeatured, position: 0 });

describe("USF spot photo layout", () => {
  const base = {
    spotKeys: spotsForSchool("usf").map((s) => s.key),
    eligible: [cand("hero"), cand("a"), cand("b"), cand("h1", "palace-of-fine-arts"), cand("x")],
    hiddenUrls: new Set<string>(), heroUrl: "hero", fallbacks: {}, placeSpots: spotKeysByPlace("usf"),
  };

  it("an untagged photo stays in the gallery; Chris's tags and featured picks decide sections", () => {
    const layout = buildSpotPhotoLayout({
      ...base, tags: [tag("a", "st-ignatius-walkway"), tag("b", "st-ignatius-walkway", true)],
    });
    expect(layout.bySpot["st-ignatius-walkway"].map((p) => p.url)).toEqual(["b", "a"]);
    expect(layout.bySpot["palace-of-fine-arts"].map((p) => p.source)).toEqual(["place"]);
    expect(layout.gallery.map((c) => c.url)).toEqual(["x"]);
  });

  it("a manual tag beats place evidence", () => {
    const layout = buildSpotPhotoLayout({ ...base, tags: [tag("h1", "lone-mountain-palm-walkway")] });
    expect(layout.bySpot["lone-mountain-palm-walkway"].map((p) => p.url)).toEqual(["h1"]);
    expect(layout.bySpot["palace-of-fine-arts"]).toEqual([]);
  });
});

describe("Campus Spots stays in sync with the USF guide", () => {
  const row = (id: number, name: string, image_url: string | null): LocationSpot => ({
    id, school_id: "usf", school_name: "x", school_short: "x", name, description: "old", tip: "old",
    icon: "🏫", image_url, order: id,
  });
  const rows = [
    row(16, "Gleeson Library", "gleeson.jpg"), row(21, "Lone Mountain", "palms.jpg"),
    row(20, "In Front of Church", "church.jpg"), row(22, "Glass Hallway", "hall.jpg"),
  ];
  const photos: SchoolSpotsGuidePhotos = {
    hero: null, gallery: [],
    bySpot: { "lone-mountain-stairs": [{ id: "s", image_url: "stairs.jpg", alt: "", caption: null, width: 4, height: 5 }] },
  };
  const spots = guideCampusSpots("usf", "usf", usf, rows, photos);

  it("syncs USF only, and the sync map points at real guide data", () => {
    expect(GUIDE_SYNCED_CAMPUS_SPOTS).toEqual({ usf: "usf" });
    expect(Object.keys(SYNCED_GUIDE_DATA)).toEqual(Object.values(GUIDE_SYNCED_CAMPUS_SPOTS));
  });

  it("takes names and text from the guide, in Chris's order", () => {
    expect(spots.map((s) => s.name)).toEqual(usf.spots.map((s) => s.name));
    expect(spots.every((s) => s.description !== "old" && s.tip !== "old")).toBe(true);
    expect(spots.find((s) => s.name === "USF Glass Hallway")!.tip).toMatch(/access-controlled/);
    expect(spots.at(-1)!.tip).toMatch(/windy/);
  });

  it("keeps the existing Campus Spots photos and fills new spots from tagged guide photos", () => {
    const image = (name: string) => spots.find((s) => s.name === name)!.image_url;
    expect(image("St. Ignatius Church")).toBe("church.jpg");
    expect(image("Gleeson Library")).toBe("gleeson.jpg");
    expect(image("USF Glass Hallway")).toBe("hall.jpg");
    expect(image("Lone Mountain Palm Trees & Main Building")).toBe("palms.jpg");
    expect(image("Lone Mountain Stairs")).toBe("stairs.jpg");
    expect(image("Los Lobos de Loyola Wolf Sculpture")).toBeNull();
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
  });
});
