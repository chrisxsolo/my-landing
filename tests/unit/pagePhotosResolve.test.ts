import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import {
  inferSchoolFromText, indexEngineSources, resolvePhoto,
  type EngineSource, type PortfolioSource, type ResolveContext,
} from "@/lib/pagePhotos/resolve";
import { pagePath, parsePageKey } from "@/lib/pagePhotos/pageKeys";

const ctx: ResolveContext = {
  places: KNOWN_PLACES,
  dbGuides: [{ guide: "couples", slug: "shark-fin-cove-santa-cruz", locationKey: "shark-fin-cove", name: "Shark Fin Cove" }],
};

function photo(overrides: Partial<PortfolioSource> = {}): PortfolioSource {
  return {
    id: 1, url: "https://x.supabase.co/storage/v1/object/public/grad-photos/a.jpg",
    title: "Graduation portrait", alt: "Graduation portrait", category: "grads",
    featured: false, sortOrder: 1, width: 4000, height: 6000, contentHash: null,
    school: null, location: null, sessionLabel: null, ...overrides,
  };
}

function engine(overrides: Partial<EngineSource> = {}): EngineSource {
  return {
    url: photo().url, contentHash: null, sessionId: "s1", sessionName: "Kim", serviceType: "grads",
    schoolSlug: "uc-berkeley", primaryLocation: null, publishable: true, excluded: false,
    quality: 9, width: 4000, height: 6000, ...overrides,
  };
}

describe("inferSchoolFromText", () => {
  it.each([
    ["SJSU grad tossing cap", "sjsu"],
    ["San Jose State graduate at Tower Hall", "sjsu"],
    ["San Jose State University Graduation Portrait", "sjsu"],
    ["UC Berkeley Class of 2025", "uc-berkeley"],
    ["University of California, Berkeley grad", "uc-berkeley"],
    ["Berkeley Law Graduate Rooftop Portrait", "uc-berkeley"],
    ["USF Nursing Grad Sunset Portrait", "usf"],
    ["First-generation CSUEB grad", "csueb"],
  ])("%s → %s", (text, slug) => {
    expect(inferSchoolFromText(text).school).toBe(slug);
  });

  it("rejects weak aliases that are not the school's registry name", () => {
    expect(inferSchoolFromText("Cal grad with friends").school).toBeNull(); // bare "Cal" is 0.5
    expect(inferSchoolFromText("Graduate at a park in the East Bay").school).toBeNull();
  });

  it("never maps UC Law SF to Berkeley", () => {
    expect(inferSchoolFromText("UC Law SF Grad with lightsticks at City Hall").school).toBeNull();
  });

  it("treats two schools as ambiguous", () => {
    const result = inferSchoolFromText("SJSU and UC Berkeley grads celebrate together");
    expect(result.school).toBeNull();
    expect(result.note).toMatch(/ambiguous/);
  });

  it("reports a recognised school that has no page", () => {
    expect(inferSchoolFromText("UCSC grad at the beach").note).toMatch(/no school page/);
  });
});

