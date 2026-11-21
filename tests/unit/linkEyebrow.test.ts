// The /links card labels must describe where each card goes, whatever order
// the links are saved in.
import { describe, expect, it } from "vitest";
import { eyebrowForLink } from "@/app/links/linkEyebrow";

describe("eyebrowForLink", () => {
  it("labels the first card as the starting point", () => {
    expect(eyebrowForLink("https://www.soloxsnaps.com/contact/", 0)).toBe("Start here");
    expect(eyebrowForLink("https://soloxsnaps.com", 0)).toBe("Start here");
  });

  it("labels later cards by destination, not position", () => {
    expect(eyebrowForLink("https://soloxsnaps.com", 1)).toBe("Portfolio");
    expect(eyebrowForLink("https://www.soloxsnaps.com/availability", 2)).toBe("Calendar");
    expect(eyebrowForLink("https://www.soloxsnaps.com/pricing/grads", 3)).toBe("Pricing");
    expect(eyebrowForLink("https://www.soloxsnaps.com/grad-guide", 4)).toBe("Prep guide");
    expect(eyebrowForLink("https://www.soloxsnaps.com/contact/", 2)).toBe("Booking");
    expect(eyebrowForLink("https://www.soloxsnaps.com/portfolio/couples", 1)).toBe("Portfolio");
  });

  it("shows no label for a destination it does not know", () => {
    expect(eyebrowForLink("https://example.com/something", 3)).toBeUndefined();
    expect(eyebrowForLink("not a url at all ://", 3)).toBeUndefined();
  });
});
