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
// The four public locations, in Chris's order.
const SECTION_KEYS = ["st-ignatius-church", "gleeson-library", "usf-glass-hallway", "lone-mountain-palm-walkway"];
// Legacy compositions: still valid tag keys, shown inside their parent section.
const CHILD_KEYS = ["st-ignatius-walkway", "los-lobos-de-loyola", "lone-mountain-stairs", "lone-mountain-main-building"];
const LANDMARK_KEYS = [
  "st-ignatius-church", "st-ignatius-walkway", "gleeson-library", "los-lobos-de-loyola",
  "usf-glass-hallway", "lone-mountain-stairs", "lone-mountain-palm-walkway", "lone-mountain-main-building",
];
const SF_KEYS = SF_OFF_CAMPUS_SPOT_DEFS.map((s) => s.key);
const spot = (key: string) => usf.spots.find((s) => s.key === key)!;

describe("USF location guide content", () => {
  it("presents exactly four public locations in Chris's order, each a registered photo key", () => {
    expect(usf.spots.map((s) => s.key)).toEqual(SECTION_KEYS);
    expect(usf.spots.map((s) => s.name)).toEqual([
      "St. Ignatius Church", "Gleeson Library & Los Lobos de Loyola", "USF Glass Hallway", "Lone Mountain Palm Trees & Main Building",
    ]);
    expect(spotsForSchool("usf").map((s) => s.key)).toEqual([...LANDMARK_KEYS, ...SF_KEYS]);
    expect(guide.offCampus!.spots.map((s) => s.key)).toEqual(SF_KEYS);
  });

  it("never shows the wolf sculpture or the stairs as a standalone card, section, route step or must-have", () => {
    const publicKeys = [
      ...usf.spots.map((s) => s.key), ...guide.mustHaveKeys!, ...guide.route.steps.map((s) => s.spotKey),
    ];
    for (const key of CHILD_KEYS) expect(publicKeys).not.toContain(key);
    const names = usf.spots.map((s) => s.name);
    expect(names).not.toContain("Los Lobos de Loyola Wolf Sculpture");
    expect(names).not.toContain("Lone Mountain Stairs");
    expect(guide.mustHaveKeys).toEqual(SECTION_KEYS);
    expect(guide.route.steps.map((s) => s.spotKey)).toEqual(SECTION_KEYS);
    expect(guide.route.notes.join(" ")).not.toMatch(/all six|six areas|six stops/i);
  });

  it("keeps the legacy keys as compositions inside their parent sections", () => {
    for (const key of CHILD_KEYS) expect(isSchoolSpotKey("usf", key)).toBe(true);
    expect(sectionSpotKeys("usf", "st-ignatius-church")).toEqual(["st-ignatius-church", "st-ignatius-walkway"]);
    expect(sectionSpotKeys("usf", "gleeson-library")).toEqual(["gleeson-library", "los-lobos-de-loyola"]);
    expect(sectionSpotKeys("usf", "lone-mountain-palm-walkway")).toEqual([
      "lone-mountain-palm-walkway", "lone-mountain-stairs", "lone-mountain-main-building",
    ]);
    expect(sectionSpotKeys("usf", "usf-glass-hallway")).toEqual(["usf-glass-hallway"]);
    // A child never aggregates anything itself.
    for (const key of CHILD_KEYS) expect(sectionSpotKeys("usf", key)).toEqual([key]);
  });

  it("routes from the main campus and finishes at Lone Mountain at sunset", () => {
    const keys = guide.route.steps.map((s) => s.spotKey);
    expect(keys).toEqual(SECTION_KEYS);
    expect(keys.every((k) => isSchoolSpotKey("usf", k))).toBe(true);
    expect(guide.route.steps.at(-1)!.text).toMatch(/stairs on the way up.*sunset/);
    expect(guide.route.steps[1].text).toMatch(/Gleeson Library and the Los Lobos de Loyola wolf sculpture/);
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

  it("folds the wolf sculpture into the Gleeson section: official name, context, artwork rule, portrait ideas", () => {
    const gleeson = spot("gleeson-library");
    const text = gleeson.details!.join(" ");
    expect(text).toMatch(/Immediately outside the library is the wolf sculpture, part of the same stop/);
    expect(text).toMatch(/Officially called Los Lobos de Loyola/);
    expect(text).toMatch(/wolves and a kettle.*Jesuit heritage.*Pancho Cárdenas/);
    expect(text).toMatch(/no climbing, standing, or sitting on it/);
    expect(gleeson.photoIdeas).toEqual(expect.arrayContaining(["Standing beside the wolf sculpture", "Seated portraits near the sculpture"]));
    expect(guide.sections!.find((s) => s.id === "rules")!.paragraphs.join(" ")).toMatch(/Los Lobos de Loyola.*never climb, stand, or sit on it/);
  });

  it("folds the stairs into the Lone Mountain section as a composition, not a destination", () => {
    const lone = spot("lone-mountain-palm-walkway");
    const text = lone.details!.join(" ");
    expect(text).toMatch(/make our way up by the Lone Mountain stairs, and I like using them as part of this stop/);
    expect(text).toMatch(/natural leading lines/);
    expect(text).toMatch(/never pose on railings or edges/);
    expect(text).toMatch(/plan an accessible route/);
    expect(lone.photoIdeas).toContain("Standing or seated portraits on the stairs, using the leading lines");
    expect(lone.campusTip).toMatch(/stairs on the way up/);
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
    expect(a.body).toMatch(/St\. Ignatius Church, Gleeson Library and the wolf sculpture, the glass hallway when student access allows, and Lone Mountain at sunset/);
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

  it("the legacy child keys still hint precisely, so tags stay exact after the public merge", () => {
    expect(suggestSpotFromText("usf", "Wolves and kettle statue portrait")?.key).toBe("los-lobos-de-loyola");
    expect(suggestSpotFromText("usf", "Seated on the Lone Mountain staircase")?.key).toBe("lone-mountain-stairs");
    expect(suggestSpotFromText("usf", "Gleeson Library entrance")?.key).toBe("gleeson-library");
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
      photos: [usfPalace, couplesPalace], explicitSchool: [], sessionSchool: [], journal: [], curation: [], spotTags: [], errors: [],
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

  // What SchoolSpotsGuidePage shows in a section: the parent's photos, then its children's.
  const sectionPhotos = (layout: ReturnType<typeof buildSpotPhotoLayout>, key: string) =>
    sectionSpotKeys("usf", key).flatMap((k) => layout.bySpot[k] ?? []).map((p) => p.url);

  it("a photo tagged with the wolf sculpture shows in the consolidated Gleeson section", () => {
    const layout = buildSpotPhotoLayout({
      ...base, tags: [tag("a", "los-lobos-de-loyola", true), tag("b", "gleeson-library")],
      fallbacks: { "gleeson-library": { url: "x", alt: "" } },
    });
    expect(sectionPhotos(layout, "gleeson-library")).toEqual(["b", "a"]);
    expect(sectionPhotos(layout, "st-ignatius-church")).toEqual([]);
  });

  it("photos tagged with the stairs or the main building show in the consolidated Lone Mountain section", () => {
    const layout = buildSpotPhotoLayout({
      ...base, tags: [tag("a", "lone-mountain-stairs"), tag("b", "lone-mountain-main-building"), tag("x", "lone-mountain-palm-walkway")],
    });
    expect(sectionPhotos(layout, "lone-mountain-palm-walkway")).toEqual(["x", "a", "b"]);
    expect(layout.gallery.map((c) => c.url)).toEqual([]);
  });

  it("no photo repeats across the hero, the sections and the gallery, even when tagged twice", () => {
    const layout = buildSpotPhotoLayout({
      ...base,
      tags: [tag("hero", "los-lobos-de-loyola", true), tag("a", "gleeson-library"), tag("a", "lone-mountain-stairs"), tag("b", "lone-mountain-stairs")],
      fallbacks: { "lone-mountain-palm-walkway": { url: "a", alt: "" } },
    });
    const shown = ["hero", ...SECTION_KEYS.flatMap((key) => sectionPhotos(layout, key)), ...layout.gallery.map((c) => c.url)];
    expect(new Set(shown).size).toBe(shown.length);
    expect(sectionPhotos(layout, "gleeson-library")).toEqual(["a"]);
    expect(sectionPhotos(layout, "lone-mountain-palm-walkway")).toEqual(["b"]);
  });
});

describe("USF structured data lists the four locations", () => {
  // SchoolSpotsGuidePage builds its ItemList from data.spots then the off-campus spots.
  const itemList = [...usf.spots, ...guide.offCampus!.spots].map((s) => s.name);

  it("has one entry per public location and no standalone wolf or stairs item", () => {
    expect(itemList.slice(0, 4)).toEqual(usf.spots.map((s) => s.name));
    expect(itemList).toHaveLength(4 + SF_KEYS.length);
    expect(itemList).not.toContain("Los Lobos de Loyola Wolf Sculpture");
    expect(itemList).not.toContain("Lone Mountain Stairs");
    expect(new Set(itemList).size).toBe(itemList.length);
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
  const sectionPhoto = (id: string, image_url: string) => ({ id, image_url, alt: "", caption: null, width: 4, height: 5 });
  const photos: SchoolSpotsGuidePhotos = {
    hero: null, gallery: [],
    bySpot: { "lone-mountain-stairs": [sectionPhoto("s", "stairs.jpg")], "los-lobos-de-loyola": [sectionPhoto("w", "wolves.jpg")] },
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

  it("generates exactly four USF cards with unique ids, keyed by the parent sections", () => {
    expect(spots).toHaveLength(4);
    expect(spots.map((s) => s.spot_key)).toEqual(SECTION_KEYS);
    expect(spots.map((s) => s.id)).toEqual([20, 16, 22, 21]);
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
    expect(spots.map((s) => s.name)).not.toContain("Lone Mountain Stairs");
    expect(spots.map((s) => s.name)).not.toContain("Los Lobos de Loyola Wolf Sculpture");
  });

  it("keeps the existing Campus Spots photos, so no card is left without one", () => {
    const image = (name: string) => spots.find((s) => s.name === name)!.image_url;
    expect(image("St. Ignatius Church")).toBe("church.jpg");
    expect(image("Gleeson Library & Los Lobos de Loyola")).toBe("gleeson.jpg");
    expect(image("USF Glass Hallway")).toBe("hall.jpg");
    expect(image("Lone Mountain Palm Trees & Main Building")).toBe("palms.jpg");
    expect(spots.every((s) => s.image_url)).toBe(true);
  });

  it("a card with no chosen photo takes a photo tagged with one of its child compositions", () => {
    const bare = guideCampusSpots("usf", "usf", usf, [row(20, "In Front of Church", "church.jpg")], photos);
    const image = (key: string) => bare.find((s) => s.spot_key === key)!.image_url;
    expect(image("gleeson-library")).toBe("wolves.jpg");
    expect(image("lone-mountain-palm-walkway")).toBe("stairs.jpg");
    expect(image("usf-glass-hallway")).toBeNull();
    expect(bare.map((s) => s.id)).toEqual([20, 1_000_001, 1_000_002, 1_000_003]);
  });

  it("extra raw USF location_spots rows never add a card: the guide decides the cards", () => {
    const extra = [...rows, row(99, "Lone Mountain Stairs", "extra.jpg"), row(98, "Wolf Sculpture", "wolf.jpg")];
    const withExtra = guideCampusSpots("usf", "usf", usf, extra, photos);
    expect(withExtra).toHaveLength(4);
    expect(withExtra.map((s) => s.image_url)).toEqual(["church.jpg", "gleeson.jpg", "hall.jpg", "palms.jpg"]);
  });

  it("other schools' rows are untouched by the USF guide", () => {
    const sjsu = { ...row(1, "The SJSU Sign Wall", "sign.jpg"), school_id: "sjsu" };
    expect(guideCampusSpots("usf", "usf", usf, [sjsu, ...rows], photos).every((s) => s.school_id === "usf")).toBe(true);
  });
});
