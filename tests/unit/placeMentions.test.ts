import { describe, expect, it } from "vitest";
import {
  describePlaceIssues, findPlaceIssues, placeContextFor, type SessionPlaceContext,
} from "@/lib/contentEngine/placeMentions";
import { KNOWN_PLACES } from "@/lib/locations/places";

const usf = { locations: ["University of San Francisco"], schoolNames: ["University of San Francisco", "USF"] };
const legion = { locations: ["Legion of Honor"], schoolNames: [] };

const named = (texts: string[], ctx: SessionPlaceContext, places = KNOWN_PLACES) =>
  [...new Set(findPlaceIssues(texts.map((text) => ({ field: "body", text })), ctx, places).map((i) => i.place))];

describe("journal posts name only the session's own places", () => {
  it("flags a nearby place the session was not photographed at", () => {
    const body = "After Lone Mountain, Haight-Ashbury is a great add-on for more urban portraits.";
    expect(named([body], usf)).toEqual(["Haight-Ashbury"]);
  });

  it("allows places recorded on the session, however they were written", () => {
    const body = "We finished at the Palace of Fine Arts as the light dropped.";
    const resolved = { ...usf, locations: ["USF", "Palace of Fine Arts, San Francisco"] };
    const combined = { ...usf, locations: ["USF and Palace of Fine Arts"] };
    expect(named([body], resolved)).toEqual([]);
    expect(named([body], combined)).toEqual([]);
  });

  it("matches aliases on word boundaries only", () => {
    expect(named(["Portraits in The Haight"], usf)).toEqual(["Haight-Ashbury"]);
    expect(named(["A haighty mood on campus"], usf)).toEqual([]);
  });

  it("ignores link text that refers to another post or guide", () => {
    const body = "Planning a shoot? See [Maya's Palace of Fine Arts session](/blog/maya-palace) for ideas.";
    expect(named([body], usf)).toEqual([]);
  });

  it("never reads place names out of link URLs", () => {
    expect(named(["More ideas [here](/locations/sf/palace-of-fine-arts)."], legion)).toEqual([]);
  });

  it("allows the graduate's school when the school is itself a known place", () => {
    const berkeley = { key: "uc-berkeley", name: "UC Berkeley", aliases: ["Cal"] } as (typeof KNOWN_PLACES)[number];
    const places = [...KNOWN_PLACES, berkeley];
    const ctx = { locations: ["Sather Gate"], schoolNames: ["UC Berkeley", "Cal"] };
    expect(named(["Congrats from UC Berkeley!"], ctx, places)).toEqual([]);
  });
});

describe("claims versus references", () => {
  it("blocks a claim hidden in link text", () => {
    const issues = findPlaceIssues(
      [{ field: "body", text: "We shot at [Palace of Fine Arts](/blog/other-post) at sunset." }], legion, KNOWN_PLACES,
    );
    expect(issues).toEqual([expect.objectContaining({ place: "Palace of Fine Arts", claim: true })]);
  });

  it("blocks bare 'at [X](…)' link text as where the session was", () => {
    expect(named(["Golden hour light at [the Palace of Fine Arts](/blog/x) was perfect."], legion))
      .toEqual(["Palace of Fine Arts"]);
  });

  it.each([
    "We shot at the Palace of Fine Arts as the fog rolled in.",
    "Our session at Palace of Fine Arts started at noon.",
    "We explored the Palace of Fine Arts before heading home.",
    "Her grad portraits in the Palace of Fine Arts rotunda were the highlight.",
  ])("marks claim phrasing as a claim: %s", (text) => {
    const issues = findPlaceIssues([{ field: "body", text }], legion, KNOWN_PLACES);
    expect(issues.map((i) => [i.place, i.claim])).toEqual([["Palace of Fine Arts", true]]);
  });

  it.each([
    "See also: our Palace of Fine Arts guide for planning tips.",
    "Want more? Read the Palace of Fine Arts location guide.",
    "Our guide to the Palace of Fine Arts covers parking and light.",
    "Planning a session at Palace of Fine Arts? The [Palace of Fine Arts guide](/locations/sf/palace-of-fine-arts) covers the light.",
  ])("allows a reference to another place's guide: %s", (text) => {
    expect(named([text], legion)).toEqual([]);
  });

  it("allows places in a related-posts section, but not after it", () => {
    const body = [
      "We started under the Legion of Honor colonnade.",
      "",
      "## Related posts",
      "- Palace of Fine Arts golden hour with Sam",
      "- Crissy Field family session",
      "",
      "## The day",
      "Lands End was a great add-on.",
    ].join("\n");
    expect(named([body], legion)).toEqual(["Lands End"]);
  });

  it("still blocks a claim inside a related section", () => {
    const body = "**See also:**\n- We shot at the Palace of Fine Arts too.";
    expect(named([body], legion)).toEqual(["Palace of Fine Arts"]);
  });

  it("still blocks a recommendation that only mentions 'guide' elsewhere", () => {
    expect(named(["Palace of Fine Arts is great too, and our guide team loves it."], legion))
      .toEqual(["Palace of Fine Arts"]);
  });
});

