import { describe, expect, it } from "vitest";
import { data as sjsu } from "@/app/(professional)/grads/sjsu/data";
import { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";
import { builtInSchool, schoolMatchesText } from "@/lib/contentEngine/schools";
import { inferSchoolFromText } from "@/lib/pagePhotos/resolve";
import { isSchoolSpotKey, spotsForSchool, suggestSpotFromText } from "@/lib/schoolSpots";

const guide = sjsu.spotsGuide!;
const allGuideText = JSON.stringify(sjsu);

describe("SJSU location guide content", () => {
  it("lists exactly Chris's five spots, each with a registered photo key", () => {
    expect(sjsu.spots.map((s) => s.key)).toEqual([
      "sjsu-sign", "tower-hall-lawn", "student-union", "seventh-street-palms", "tower-hall-steps",
    ]);
    expect(sjsu.spots.map((s) => s.key).sort()).toEqual(spotsForSchool("sjsu").map((s) => s.key).sort());
  });

  it("marks the sign, Tower Hall Lawn and the Student Union as the must-haves", () => {
    expect(sjsu.spots.filter((s) => s.priority === "must-have").map((s) => s.key))
      .toEqual(["sjsu-sign", "tower-hall-lawn", "student-union"]);
  });

  it("uses the official names for the Student Union and the paseo", () => {
    expect(sjsu.spots.find((s) => s.key === "student-union")?.officialName).toBe("Diaz Compean Student Union");
    expect(sjsu.spots.find((s) => s.key === "seventh-street-palms")?.officialName).toBe("Seventh Street Paseo");
  });

  it("routes through every spot exactly once and only through real spots", () => {
    const keys = guide.route.steps.map((s) => s.spotKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => isSchoolSpotKey("sjsu", k))).toBe(true);
    expect(keys).toHaveLength(sjsu.spots.length);
  });

  it("recommends sunrise and golden hour, cautions about midday and graduation week, and a 60-minute session", () => {
    const timing = guide.bestTime.paragraphs.join(" ");
    expect(timing).toMatch(/golden hour/i);
    expect(timing).toMatch(/sunrise/i);
    expect(timing).toMatch(/avoiding midday/i);
    expect(guide.tips.map((t) => t.title)).toContain("Avoid graduation week when possible");
    expect(guide.route.intro.join(" ")).toMatch(/60-minute/);
  });

  it("never hardcodes clock times or states unverified logistics", () => {
    expect(allGuideText).not.toMatch(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i);
    expect(allGuideText).not.toMatch(/parking|permit|\$\d|minutes? walk|walking time|guarantee(d)? (clear|perfect)/i);
    expect(allGuideText).not.toMatch(/perfect weather|year-round sun/i);
    expect(allGuideText).not.toMatch(/MLK Library|Event Center|Campus Quad/);
  });

  it("keeps the guide and landing-page FAQs distinct (no duplicate FAQ questions)", () => {
    const landing = new Set((sjsu.faqs ?? []).map((f) => f.q));
    expect(guide.faqs.filter((f) => landing.has(f.q))).toEqual([]);
    expect(guide.faqs).toHaveLength(6);
  });

  it("uses the requested title and meta description on the existing /spots URL", () => {
    const meta = buildSpotsMetadata(sjsu);
    expect(meta.title).toBe("Best SJSU Graduation Photo Locations");
    expect(meta.alternates?.canonical).toBe("/grads/sjsu/spots");
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.description).toMatch(/Tower Hall/);
  });
});

describe("SJSU school-name normalization", () => {
  const variants = ["SJSU", "San Jose State", "San José State", "San Jose State University", "San José State University"];

  it.each(variants)("Content Engine school picker maps %s to sjsu", (name) => {
    expect(schoolMatchesText(builtInSchool("sjsu")!, name)).toBe(true);
  });

  it.each(variants)("photo text naming %s resolves to the sjsu page", (name) => {
    expect(inferSchoolFromText(`${name} graduation portrait`).school).toBe("sjsu");
  });

  it.each(["San Jose Rose Garden family portrait", "Downtown San Jose engagement session", "San Jose City College grad"])(
    "does not treat %s as SJSU", (text) => {
      expect(inferSchoolFromText(text).school).toBeNull();
    },
  );
});

describe("suggestSpotFromText (admin hint only)", () => {
  it("suggests the spot a photo's own text names", () => {
    expect(suggestSpotFromText("sjsu", "SJSU grad tossing cap beside the San Jose State University sign")?.key).toBe("sjsu-sign");
    expect(suggestSpotFromText("sjsu", "Gold confetti pop outside Tower Hall")?.key).toBe("tower-hall-lawn");
    expect(suggestSpotFromText("sjsu", "Woman walking a palm-lined San Jose State campus path")?.key).toBe("seventh-street-palms");
  });

  it("prefers the more specific spot and gives no hint for unrelated or conflicting text", () => {
    expect(suggestSpotFromText("sjsu", "Seated portrait on the Tower Hall steps")?.key).toBe("tower-hall-steps");
    expect(suggestSpotFromText("sjsu", "Grad in a white rose garden")).toBeNull();
    expect(suggestSpotFromText("sjsu", "Student Union and palm trees")).toBeNull();
    expect(suggestSpotFromText("stanford", "Tower Hall")).toBeNull();
  });
});
