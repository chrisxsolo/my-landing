import { describe, expect, it } from "vitest";
import type { LocationSpot } from "@/lib/gradGuideData";
import { matchEvidence, planFill, type AutoRow, type FillCandidate, type SpotSlot } from "@/lib/campusSpotFill/match";
import { applyAutoPhotos, campusSpotSlots, eligibleUrlsBySchool, fillCandidates } from "@/lib/campusSpotFill/pageSpots";
import type { PhotoPool, SpotTag } from "@/lib/pagePhotos/pool";
import { resolvePhoto, type PortfolioSource } from "@/lib/pagePhotos/resolve";

const url = (n: number | string) => `https://x.supabase.co/storage/v1/object/public/grad-photos/${n}.jpg`;

function portfolio(id: number, title: string, overrides: Partial<PortfolioSource> = {}): PortfolioSource {
  return {
    id, url: url(id), title, alt: title, category: "grads", featured: false, sortOrder: id,
    width: 1000, height: 1500, contentHash: null, school: null, location: null, sessionLabel: null, ...overrides,
  };
}

function poolOf(photos: PortfolioSource[], extra: Partial<PhotoPool> = {}): PhotoPool {
  return {
    photos: photos.map((p) => resolvePhoto(p, null, { places: [], dbGuides: [] })),
    explicitSchool: [], sessionSchool: [], curation: [], spotTags: [], errors: [], ...extra,
  };
}

function slot(schoolSlug: string, spotKey: string, shownUrl: string | null = null): SpotSlot {
  return { schoolSlug, spotKey, name: spotKey, shownUrl };
}

function candidate(n: number, overrides: Partial<FillCandidate> = {}): FillCandidate {
  return {
    url: url(n), schoolSlug: "sjsu", text: `SJSU grad ${n}`, width: 1000, height: 1500, quality: 8,
    featured: false, order: n, placeKey: null, tag: null, sessionLocations: [], ...overrides,
  };
}

const tag = (n: number, spotKey: string, schoolSlug = "sjsu"): SpotTag =>
  ({ schoolSlug, imageUrl: url(n), spotKey, isFeatured: false, position: n });

function spot(id: number, schoolId: string, name: string, image: string | null, extra: Partial<LocationSpot> = {}): LocationSpot {
  return {
    id, school_id: schoolId, school_name: schoolId, school_short: schoolId, name,
    description: "kept", tip: "kept", icon: "📍", image_url: image, order: id, ...extra,
  };
}

describe("campus spot fill: existing photos always win", () => {
  it("never plans a spot that already shows a photo, even with a better tagged match", () => {
    const plan = planFill([slot("sjsu", "seventh-street-palms", url("chosen"))],
      [candidate(1, { tag: { spotKey: "seventh-street-palms", featured: true }, quality: 10 })], []);
    expect(plan.claim).toEqual([]);
    expect(plan.unmatched).toEqual([]);
  });

  it("leaves a spot's chosen photo, text and every other field untouched on the page", () => {
    const palms = spot(14, "sjsu", "7th Street Palm Trees", url("chosen"));
    const rows: AutoRow[] = [{ schoolSlug: "sjsu", spotKey: "seventh-street-palms", imageUrl: url(1), evidence: "tag" }];
    const [shown] = applyAutoPhotos([palms], rows, new Map([["sjsu", new Set([url(1)])]]));
    expect(shown).toBe(palms);
  });

  it("releases an automatic pick once the spot gets a chosen photo", () => {
    const row: AutoRow = { schoolSlug: "sjsu", spotKey: "tower-hall-lawn", imageUrl: url(1), evidence: "text" };
    const plan = planFill([slot("sjsu", "tower-hall-lawn", url("chosen"))], [candidate(1)], [row]);
    expect(plan.release).toEqual([{ row, reason: "the spot now shows a chosen photo" }]);
  });
});

