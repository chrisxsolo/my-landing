// Draft field validation (pure): only writable columns get through, worker
// state can never be set by a client, images must belong to the draft, and
// completeness is judged the same way the schedule service judges it.
import { describe, it, expect } from "vitest";
import { draftIncompleteReason, parseDraftFields, DraftError, slugify } from "@/lib/contentPublishing/blogDrafts";
import { normalizeDraftImages, publicPathForDraftImage } from "@/lib/contentPublishing/blogDraftImages";

const DRAFT = "0f1e2d3c-4b5a-4697-8877-665544332211";
const OTHER = "11111111-2222-4333-8444-555555555555";
const FILE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";

describe("parseDraftFields", () => {
  it("rejects server-owned and unknown columns", () => {
    for (const body of [{ status: "published" }, { revision: 9 }, { published_post_id: 3 }, { source: "ai_photos" }, { nonsense: 1 }]) {
      expect(() => parseDraftFields(body, DRAFT)).toThrow(DraftError);
    }
  });
  it("normalizes text and slugs", () => {
    expect(parseDraftFields({ title: "  Golden Hour at SJSU  ", slug: "Golden Hour at SJSU!", meta_keywords: "  " }, DRAFT))
      .toEqual({ title: "Golden Hour at SJSU", slug: "golden-hour-at-sjsu", meta_keywords: null });
    expect(slugify("Mia's Grad Shoot — SJSU")).toBe("mia-s-grad-shoot-sjsu");
  });
  it("accepts only this draft's private uploads or public https images", () => {
    expect(parseDraftFields({ images: [{ path: `${DRAFT}/${FILE}`, alt: "a" }] }, DRAFT)).toEqual({ images: [{ path: `${DRAFT}/${FILE}`, alt: "a" }] });
    expect(() => parseDraftFields({ images: [{ path: `${OTHER}/${FILE}` }] }, DRAFT)).toThrow(/not one of this draft/);
    expect(() => parseDraftFields({ images: [{ path: `${DRAFT}/../../etc/passwd` }] }, DRAFT)).toThrow(/not one of this draft/);
    expect(() => parseDraftFields({ images: [{ url: "http://evil.example/x.jpg" }] }, DRAFT)).toThrow(/hosted on this site/);
    expect(() => parseDraftFields({ images: [{ alt: "no source" }] }, DRAFT)).toThrow(/neither/);
    expect(() => parseDraftFields({ images: "nope" }, DRAFT)).toThrow(/list/);
  });
});

describe("normalizeDraftImages / publicPathForDraftImage", () => {
  it("keeps order and maps a private path to a deterministic public home", () => {
    const imgs = normalizeDraftImages(DRAFT, [{ path: `${DRAFT}/${FILE}`, alt: "x" }]);
    expect(publicPathForDraftImage(imgs[0].path!)).toBe(`blog/drafts/${DRAFT}/${FILE}`);
  });
});

describe("draftIncompleteReason", () => {
  const base = { title: "T", body: "B", slug: "t", images: [] };
  it("names the first missing thing in actionable words", () => {
    expect(draftIncompleteReason({ ...base, title: " " }, false)).toMatch(/title/);
    expect(draftIncompleteReason({ ...base, body: "" }, false)).toMatch(/body/);
    expect(draftIncompleteReason({ ...base, slug: "Bad Slug" }, false)).toMatch(/slug/);
    expect(draftIncompleteReason(base, true)).toMatch(/already uses/);
    expect(draftIncompleteReason(base, false)).toBeNull();
  });
});
