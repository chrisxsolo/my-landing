import { describe, expect, it } from "vitest";
import { data as berkeley } from "@/app/(professional)/grads/uc-berkeley/data";
import { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";
import { builtInSchool, schoolMatchesText } from "@/lib/contentEngine/schools";
import { buildSpotPhotoLayout } from "@/lib/pagePhotos/spotPhotos";
import { inferSchoolFromText } from "@/lib/pagePhotos/resolve";
import {
  isSchoolSpotKey, normalizeSpotNote, spotsForSchool, SPOT_NOTE_MAX, suggestSpotFromText,
} from "@/lib/schoolSpots";
import type { PageCandidate } from "@/lib/pagePhotos/curate";

const guide = berkeley.spotsGuide!;
const allGuideText = JSON.stringify(berkeley);
const spotKeys = berkeley.spots.map((s) => s.key);

describe("UC Berkeley location guide content", () => {
  it("covers Chris's seven spots, each with a registered photo key", () => {
    expect(spotKeys).toEqual([
      "sather-gate", "doe-library-entrance", "doe-library-ledge", "campanile",
      "hearst-mining", "mining-circle", "cherry-blossoms",
    ]);
    expect([...spotKeys].sort()).toEqual(spotsForSchool("uc-berkeley").map((s) => s.key).sort());
  });

  it("starts the route at Sather Gate and ends at the front of Doe Library", () => {
    const keys = guide.route.steps.map((s) => s.spotKey);
    expect(keys[0]).toBe("sather-gate");
    expect(keys.at(-1)).toBe("doe-library-entrance");
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => isSchoolSpotKey("uc-berkeley", k))).toBe(true);
    expect(guide.route.notes.join(" ")).toMatch(/not a fixed walking route/);
  });

  it("explains why Doe Library comes last without promising perfect exposure", () => {
    const doe = berkeley.spots.find((s) => s.key === "doe-library-entrance")!;
    expect(doe.details!.join(" ")).toMatch(/sunset/);
    expect(doe.details!.join(" ")).toMatch(/brighter than you are/);
    expect(allGuideText).not.toMatch(/perfect exposure|always (?:perfect|balanced)/i);
  });

  it("recommends sunrise and golden hour, and keeps the cherry blossoms conditional", () => {
    const timing = guide.bestTime.paragraphs.join(" ");
    expect(timing).toMatch(/sunrise/i);
    expect(timing).toMatch(/golden hour/i);
    const cherry = berkeley.spots.find((s) => s.key === "cherry-blossoms")!;
    expect(cherry.priority).toBe("seasonal");
    expect(cherry.tip).toMatch(/may not be out/);
  });

  it("never recommends Doe Library's interior and links the Library's policy", () => {
    expect(allGuideText).not.toMatch(/inside (?:of )?Doe Library (?:is|has|works)/i);
    const rules = guide.sections!.find((s) => s.id === "campus-rules")!;
    expect(rules.links!.map((l) => l.href)).toContain("https://www.lib.berkeley.edu/about/filming");
  });

  it("keeps champagne conditional on current rules and never part of a package", () => {
    const champagne = guide.sections!.find((s) => s.id === "champagne")!.paragraphs.join(" ");
    expect(champagne).toMatch(/depend on current university rules/);
    expect(champagne).toMatch(/never part of a session package/);
    expect(allGuideText).not.toMatch(/champagne (?:is|popping is) (?:allowed|permitted|fine)/i);
  });

  it("makes no promises about empty backgrounds, clock times, or session length", () => {
    expect(allGuideText).not.toMatch(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i);
    expect(allGuideText).not.toMatch(/\d+[- ]minute|\bone-hour\b|minutes? walk|walking time/i);
    expect(allGuideText).not.toMatch(/no crowds|empty campus|guaranteed? (?:empty|clear|quiet)/i);
    expect(allGuideText).not.toMatch(/Memorial Glade|Faculty Glade/);
  });

  it("keeps the guide and landing-page FAQs distinct", () => {
    const landing = new Set((berkeley.faqs ?? []).map((f) => f.q));
    expect(guide.faqs.filter((f) => landing.has(f.q))).toEqual([]);
    expect(guide.faqs).toHaveLength(9);
  });

  it("uses the requested title and description on the existing /spots URL", () => {
    const meta = buildSpotsMetadata(berkeley);
    expect(meta.title).toBe("Best UC Berkeley Graduation Photo Locations");
    expect(meta.alternates?.canonical).toBe("/grads/uc-berkeley/spots");
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
  });
});