describe("campus spot fill: missing photos", () => {
  it("fills an empty spot from a Portfolio photo of the same school that names it", () => {
    const pool = poolOf([portfolio(26, "First-Generation SJSU Graduate Portrait at Tower Hall")]);
    const plan = planFill([slot("sjsu", "tower-hall-lawn")], fillCandidates(pool, "sjsu"), []);
    expect(plan.claim).toEqual([{
      schoolSlug: "sjsu", spotKey: "tower-hall-lawn", imageUrl: url(26), evidence: "text",
      detail: "photo text names tower-hall-lawn",
    }]);
  });

  it("shows the automatic photo only on the empty spot, keeping the spot's own text", () => {
    const empty = spot(30, "sjsu", "Tower Lawn Steps", null);
    const rows: AutoRow[] = [{ schoolSlug: "sjsu", spotKey: "tower-hall-steps", imageUrl: url(5), evidence: "text" }];
    const [shown] = applyAutoPhotos([empty], rows, new Map([["sjsu", new Set([url(5)])]]));
    expect(shown).toEqual({ ...empty, image_url: url(5) });
  });

  it("leaves a spot empty when no photo is proven to show it", () => {
    const plan = planFill([slot("usf", "lone-mountain-stairs")], [
      candidate(38, { schoolSlug: "usf", text: "USF Nursing Grad Sunset Portrait on Lyon Street Steps" }),
      candidate(10, { schoolSlug: "usf", text: "Golden Hour USF Graduation Portrait on Campus" }),
    ], []);
    expect(plan.claim).toEqual([]);
    expect(plan.unmatched[0].reason).toMatch(/no public photo/);
  });

  it("does not guess when a photo's text names two spots", () => {
    expect(matchEvidence(slot("uc-berkeley", "doe-library-ledge"),
      candidate(1, { schoolSlug: "uc-berkeley", text: "UC Berkeley grad at Doe Library" }))).toBeNull();
  });
});

describe("campus spot fill: one photo per spot, best first", () => {
  const empty = [slot("sjsu", "seventh-street-palms"), slot("sjsu", "tower-hall-lawn")];

  it("prefers a photographer tag over text, then quality, then portrait orientation", () => {
    const plan = planFill([empty[0]], [
      candidate(1, { text: "SJSU palm path", quality: 10 }),
      candidate(2, { text: "SJSU grad", tag: { spotKey: "seventh-street-palms", featured: false }, quality: 6 }),
    ], []);
    expect(plan.claim.map((c) => [c.imageUrl, c.evidence])).toEqual([[url(2), "tag"]]);

    const byQuality = planFill([empty[0]], [
      candidate(3, { text: "SJSU palm path", quality: 7 }),
      candidate(4, { text: "SJSU palm path", quality: 9, width: 1500, height: 1000 }),
      candidate(5, { text: "SJSU palm path", quality: 9 }),
    ], []);
    expect(byQuality.claim.map((c) => c.imageUrl)).toEqual([url(5)]);
  });

  it("never uses one photo for two spots or a photo the page already shows", () => {
    const plan = planFill([...empty, slot("sjsu", "sjsu-sign", url(9))], [
      candidate(9, { text: "SJSU palm path" }),
      candidate(1, { text: "SJSU palm path at Tower Hall lawn" }),
      candidate(2, { text: "SJSU at Tower Hall" }),
    ], []);
    expect(plan.claim.map((c) => [c.spotKey, c.imageUrl])).toEqual([["tower-hall-lawn", url(2)]]);
    expect(plan.unmatched.map((u) => u.slot.spotKey)).toEqual(["seventh-street-palms"]);
  });
});