describe("representative valid posts stay publishable", () => {
  it("a grad post at the session's campus and second stop, with a guide link and related posts", () => {
    const ctx = { locations: ["USF", "Palace of Fine Arts"], schoolNames: ["University of San Francisco", "USF"] };
    const title = "Golden Hour Grad Portraits at USF and the Palace of Fine Arts";
    const body = [
      "Mia's USF grad session started on Lone Mountain, where the light wraps around the towers.",
      "",
      "We finished at the Palace of Fine Arts as the light dropped over the lagoon.",
      "",
      "Planning a session at Palace of Fine Arts? The [Palace of Fine Arts guide](/locations/sf/palace-of-fine-arts) covers the light, timing, and what to expect.",
      "",
      "## Related posts",
      "- [Jordan's Legion of Honor grad portraits](/blog/jordan-legion-of-honor)",
      "- [Crissy Field sunset with the Lees](/blog/lees-crissy-field)",
    ].join("\n");
    const fields = [{ field: "title", text: title }, { field: "body", text: body }];
    expect(findPlaceIssues(fields, ctx, KNOWN_PLACES)).toEqual([]);
  });

  it("a couples post that only names its own place", () => {
    const body = "Sunset at the Legion of Honor: we walked the colonnade, then the view toward the Golden Gate.";
    expect(named([body], legion)).toEqual([]);
  });
});

describe("placeContextFor: current Session facts beat snapshots", () => {
  const snapshot = { locations: ["Palace of Fine Arts"], schoolSlug: "usf", schoolNames: ["University of San Francisco"] };

  it("uses the live session and ignores the snapshot's corrected-away location", () => {
    const ctx = placeContextFor({ locations: ["Legion of Honor"], schoolSlug: "usf", schoolNames: [] }, [], snapshot);
    expect(ctx).toEqual({ locations: ["Legion of Honor"], schoolNames: ["University of San Francisco"], source: "session" });
  });

  it("adds confirmed photo-level locations to the session's", () => {
    const ctx = placeContextFor({ locations: ["Legion of Honor"], schoolSlug: null, schoolNames: [] }, ["Lands End"], snapshot);
    expect(ctx.locations).toEqual(["Legion of Honor", "Lands End"]);
  });

  it("counts photo locations as live facts, so the snapshot stays unused", () => {
    const ctx = placeContextFor({ locations: [], schoolSlug: null, schoolNames: [] }, ["Lands End"], snapshot);
    expect(ctx).toMatchObject({ locations: ["Lands End"], source: "session" });
  });

  it("falls back to the snapshot only when the live session has no location facts", () => {
    const ctx = placeContextFor({ locations: [" "], schoolSlug: null, schoolNames: [] }, [], snapshot);
    expect(ctx).toMatchObject({ locations: ["Palace of Fine Arts"], source: "snapshot" });
  });

  it("drops the snapshot's school names when the session's school changed", () => {
    const ctx = placeContextFor({ locations: ["SJSU"], schoolSlug: "sjsu", schoolNames: ["San Jose State University"] }, [], snapshot);
    expect(ctx.schoolNames).toEqual(["San Jose State University"]);
  });
});

describe("describePlaceIssues", () => {
  it("names the place, quotes where it is, and says what to do", () => {
    const text = "Mia's session was lovely. We shot at the Palace of Fine Arts as the fog rolled in over the lagoon.";
    const ctx = { ...legion, source: "session" as const };
    const message = describePlaceIssues(findPlaceIssues([{ field: "body", text }], ctx, KNOWN_PLACES), ctx);
    expect(message).toContain('• body says the session was at Palace of Fine Arts: "');
    expect(message).toContain("We shot at the Palace of Fine Arts as the fog");
    expect(message).toContain("This session's locations: Legion of Honor.");
    expect(message).toMatch(/add the place to the Session's locations/);
    expect(message).toMatch(/remove or reword the mention/);
  });

  it("says when the snapshot fallback was used and caps the list", () => {
    const ctx = { locations: [], schoolNames: [], source: "snapshot" as const };
    const issues = Array.from({ length: 7 }, (_, n) => ({ place: `Place ${n}`, field: "body", excerpt: "x", claim: false }));
    const message = describePlaceIssues(issues, ctx);
    expect(message).toContain("…and 2 more");
    expect(message).toContain("none recorded (the Session has no location");
  });
});