describe("UC Berkeley school-name normalization", () => {
  it.each(["UC Berkeley", "University of California, Berkeley", "Berkeley", "UCB"])(
    "Content Engine school picker maps %s to uc-berkeley", (name) => {
      expect(schoolMatchesText(builtInSchool("uc-berkeley")!, name)).toBe(true);
    },
  );

  it.each(["UC Berkeley graduation portrait", "University of California, Berkeley grad", "Cal Bears grad at Sather Gate"])(
    "photo text %s resolves to the uc-berkeley page", (text) => {
      expect(inferSchoolFromText(text).school).toBe("uc-berkeley");
    },
  );

  it.each(["Berkeley High School graduation", "Berkeley City College grad", "Berkeley Marina portraits", "Cal grad portrait"])(
    "does not place %s on the uc-berkeley page from text alone", (text) => {
      expect(inferSchoolFromText(text).school).toBeNull();
    },
  );
});

describe("UC Berkeley spot hints (admin suggestions only)", () => {
  it.each([
    ["Grad under Sather Gate", "sather-gate"],
    ["Cap toss in front of Doe Library", "doe-library-entrance"],
    ["Portrait on the Doe Library ledge at sunset", "doe-library-ledge"],
    ["Sather Tower behind the graduate", "campanile"],
    ["Portrait outside Hearst Memorial Mining Building", "hearst-mining"],
    ["Reflection in the Hearst Mining Circle pool", "mining-circle"],
    ["Graduate under pink cherry blossoms", "cherry-blossoms"],
  ])("suggests a spot for %s", (text, key) => {
    expect(suggestSpotFromText("uc-berkeley", text)?.key).toBe(key);
  });

  it.each(["Doe Library graduation portrait", "Inside Doe Library reading room", "Sather Gate with the Campanile behind", "Graduate on a lawn"])(
    "gives no hint for ambiguous or unrelated text: %s", (text) => {
      expect(suggestSpotFromText("uc-berkeley", text)).toBeNull();
    },
  );
});

describe("UC Berkeley spot photos", () => {
  const candidate = (url: string): PageCandidate => ({ url } as PageCandidate);

  it("only places photographer-tagged photos and keeps the rest in the gallery", () => {
    const layout = buildSpotPhotoLayout({
      spotKeys: spotKeys as string[],
      eligible: [candidate("a"), candidate("b"), candidate("c")],
      hiddenUrls: new Set(),
      heroUrl: "a",
      tags: [{ schoolSlug: "uc-berkeley", imageUrl: "b", spotKey: "doe-library-ledge", isFeatured: true, position: 1 }],
      fallbacks: {},
    });
    expect(layout.bySpot["doe-library-ledge"].map((p) => p.url)).toEqual(["b"]);
    expect(layout.bySpot["doe-library-entrance"]).toEqual([]);
    expect(layout.gallery.map((c) => c.url)).toEqual(["c"]);
  });

  it("never uses the Inside Doe Library campus-spot row as a fallback", () => {
    const names = spotsForSchool("uc-berkeley").flatMap((s) => s.campusSpotNames);
    expect(names).not.toContain("Inside Doe Library");
  });
});

describe("normalizeSpotNote", () => {
  it("stores one clean plain-text line and clears on empty", () => {
    expect(normalizeSpotNote("  Near the  west\nentrance ")).toBe("Near the west entrance");
    expect(normalizeSpotNote("")).toBeNull();
    expect(normalizeSpotNote("   ")).toBeNull();
    expect(normalizeSpotNote(null)).toBeNull();
  });

  it("rejects non-text and over-long notes", () => {
    expect(normalizeSpotNote(42)).toBeUndefined();
    expect(normalizeSpotNote(undefined)).toBeUndefined();
    expect(normalizeSpotNote("x".repeat(SPOT_NOTE_MAX + 1))).toBeUndefined();
    expect(normalizeSpotNote("x".repeat(SPOT_NOTE_MAX))).toHaveLength(SPOT_NOTE_MAX);
  });
});
