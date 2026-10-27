import { describe, expect, it } from "vitest";
import {
  buildLivePhotoList, payloadDrift, photoIdsFromLive, removeGalleryUrl, swapCover,
  type SessionPhotoMatch,
} from "@/lib/contentEngine/journalPhotoMembership";

const match = (id: string, excluded = false): SessionPhotoMatch => ({
  id, original_filename: `${id}.jpg`, excluded,
});

const post = {
  id: 16,
  cover_image_url: "https://x/cover.jpg",
  cover_image_alt: "cover alt",
  extra_image_urls: ["https://x/a.jpg", "https://x/b.jpg", "https://x/manual.jpg"],
  extra_image_alts: ["a alt", "b alt", "manual alt"],
  og_image_url: null,
};

describe("buildLivePhotoList", () => {
  const matches = new Map([
    ["https://x/cover.jpg", match("cover")],
    ["https://x/a.jpg", match("a")],
    ["https://x/b.jpg", match("b", true)],
  ]);
  const live = buildLivePhotoList(post, matches);

  it("lists the cover, every gallery URL in live order, then the social image", () => {
    expect(live.map((p) => [p.role, p.url])).toEqual([
      ["cover", "https://x/cover.jpg"],
      ["gallery", "https://x/a.jpg"],
      ["gallery", "https://x/b.jpg"],
      ["gallery", "https://x/manual.jpg"],
      ["og", "https://x/cover.jpg"],
    ]);
  });

  it("names the column each image is read from", () => {
    expect(live[0].source).toEqual({ table: "blog_posts", postId: 16, column: "cover_image_url" });
    expect(live[2].source).toEqual({ table: "blog_posts", postId: 16, column: "extra_image_urls", index: 1 });
    expect(live[4].source).toEqual({ table: "blog_posts", postId: 16, column: "og_image_url" });
  });

  it("marks the social image as a fallback when og_image_url is empty, and not when it is set", () => {
    expect(live[4].fallback).toBe(true);
    const explicit = buildLivePhotoList({ ...post, og_image_url: "https://x/social.jpg" }, matches);
    expect(explicit.at(-1)).toMatchObject({ role: "og", url: "https://x/social.jpg", fallback: false, photoId: null });
  });

  it("keeps photos that are excluded in the library, flagged", () => {
    expect(live[2]).toMatchObject({ photoId: "b", excludedInLibrary: true, filename: "b.jpg" });
  });

  it("keeps unmatched URLs instead of hiding them", () => {
    expect(live[3]).toMatchObject({ photoId: null, filename: null, alt: "manual alt" });
  });

  it("handles a post with no gallery", () => {
    expect(buildLivePhotoList({ ...post, extra_image_urls: null, extra_image_alts: null }, matches))
      .toHaveLength(2);
  });

  it("lists nothing for a post without any image", () => {
    expect(buildLivePhotoList({ ...post, cover_image_url: null, extra_image_urls: [], og_image_url: null }, matches))
      .toEqual([]);
  });
});

describe("swapCover", () => {
  it("sets the cover and the social image together and takes the new cover out of the gallery", () => {
    const next = swapCover(post, { url: "https://x/b.jpg", alt: "b alt" }, false);
    expect(next).toEqual({
      cover_image_url: "https://x/b.jpg", cover_image_alt: "b alt", og_image_url: "https://x/b.jpg",
      extra_image_urls: ["https://x/a.jpg", "https://x/manual.jpg"], extra_image_alts: ["a alt", "manual alt"],
    });
  });

  it("can keep the old cover at the front of the gallery", () => {
    const next = swapCover(post, { url: "https://x/a.jpg", alt: null }, true);
    expect(next.extra_image_urls).toEqual(["https://x/cover.jpg", "https://x/b.jpg", "https://x/manual.jpg"]);
    expect(next.extra_image_alts).toEqual(["cover alt", "b alt", "manual alt"]);
    expect(next.cover_image_alt).toBe("cover alt");
  });

  it("does not mutate the post", () => {
    const copy = structuredClone(post);
    swapCover(post, { url: "https://x/a.jpg", alt: null }, true);
    expect(post).toEqual(copy);
  });
});

describe("payloadDrift", () => {
  const matches = new Map([["https://x/cover.jpg", match("cover")], ["https://x/a.jpg", match("a")], ["https://x/b.jpg", match("b")]]);
  const live = buildLivePhotoList(post, matches);

  it("is in sync when the draft selects exactly the live photos with the live cover", () => {
    expect(payloadDrift({ photo_ids: ["cover", "a", "b"], cover_photo_id: "cover" }, live))
      .toEqual({ missingFromLive: [], missingFromPayload: [], coverMismatch: false, inSync: true });
  });

  it("reports photos the draft lists that the page does not show, and the reverse", () => {
    const drift = payloadDrift({ photo_ids: ["cover", "a", "ghost-1", "ghost-2"], cover_photo_id: "a" }, live);
    expect(drift).toEqual({
      missingFromLive: ["ghost-1", "ghost-2"], missingFromPayload: ["b"], coverMismatch: true, inSync: false,
    });
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
