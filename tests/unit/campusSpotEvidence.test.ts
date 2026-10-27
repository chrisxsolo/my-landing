// Campus-spot fill: which evidence may place a photo at a spot, and how
// earlier automatic picks follow metadata changes. Photo-level evidence wins
// over session-level context: spot tag > the photo's own confirmed location
// (manual / GPS-matched) > its GPS inside the spot's place > session or text.
import { describe, expect, it } from "vitest";
import { matchEvidence, planFill, type AutoRow, type FillCandidate, type SpotSlot } from "@/lib/campusSpotFill/match";

const url = (n: number | string) => `https://x.supabase.co/storage/v1/object/public/grad-photos/${n}.jpg`;

function slot(schoolSlug: string, spotKey: string, shownUrl: string | null = null): SpotSlot {
  return { schoolSlug, spotKey, name: spotKey, shownUrl };
}

function candidate(n: number, overrides: Partial<FillCandidate> = {}): FillCandidate {
  return {
    url: url(n), schoolSlug: "sjsu", text: `SJSU grad ${n}`, width: 1000, height: 1500, quality: 8,
    featured: false, order: n, placeKey: null, tag: null, sessionLocations: [], fromSession: false,
    photoLocation: null, gpsPlace: null, ...overrides,
  };
}

const manual = (text: string, placeKey: string | null = null) => ({ text, source: "manual" as const, placeKey });
const palace = { key: "palace-of-fine-arts", name: "Palace of Fine Arts" };
const legion = { key: "legion-of-honor", name: "Legion of Honor" };
const towerLawn = slot("sjsu", "tower-hall-lawn");

describe("campus spot evidence: a multi-location session never places every photo", () => {
  it("ignores the session's locations when it has more than one", () => {
    const photo = candidate(1, { fromSession: true, sessionLocations: ["Tower Hall", "7th Street palms"] });
    expect(matchEvidence(towerLawn, photo)).toBeNull();
  });

  it("does not trust the photo's text inside a multi-location session either", () => {
    const photo = candidate(1, {
      fromSession: true, sessionLocations: ["Tower Hall", "Palace of Fine Arts"], text: "SJSU grad at Tower Hall",
    });
    expect(matchEvidence(towerLawn, photo)).toBeNull();
  });

  it("does not trust text from a session whose location was never entered", () => {
    expect(matchEvidence(towerLawn, candidate(1, { fromSession: true, text: "SJSU grad at Tower Hall" }))).toBeNull();
  });

  it("still uses text for an older Portfolio photo with no session", () => {
    expect(matchEvidence(towerLawn, candidate(1, { text: "SJSU grad at Tower Hall" }))?.evidence).toBe("text");
  });
});

describe("campus spot evidence: the photo's own location wins over its session", () => {
  const multi = { fromSession: true, sessionLocations: ["7th Street palms", "Tower Hall"] };

  it("places a photo of a multi-location session by its confirmed photo location", () => {
    const photo = candidate(1, { ...multi, photoLocation: manual("Tower Hall") });
    expect(matchEvidence(towerLawn, photo)).toMatchObject({ evidence: "place", detail: 'photo location "Tower Hall" (manual)' });
    expect(matchEvidence(slot("sjsu", "seventh-street-palms"), photo)).toBeNull();
  });

  it("a confirmed photo location elsewhere overrules a single session location", () => {
    const photo = candidate(1, { fromSession: true, sessionLocations: ["Tower Hall"], photoLocation: manual("Rose Garden") });
    expect(matchEvidence(towerLawn, photo)).toBeNull();
  });

  it("a photo location that only names the campus does not contradict the session", () => {
    const photo = candidate(1, { fromSession: true, sessionLocations: ["Tower Hall"], photoLocation: manual("San Jose State University") });
    expect(matchEvidence(towerLawn, photo)?.evidence).toBe("session");
  });

  it("matches an off-campus spot by the photo's own GPS, and GPS elsewhere vetoes the session", () => {
    const sfState = { schoolSlug: "sf-state", text: "SF State grad" };
    const atPalace = candidate(1, { ...sfState, gpsPlace: palace });
    expect(matchEvidence(slot("sf-state", "palace-of-fine-arts"), atPalace))
      .toMatchObject({ evidence: "place", detail: "photo GPS is at Palace of Fine Arts" });
    const gpsElsewhere = candidate(2, { ...sfState, fromSession: true, sessionLocations: ["Palace of Fine Arts"], gpsPlace: legion });
    expect(matchEvidence(slot("sf-state", "palace-of-fine-arts"), gpsElsewhere)).toBeNull();
  });

  it("ranks photo location over session over text when several photos qualify", () => {
    const plan = planFill([towerLawn], [
      candidate(1, { text: "SJSU grad at Tower Hall", quality: 10 }),
      candidate(2, { fromSession: true, sessionLocations: ["Tower Hall"], quality: 9 }),
      candidate(3, { ...multi, photoLocation: manual("Tower Hall"), quality: 6 }),
    ], []);
    expect(plan.claim.map((c) => c.imageUrl)).toEqual([url(3)]);
  });
});

