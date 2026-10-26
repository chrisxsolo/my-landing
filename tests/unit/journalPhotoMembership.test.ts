import { describe, expect, it } from "vitest";
import {
  buildLivePhotoList, photoIdsFromLive, removeGalleryUrl,
  type SessionPhotoMatch,
} from "@/lib/contentEngine/journalPhotoMembership";

const match = (id: string, excluded = false): SessionPhotoMatch => ({
  id, original_filename: `${id}.jpg`, excluded,
});

const post = {
  cover_image_url: "https://x/cover.jpg",
  cover_image_alt: "cover alt",
  extra_image_urls: ["https://x/a.jpg", "https://x/b.jpg", "https://x/manual.jpg"],
  extra_image_alts: ["a alt", "b alt", "manual alt"],
};

describe("buildLivePhotoList", () => {
  const matches = new Map([
    ["https://x/cover.jpg", match("cover")],
    ["https://x/a.jpg", match("a")],
    ["https://x/b.jpg", match("b", true)],
  ]);
  const live = buildLivePhotoList(post, matches);

  it("lists the cover then every gallery URL in live order", () => {
    expect(live.map((p) => [p.role, p.url])).toEqual([
      ["cover", "https://x/cover.jpg"],
      ["gallery", "https://x/a.jpg"],
      ["gallery", "https://x/b.jpg"],
      ["gallery", "https://x/manual.jpg"],
    ]);
  });

  it("keeps photos that are excluded in the library, flagged", () => {
    expect(live[2]).toMatchObject({ photoId: "b", excludedInLibrary: true, filename: "b.jpg" });
  });

  it("keeps unmatched URLs instead of hiding them", () => {
    expect(live[3]).toMatchObject({ photoId: null, filename: null, alt: "manual alt" });
  });

  it("handles a post with no gallery", () => {
    expect(buildLivePhotoList({ ...post, extra_image_urls: null, extra_image_alts: null }, matches))
      .toHaveLength(1);
  });
});

describe("removeGalleryUrl", () => {
  it("removes only the chosen URL and keeps alts aligned", () => {
    const r = removeGalleryUrl({ urls: post.extra_image_urls, alts: post.extra_image_alts }, "https://x/b.jpg");
    expect(r).toEqual({
      urls: ["https://x/a.jpg", "https://x/manual.jpg"],
      alts: ["a alt", "manual alt"],
      removed: 1,
    });
  });

  it("removes duplicates of the same URL", () => {
    const r = removeGalleryUrl({ urls: ["u1", "u2", "u1"], alts: ["1", "2", "1b"] }, "u1");
    expect(r).toEqual({ urls: ["u2"], alts: ["2"], removed: 2 });
  });

  it("reports nothing removed for an unknown URL and pads missing alts", () => {
    const r = removeGalleryUrl({ urls: ["u1", "u2"], alts: ["1"] }, "nope");
    expect(r).toEqual({ urls: ["u1", "u2"], alts: ["1", ""], removed: 0 });
  });

  it("does not mutate its input", () => {
    const gallery = { urls: ["u1", "u2"], alts: ["1", "2"] };
    removeGalleryUrl(gallery, "u1");
    expect(gallery).toEqual({ urls: ["u1", "u2"], alts: ["1", "2"] });
  });
});

describe("photoIdsFromLive", () => {
  it("puts the cover first, then matched gallery ids, deduped, skipping unmatched", () => {
    const live = buildLivePhotoList(
      { ...post, extra_image_urls: [...post.extra_image_urls, "https://x/a.jpg"] },
      new Map([["https://x/cover.jpg", match("cover")], ["https://x/a.jpg", match("a")], ["https://x/b.jpg", match("b")]]),
    );
    expect(photoIdsFromLive("cover", live)).toEqual(["cover", "a", "b"]);
  });

  it("drops a removed photo so a later republish can't bring it back", () => {
    const matches = new Map([["https://x/cover.jpg", match("cover")], ["https://x/a.jpg", match("a")], ["https://x/b.jpg", match("b")]]);
    const after = removeGalleryUrl({ urls: post.extra_image_urls, alts: post.extra_image_alts }, "https://x/a.jpg");
    const live = buildLivePhotoList({ ...post, extra_image_urls: after.urls, extra_image_alts: after.alts }, matches);
    expect(photoIdsFromLive("cover", live)).toEqual(["cover", "b"]);
  });
});
