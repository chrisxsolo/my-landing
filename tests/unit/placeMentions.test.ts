import { describe, expect, it } from "vitest";
import { unsupportedPlaceMentions } from "@/lib/contentEngine/placeMentions";
import { KNOWN_PLACES } from "@/lib/locations/places";

const usf = { locations: ["University of San Francisco"], schoolNames: ["University of San Francisco", "USF"] };

describe("journal posts name only the session's own places", () => {
  it("flags a nearby place the session was not photographed at", () => {
    const body = "After Lone Mountain, Haight-Ashbury is a great add-on for more urban portraits.";
    expect(unsupportedPlaceMentions([body], usf, KNOWN_PLACES)).toEqual(["Haight-Ashbury"]);
  });

  it("allows places recorded on the session, however they were written", () => {
    const body = "We finished at the Palace of Fine Arts as the light dropped.";
    const resolved = { ...usf, locations: ["USF", "Palace of Fine Arts, San Francisco"] };
    const combined = { ...usf, locations: ["USF and Palace of Fine Arts"] };
    expect(unsupportedPlaceMentions([body], resolved, KNOWN_PLACES)).toEqual([]);
    expect(unsupportedPlaceMentions([body], combined, KNOWN_PLACES)).toEqual([]);
  });

  it("matches aliases on word boundaries only", () => {
    expect(unsupportedPlaceMentions(["Portraits in The Haight"], usf, KNOWN_PLACES)).toEqual(["Haight-Ashbury"]);
    expect(unsupportedPlaceMentions(["A haighty mood on campus"], usf, KNOWN_PLACES)).toEqual([]);
  });

  it("ignores link text, which is validated separately", () => {
    const body = "Planning a shoot? See [Maya's Palace of Fine Arts session](/blog/maya-palace) for ideas.";
    expect(unsupportedPlaceMentions([body], usf, KNOWN_PLACES)).toEqual([]);
  });

  it("allows the graduate's school when the school is itself a known place", () => {
    const berkeley = { key: "uc-berkeley", name: "UC Berkeley", aliases: ["Cal"] } as (typeof KNOWN_PLACES)[number];
    const places = [...KNOWN_PLACES, berkeley];
    const ctx = { locations: ["Sather Gate"], schoolNames: ["UC Berkeley", "Cal"] };
    expect(unsupportedPlaceMentions(["Congrats from UC Berkeley!"], ctx, places)).toEqual([]);
  });
});
