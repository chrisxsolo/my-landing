// /links is the Instagram link hub: a utility page for followers that must not
// compete with the homepage in search. It carries its own title and noindex.
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/links/page";

describe("/links metadata", () => {
  it("has its own title rather than inheriting the homepage default", () => {
    expect(metadata.title).toBe("Links");
    expect(String(metadata.description)).toMatch(/book|pricing|availability/i);
  });

  it("is kept out of the index but lets crawlers follow its links", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