describe("resolvePhoto — school", () => {
  it("an explicit school tag wins over the session and the text", () => {
    const p = resolvePhoto(photo({ school: "sjsu", title: "UC Berkeley grad" }), engine(), ctx);
    expect([p.school, p.schoolSource]).toEqual(["sjsu", "tag"]);
  });

  it("the Content Engine session's school wins over the photo text", () => {
    const p = resolvePhoto(photo({ title: "Stanford grad" }), engine({ schoolSlug: "uc-berkeley" }), ctx);
    expect([p.school, p.schoolSource]).toEqual(["uc-berkeley", "session"]);
    expect(p.pages).toEqual(["grads/uc-berkeley"]);
  });

  it("follows the session when its school changes (no stored association)", () => {
    const p = resolvePhoto(photo(), engine({ schoolSlug: "sjsu" }), ctx);
    expect(p.pages).toEqual(["grads/sjsu"]);
  });

  it("a custom session school (no page) places nothing and does not fall back to text", () => {
    const p = resolvePhoto(photo({ title: "UC Berkeley grad" }), engine({ schoolSlug: "uc-law-sf" }), ctx);
    expect(p.school).toBeNull();
    expect(p.schoolNote).toMatch(/no school page/);
  });

  it("flags engine grads sessions with no school even when the text matched", () => {
    const p = resolvePhoto(photo({ title: "UC Berkeley grad" }), engine({ schoolSlug: null }), ctx);
    expect(p.school).toBe("uc-berkeley");
    expect(p.sessionSchoolMissing).toBe(true);
  });

  it("never uses the shooting location as the school", () => {
    const p = resolvePhoto(photo({ title: "Graduate at Legion of Honor", location: "Legion of Honor" }), null, ctx);
    expect(p.school).toBeNull();
    expect(p.pages).toEqual([]); // grads photos never go to couples/family guides
  });

  it("only grads photos get a school", () => {
    const p = resolvePhoto(photo({ category: "couples", title: "SJSU sweethearts" }), null, ctx);
    expect(p.school).toBeNull();
  });
});

describe("resolvePhoto — place and guides", () => {
  it("a couples photo tagged with a guide's place reaches that guide", () => {
    const p = resolvePhoto(photo({ category: "couples", location: "Palace of Fine Arts" }), null, ctx);
    expect(p.placeKey).toBe("palace-of-fine-arts");
    expect(p.pages).toEqual(["couples/palace-of-fine-arts"]);
  });

  it("family photos go to the family guide, from a legacy session label", () => {
    const p = resolvePhoto(photo({ category: "families", sessionLabel: "Redwood Grove Preserve" }), null, ctx);
    expect(p.pages).toEqual(["family/redwood-grove-nature-preserve"]);
  });

  it("engine photos use the session's location and service, and database guide slugs", () => {
    const p = resolvePhoto(
      photo({ category: "couples" }),
      engine({ serviceType: "couples", schoolSlug: null, primaryLocation: "Shark Fin Cove" }),
      ctx,
    );
    expect(p.pages).toEqual(["couples/shark-fin-cove-santa-cruz"]);
  });

  it("a place without a guide of that type places nothing", () => {
    const p = resolvePhoto(photo({ category: "couples", location: "Montalvo Arts Center" }), null, ctx);
    expect(p.placeKey).toBe("montalvo-arts-center");
    expect(p.pages).toEqual([]);
  });
});

describe("resolvePhoto — publication safety", () => {
  it("a session without marketing permission places nothing", () => {
    const p = resolvePhoto(photo(), engine({ publishable: false }), ctx);
    expect(p.eligible).toBe(false);
    expect(p.pages).toEqual([]);
  });

  it("a photo excluded in the Content Engine places nothing", () => {
    const p = resolvePhoto(photo(), engine({ excluded: true }), ctx);
    expect(p.ineligibleReason).toMatch(/excluded/);
    expect(p.pages).toEqual([]);
  });
});

describe("indexEngineSources", () => {
  it("links portfolio rows by derivative URL, then by content hash", () => {
    const find = indexEngineSources([engine({ url: "u1", contentHash: "h1" })]);
    expect(find({ url: "u1", contentHash: null })?.sessionId).toBe("s1");
    expect(find({ url: "other", contentHash: "h1" })?.sessionId).toBe("s1");
    expect(find({ url: "other", contentHash: null })).toBeNull();
  });
});

describe("page keys", () => {
  it("map to the public URLs", () => {
    expect(pagePath("grads/sjsu")).toBe("/grads/sjsu");
    expect(pagePath("couples/palace-of-fine-arts")).toBe("/couples-guide/locations/palace-of-fine-arts");
    expect(parsePageKey("blog/x")).toBeNull();
  });
});
