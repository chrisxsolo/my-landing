import { describe, expect, it } from "vitest";
import type { PageCandidate } from "@/lib/pagePhotos/curate";
import { candidatesForPage } from "@/lib/pagePhotos/candidates";
import { sessionSchoolPhotos, type EngineSchoolRow, type PhotoPool, type SpotTag } from "@/lib/pagePhotos/pool";
import type { EngineSource, PortfolioSource } from "@/lib/pagePhotos/resolve";
import { buildSpotPhotoLayout, campusSpotNameKey, SPOT_SECTION_LIMIT, type SpotPhotoInput } from "@/lib/pagePhotos/spotPhotos";

const url = (n: number | string) => `https://x.supabase.co/storage/v1/object/public/grad-photos/${n}.jpg`;

function cand(n: number, overrides: Partial<PageCandidate> = {}): PageCandidate {
  return {
    id: `portfolio:${n}`, url: url(n), alt: `photo ${n}`, caption: null, width: 4000, height: 6000,
    explicit: false, explicitOrder: 0, featured: false, quality: 8, sortOrder: n, sessionKey: `s${n}`, ...overrides,
  };
}

function tag(n: number, spotKey: string, overrides: Partial<SpotTag> = {}): SpotTag {
  return { schoolSlug: "sjsu", imageUrl: url(n), spotKey, isFeatured: false, position: n, ...overrides };
}

function input(overrides: Partial<SpotPhotoInput> = {}): SpotPhotoInput {
  return {
    spotKeys: ["sjsu-sign", "tower-hall-lawn"],
    eligible: [1, 2, 3, 4, 5, 6].map((n) => cand(n)),
    hiddenUrls: new Set(), heroUrl: null, tags: [], fallbacks: {}, ...overrides,
  };
}

describe("buildSpotPhotoLayout", () => {
  it("puts only photographer-tagged photos in a spot section, featured first", () => {
    const layout = buildSpotPhotoLayout(input({
      tags: [tag(2, "sjsu-sign"), tag(3, "sjsu-sign", { isFeatured: true }), tag(4, "tower-hall-lawn")],
    }));
    expect(layout.bySpot["sjsu-sign"].map((p) => p.url)).toEqual([url(3), url(2)]);
    expect(layout.bySpot["tower-hall-lawn"].map((p) => p.url)).toEqual([url(4)]);
  });

  it("never shows a tagged photo that is not eligible for the page (unpublished, rejected, hidden)", () => {
    const layout = buildSpotPhotoLayout(input({ tags: [tag(99, "sjsu-sign", { isFeatured: true })] }));
    expect(layout.bySpot["sjsu-sign"]).toEqual([]);
  });

  it("caps each section and keeps the rest in the gallery without duplicates", () => {
    const tags = [1, 2, 3, 4].map((n) => tag(n, "sjsu-sign"));
    const layout = buildSpotPhotoLayout(input({ tags, heroUrl: url(6) }));
    expect(layout.bySpot["sjsu-sign"]).toHaveLength(SPOT_SECTION_LIMIT);
    const shown = [url(6), ...layout.bySpot["sjsu-sign"].map((p) => p.url), ...layout.gallery.map((c) => c.url)];
    expect(new Set(shown).size).toBe(shown.length);
    expect(layout.gallery.map((c) => c.url)).toEqual([url(4), url(5)]);
  });

  it("skips the hero inside spot sections", () => {
    const layout = buildSpotPhotoLayout(input({ tags: [tag(1, "sjsu-sign", { isFeatured: true }), tag(2, "sjsu-sign")], heroUrl: url(1) }));
    expect(layout.bySpot["sjsu-sign"].map((p) => p.url)).toEqual([url(2)]);
  });

  it("falls back to the campus-spots photo only when nothing is tagged and it isn't hidden", () => {
    const fallbacks = { "sjsu-sign": { url: url("sign"), alt: "SJSU sign" }, "tower-hall-lawn": { url: url("lawn"), alt: "lawn" } };
    const layout = buildSpotPhotoLayout(input({
      fallbacks, tags: [tag(2, "tower-hall-lawn")], hiddenUrls: new Set([url("sign")]),
    }));
    expect(layout.bySpot["sjsu-sign"]).toEqual([]);
    expect(layout.bySpot["tower-hall-lawn"].map((p) => p.url)).toEqual([url(2)]);

    const open = buildSpotPhotoLayout(input({ fallbacks }));
    expect(open.bySpot["sjsu-sign"][0]).toMatchObject({ url: url("sign"), source: "campus-spot" });
  });

  it("normalizes campus-spot names stored with stray whitespace", () => {
    expect(campusSpotNameKey("The SJSU Sign Wall\n")).toBe(campusSpotNameKey("the sjsu  sign wall"));
  });
});

function engine(overrides: Partial<EngineSource> = {}): EngineSource {
  return {
    url: url("e1"), contentHash: "h1", sessionId: "sess", sessionName: "Maya", serviceType: "grads",
    schoolSlug: "sjsu", primaryLocation: null, publishable: true, excluded: false,
    quality: 8, width: 4000, height: 6000, ...overrides,
  };
}

const row = (overrides: Partial<EngineSource> = {}, id = "p1"): EngineSchoolRow => {
  const source = engine(overrides);
  return { id, url: source.url, alt: "SJSU grad at Tower Hall", source };
};

describe("sessionSchoolPhotos (Content Engine photos live in a journal post)", () => {
  const live = new Set([url("e1")]);

  it("adds an approved, live, publishable SJSU session photo to the SJSU page", () => {
    const [photo] = sessionSchoolPhotos([row()], live, []);
    expect(photo).toMatchObject({ schoolSlug: "sjsu", url: url("e1"), sessionKey: "session:sess" });
  });

  it.each([
    ["excluded in the engine", { excluded: true }],
    ["no marketing permission", { publishable: false }],
    ["not a grads session", { serviceType: "families" }],
    ["session school has no page", { schoolSlug: "uc-law-sf" }],
    ["no school on the session", { schoolSlug: null }],
  ] as [string, Partial<EngineSource>][])("skips a photo when %s", (_label, overrides) => {
    expect(sessionSchoolPhotos([row(overrides)], live, [])).toEqual([]);
  });

  it("skips a photo no longer in any live journal post", () => {
    expect(sessionSchoolPhotos([row()], new Set(), [])).toEqual([]);
  });

  it("does not duplicate a photo already in the portfolio (by URL or original hash)", () => {
    const portfolio = { url: url("other"), contentHash: "h1" } as PortfolioSource;
    expect(sessionSchoolPhotos([row()], live, [portfolio])).toEqual([]);
  });
});

describe("candidatesForPage with session photos", () => {
  const pool: PhotoPool = {
    photos: [], explicitSchool: [], curation: [], spotTags: [], errors: [],
    sessionSchool: sessionSchoolPhotos([row(), row({ url: url("e2"), schoolSlug: "stanford" }, "p2")], new Set([url("e1"), url("e2")]), []),
  };

  it("offers them as automatic matches only on their own school page", () => {
    expect(candidatesForPage(pool, "grads/sjsu").map((c) => [c.url, c.explicit])).toEqual([[url("e1"), false]]);
    expect(candidatesForPage(pool, "couples/palace-of-fine-arts")).toEqual([]);
  });
});