describe("campus spot fill: earlier automatic picks follow metadata changes", () => {
  const row = (n: number, evidence: AutoRow["evidence"], spotKey = "tower-hall-lawn"): AutoRow =>
    ({ schoolSlug: "sjsu", spotKey, imageUrl: url(n), evidence });

  it("releases a pick whose session location changed, and re-plans the spot", () => {
    const moved = candidate(1, { fromSession: true, sessionLocations: ["7th Street palms"] });
    const plan = planFill([towerLawn], [moved, candidate(2, { text: "SJSU at Tower Hall" })], [row(1, "session")]);
    expect(plan.release.map((r) => r.reason)).toEqual(["its location evidence no longer holds"]);
    expect(plan.claim.map((c) => c.imageUrl)).toEqual([url(2)]);
  });

  it("releases a pick once its location tag is removed", () => {
    const untagged = candidate(1, { text: "SJSU grad" });
    expect(planFill([towerLawn], [untagged], [row(1, "tag")]).release.map((r) => r.reason))
      .toEqual(["its location evidence no longer holds"]);
  });

  it("a photo tagged for the spot replaces an automatic pick, and the result is stable", () => {
    const cands = [candidate(1, { text: "SJSU at Tower Hall" }), candidate(2, { tag: { spotKey: "tower-hall-lawn", featured: false } })];
    const plan = planFill([towerLawn], cands, [row(1, "text")]);
    expect(plan.release.map((r) => r.reason)).toEqual(["a photo tagged for this spot replaces it"]);
    expect(plan.claim.map((c) => [c.imageUrl, c.evidence])).toEqual([[url(2), "tag"]]);
    const again = planFill([towerLawn], cands, plan.claim);
    expect([again.release, again.claim]).toEqual([[], []]);
  });

  it("keeps the pick when the tagged photo is already shown at another spot (no flapping)", () => {
    const plan = planFill([towerLawn, slot("sjsu", "sjsu-sign", url(2))],
      [candidate(1, { text: "SJSU at Tower Hall" }), candidate(2, { tag: { spotKey: "tower-hall-lawn", featured: false } })],
      [row(1, "text")]);
    expect(plan.release).toEqual([]);
    expect(plan.keep.map((r) => r.imageUrl)).toEqual([url(1)]);
  });

  it("releases a pick the page now shows at another spot, so no photo appears twice", () => {
    const plan = planFill([towerLawn, slot("sjsu", "sjsu-sign", url(1))], [candidate(1, { text: "SJSU at Tower Hall" })], [row(1, "text")]);
    expect(plan.release.map((r) => r.reason)).toEqual(["the page already shows this photo at another spot"]);
    expect(plan.claim).toEqual([]);
  });
});
