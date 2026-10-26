import { describe, expect, it } from "vitest";
import { curatePage, roundRobinBySession, type CurationRow, type PageCandidate } from "@/lib/pagePhotos/curate";

function c(url: string, overrides: Partial<PageCandidate> = {}): PageCandidate {
  return {
    id: url, url, alt: url, caption: null, width: 4000, height: 6000,
    explicit: false, explicitOrder: 0, featured: false, quality: 7, sortOrder: 0,
    sessionKey: "s1", ...overrides,
  };
}

function rule(imageUrl: string, mode: "pin" | "hide", position = 0, isHero = false): CurationRow {
  return { pageKey: "grads/sjsu", imageUrl, mode, position, isHero };
}

const urls = (list: PageCandidate[]) => list.map((x) => x.url);

describe("curatePage", () => {
  it("drops photos hidden on this page", () => {
    const out = curatePage([c("a"), c("b")], [rule("a", "hide")], { limit: 10 });
    expect(urls(out.ordered)).toEqual(["b"]);
    expect(urls(out.hidden)).toEqual(["a"]);
  });

  it("puts the hero pin first, then pins in order, then explicit, then automatic", () => {
    const out = curatePage(
      [c("auto"), c("own", { explicit: true }), c("p2"), c("p1"), c("hero")],
      [rule("p1", "pin", 1), rule("p2", "pin", 2), rule("hero", "pin", 9, true)],
      { limit: 10, preferPortraitHero: true },
    );
    expect(urls(out.ordered)).toEqual(["hero", "p1", "p2", "own", "auto"]);
    expect(out.heroPinned).toBe(true);
  });

  it("ignores curation for photos that are not eligible (a pin never publishes)", () => {
    const out = curatePage([c("a")], [rule("not-public", "pin", 1, true)], { limit: 10 });
    expect(urls(out.ordered)).toEqual(["a"]);
  });

  it("dedupes by URL, keeping the explicit placement", () => {
    const out = curatePage([c("a"), c("a", { explicit: true, caption: "mine" })], [], { limit: 10 });
    expect(out.ordered).toHaveLength(1);
    expect(out.ordered[0].caption).toBe("mine");
  });

  it("caps the page and reports the overflow", () => {
    const out = curatePage([c("a"), c("b"), c("c")], [], { limit: 2 });
    expect(out.ordered).toHaveLength(2);
    expect(out.overflow).toHaveLength(1);
  });

  it("prefers a portrait frame as the automatic hero, but never jumps a pin", () => {
    const wide = { width: 6000, height: 4000 };
    const auto = curatePage([c("land", { ...wide, quality: 10 }), c("tall", { quality: 5, sessionKey: "s2" })], [], {
      limit: 5, preferPortraitHero: true,
    });
    expect(auto.ordered[0].url).toBe("tall");
    const pinned = curatePage([c("land", wide), c("tall")], [rule("land", "pin", 1)], { limit: 5, preferPortraitHero: true });
    expect(pinned.ordered[0].url).toBe("land");
  });

  it("keeps the guide's own order when portrait preference is off", () => {
    const out = curatePage([c("w", { width: 6000, height: 4000, explicit: true }), c("t", { explicit: true, explicitOrder: 1 })], [], { limit: 5 });
    expect(urls(out.ordered)).toEqual(["w", "t"]);
  });

  it("is deterministic — running it twice gives the same page", () => {
    const input = [c("a", { sessionKey: "x" }), c("b", { sessionKey: "y" }), c("c", { sessionKey: "x" })];
    expect(urls(curatePage(input, [], { limit: 10 }).ordered)).toEqual(urls(curatePage(input, [], { limit: 10 }).ordered));
  });
});

describe("roundRobinBySession", () => {
  it("spreads one big session across the page instead of front-loading it", () => {
    const big = ["b1", "b2", "b3", "b4"].map((u, i) => c(u, { sessionKey: "big", quality: 9 - i }));
    const small = [c("s1", { sessionKey: "small", quality: 8 })];
    expect(urls(roundRobinBySession([...big, ...small]))).toEqual(["b1", "s1", "b2", "b3", "b4"]);
  });

  it("ranks featured, then quality, within a session", () => {
    const out = roundRobinBySession([c("low", { quality: 5 }), c("feat", { featured: true, quality: 4 }), c("high", { quality: 9 })]);
    expect(urls(out)).toEqual(["feat", "high", "low"]);
  });
});

describe("curatePage — mixPlacements (school pages)", () => {
  it("spreads one session's placements across the page instead of stacking them first", () => {
    const kim = ["k1", "k2", "k3"].map((u, i) => c(u, { explicit: true, explicitOrder: i, sessionKey: "kim", quality: 9 }));
    const others = [c("o1", { sessionKey: "o1", quality: 8 }), c("o2", { sessionKey: "o2", quality: 7 })];
    const out = curatePage([...kim, ...others], [], { limit: 10, mixPlacements: true });
    expect(urls(out.ordered)).toEqual(["k1", "o1", "o2", "k2", "k3"]);
  });

  it("still lets a placement lead its own session", () => {
    const out = curatePage([c("auto", { quality: 10 }), c("placed", { explicit: true, quality: 5 })], [], { limit: 5, mixPlacements: true });
    expect(urls(out.ordered)).toEqual(["placed", "auto"]);
  });
});