describe("campus spot fill: the school must be confirmed first", () => {
  it("a UC Berkeley photo never fills an SJSU spot, whatever its text says", () => {
    const pool = poolOf([portfolio(1, "UC Berkeley grad by a Tower Hall style building")]);
    expect(fillCandidates(pool, "sjsu")).toEqual([]);
    expect(fillCandidates(pool, "uc-berkeley").map((c) => c.url)).toEqual([url(1)]);
    expect(matchEvidence(slot("sjsu", "tower-hall-lawn"), candidate(1, { schoolSlug: "uc-berkeley", text: "Tower Hall" }))).toBeNull();
  });

  it("a photo tagged with another spot never matches by text", () => {
    expect(matchEvidence(slot("sjsu", "tower-hall-lawn"),
      candidate(1, { text: "SJSU at Tower Hall", tag: { spotKey: "sjsu-sign", featured: false } }))).toBeNull();
  });

  it("uses a session's single typed location unless the photo's own text names another spot", () => {
    const fromSession = candidate(1, { sessionLocations: ["Tower Hall"] });
    expect(matchEvidence(slot("sjsu", "tower-hall-lawn"), fromSession)?.evidence).toBe("session");
    expect(matchEvidence(slot("sjsu", "tower-hall-lawn"),
      { ...fromSession, text: "SJSU grad on the palm path" })).toBeNull();
  });

  it("hidden photos are not candidates", () => {
    const pool = poolOf([portfolio(1, "SJSU at Tower Hall")], {
      curation: [{ pageKey: "grads/sjsu", imageUrl: url(1), mode: "hide", position: 0, isHero: false }],
    });
    expect(fillCandidates(pool, "sjsu")).toEqual([]);
  });
});

describe("campus spot fill: idempotent and safe across changes", () => {
  it("running again on its own result keeps everything and claims nothing", () => {
    const slots = [slot("sjsu", "tower-hall-lawn"), slot("sjsu", "seventh-street-palms")];
    const cands = [candidate(1, { text: "SJSU at Tower Hall" }), candidate(2, { text: "SJSU palm path" })];
    const first = planFill(slots, cands, []);
    expect(first.claim).toHaveLength(2);
    const second = planFill(slots, [...cands, candidate(3, { text: "SJSU at Tower Hall", quality: 10 })], first.claim);
    expect(second.claim).toEqual([]);
    expect(second.release).toEqual([]);
    expect(second.keep.map((r) => r.imageUrl)).toEqual([url(1), url(2)]);
  });

  it("drops a pick whose photo stopped being public and refills the spot in the same run", () => {
    const row: AutoRow = { schoolSlug: "sjsu", spotKey: "tower-hall-lawn", imageUrl: url(1), evidence: "text" };
    const plan = planFill([slot("sjsu", "tower-hall-lawn")], [candidate(2, { text: "SJSU at Tower Hall" })], [row]);
    expect(plan.release.map((r) => r.reason)).toEqual(["the photo is no longer public for this school"]);
    expect(plan.claim.map((c) => c.imageUrl)).toEqual([url(2)]);
  });

  it("drops a pick the photographer tagged with a different spot", () => {
    const row: AutoRow = { schoolSlug: "sjsu", spotKey: "tower-hall-lawn", imageUrl: url(1), evidence: "text" };
    const plan = planFill([slot("sjsu", "tower-hall-lawn")],
      [candidate(1, { tag: { spotKey: "sjsu-sign", featured: false } })], [row]);
    expect(plan.release[0].reason).toBe("the photographer tagged it sjsu-sign");
  });

  it("never renders a pick that is no longer eligible, so no broken or private photo shows", () => {
    const empty = spot(30, "sjsu", "Tower Lawn Steps", null);
    const rows: AutoRow[] = [{ schoolSlug: "sjsu", spotKey: "tower-hall-steps", imageUrl: url(5), evidence: "text" }];
    const pool = poolOf([portfolio(6, "SJSU at Tower Hall")], { spotTags: [tag(6, "tower-hall-lawn")] });
    const [shown] = applyAutoPhotos([empty], rows, eligibleUrlsBySchool(pool));
    expect(shown.image_url).toBeNull();
  });
});

describe("campus spot slots", () => {
  it("maps location_spots rows by name and guide spots by key; spots with no definition are skipped", () => {
    const slots = campusSpotSlots([
      spot(3, "sjsu", "The SJSU Sign Wall\n", url(1)),
      spot(11, "csueb", "East Bay Sign", url(2)),
      spot(1_000_002, "usf", "Los Lobos de Loyola Wolf Sculpture", null, { spot_key: "los-lobos-de-loyola" }),
    ]);
    expect(slots).toEqual([
      { schoolSlug: "sjsu", spotKey: "sjsu-sign", name: "The SJSU Sign Wall", shownUrl: url(1) },
      { schoolSlug: "usf", spotKey: "los-lobos-de-loyola", name: "Los Lobos de Loyola Wolf Sculpture", shownUrl: null },
    ]);
  });
});
