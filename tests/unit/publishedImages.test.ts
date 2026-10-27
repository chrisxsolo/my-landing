// Published image traceability: the inventory lists exactly what the public
// post renders (cover, gallery, social image) with its source column, the
// engine draft's drift from the page is reported and repairable, a gallery
// photo can be removed, and the cover is replaced (never removed) together
// with the social image — for engine journals and legacy BlogTab posts alike.
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadPostImageInventory, PostImagesError, removePostGalleryImage, replacePostCover, syncEnginePayload,
} from "@/lib/blog/publishedImages";
import { getLiveJournalPhotos, replaceJournalCover } from "@/lib/contentEngine/liveJournalPhotos";
import { fakeSupabase, type FakeSupabase } from "./support/fakeSupabase";

const ITEM = "41728134-270f-4f9b-8003-72130890afe9";
const SESSION = "051aa232-c30e-468b-b9ff-3aa3be136e7b";
const url = (name: string) => `https://cdn.example/engine/${name}.jpg`;

let fake: FakeSupabase;

beforeEach(() => {
  fake = fakeSupabase({
    blog_posts: [
      { id: 16, slug: "kim-sather-gate", title: "Kim at Sather Gate", cover_image_url: url("cover"), cover_image_alt: "Kim at the gate",
        extra_image_urls: [url("a"), url("b"), "https://cdn.example/manual.jpg"], extra_image_alts: ["a alt", "b alt", "manual"],
        og_image_url: url("cover") },
      { id: 3, slug: "sjsu-maya", title: "Maya at SJSU", cover_image_url: "https://cdn.example/blog/maya-cover.jpg", cover_image_alt: null,
        extra_image_urls: ["https://cdn.example/blog/maya-1.jpg", "https://cdn.example/blog/maya-2.jpg"], extra_image_alts: null,
        og_image_url: null },
    ],
    session_content_items: [
      { id: ITEM, content_type: "journal_post", status: "published", published_target_type: "blog_post", published_target_id: "16",
        package_id: "pkg-1", published_at: "2026-10-20T00:00:00Z",
        payload: { title: "Kim", photo_ids: ["p-cover", "p-a", "p-b", "p-excluded"], cover_photo_id: "p-cover" } },
    ],
    session_content_packages: [{ id: "pkg-1", photography_session_id: SESSION }],
    session_photos: [
      { id: "p-cover", photography_session_id: SESSION, original_filename: "DSC01549.jpg", excluded: false, public_derivative_url: url("cover"), alt_text: "Kim at the gate" },
      { id: "p-a", photography_session_id: SESSION, original_filename: "DSC01534.jpg", excluded: false, public_derivative_url: url("a"), alt_text: "a alt" },
      { id: "p-b", photography_session_id: SESSION, original_filename: "DSC01608.jpg", excluded: true, public_derivative_url: url("b"), alt_text: null },
      { id: "p-excluded", photography_session_id: SESSION, original_filename: "DSC01787.jpg", excluded: true, public_derivative_url: url("excluded"), alt_text: null },
      { id: "p-spare", photography_session_id: SESSION, original_filename: "DSC01999.jpg", excluded: false, public_derivative_url: url("spare"), alt_text: "spare alt" },
    ],
    image_library: [
      { id: 1, source_post_id: 16, source_role: "cover", image_url: url("cover") },
      { id: 2, source_post_id: 16, source_role: "gallery", image_url: url("a") },
      { id: 3, source_post_id: 16, source_role: "gallery", image_url: url("b") },
    ],
  });
});

const payloadOf = () => fake.tables.session_content_items[0].payload as Record<string, unknown>;
const postOf = (id: number) => fake.tables.blog_posts.find((p) => p.id === id)!;

describe("loadPostImageInventory", () => {
  it("lists every rendered image for an engine journal with its source column and session photo", async () => {
    const inv = await loadPostImageInventory(fake.client, 16);
    expect(inv.photos.map((p) => [p.role, p.url, p.photoId])).toEqual([
      ["cover", url("cover"), "p-cover"],
      ["gallery", url("a"), "p-a"],
      ["gallery", url("b"), "p-b"],
      ["gallery", "https://cdn.example/manual.jpg", null],
      ["og", url("cover"), "p-cover"],
    ]);
    expect(inv.photos[2]).toMatchObject({ excludedInLibrary: true, filename: "DSC01608.jpg" });
    expect(inv.photos[3].source).toEqual({ table: "blog_posts", postId: 16, column: "extra_image_urls", index: 2 });
    expect(inv.photos[4]).toMatchObject({ source: { column: "og_image_url" }, fallback: false });
  });

  it("reports the draft photo the page does not show (the post 16 drift)", async () => {
    const inv = await loadPostImageInventory(fake.client, 16);
    expect(inv.engine).toMatchObject({
      itemId: ITEM, sessionId: SESSION,
      drift: { missingFromLive: ["p-excluded"], missingFromPayload: [], coverMismatch: false, inSync: false },
    });
  });

  it("works for a legacy post with no engine item: nothing matched, social image falls back to the cover", async () => {
    const inv = await loadPostImageInventory(fake.client, 3);
    expect(inv.engine).toBeNull();
    expect(inv.photos.map((p) => [p.role, p.photoId])).toEqual([["cover", null], ["gallery", null], ["gallery", null], ["og", null]]);
    expect(inv.photos.at(-1)).toMatchObject({ url: "https://cdn.example/blog/maya-cover.jpg", fallback: true });
    expect(fake.reads.some(([table]) => table === "session_photos")).toBe(false);
  });

  it("404s for an unknown post", async () => {
    await expect(loadPostImageInventory(fake.client, 999)).rejects.toMatchObject({ status: 404 });
  });

  it("is reachable by engine item id too", async () => {
    const live = await getLiveJournalPhotos(fake.client, ITEM);
    expect(live.postId).toBe(16);
    expect(live.photos).toHaveLength(5);
  });
});

describe("syncEnginePayload", () => {
  it("rewrites the draft selection from the live page so the two agree", async () => {
    await syncEnginePayload(fake.client, 16);
    expect(payloadOf()).toMatchObject({ title: "Kim", photo_ids: ["p-cover", "p-a", "p-b"], cover_photo_id: "p-cover" });
    const inv = await loadPostImageInventory(fake.client, 16);
    expect(inv.engine?.drift.inSync).toBe(true);
  });

  it("is a no-op for a legacy post", async () => {
    const live = await syncEnginePayload(fake.client, 3);
    expect(live).toHaveLength(4);
    expect(fake.ops).toEqual([]);
  });
});

describe("removePostGalleryImage", () => {
  it("drops the gallery URL, its library row, and the draft id", async () => {
    const r = await removePostGalleryImage(fake.client, 16, url("b"));
    expect(r).toEqual({ slug: "kim-sather-gate", removed: 1, remaining: 2 });
    expect(postOf(16)).toMatchObject({ extra_image_urls: [url("a"), "https://cdn.example/manual.jpg"], extra_image_alts: ["a alt", "manual"] });
    expect(fake.tables.image_library.map((r) => r.image_url)).toEqual([url("cover"), url("a")]);
    expect(payloadOf().photo_ids).toEqual(["p-cover", "p-a"]);
  });

  it("refuses to remove the cover and points at replacing it", async () => {
    await expect(removePostGalleryImage(fake.client, 16, url("cover")))
      .rejects.toThrow(/cover photo — replace it/);
  });

  it("404s for a URL that is not in the gallery", async () => {
    await expect(removePostGalleryImage(fake.client, 16, url("nope"))).rejects.toMatchObject({ status: 404 });
  });
});

describe("replacePostCover", () => {
  it("promotes a gallery photo: cover and social image change together, the old cover leaves the post", async () => {
    const r = await replacePostCover(fake.client, { postId: 16, url: url("a"), keepOldInGallery: false });
    expect(r).toEqual({ slug: "kim-sather-gate", cover_image_url: url("a"), og_image_url: url("a"), gallery: 2 });
    expect(postOf(16)).toMatchObject({
      cover_image_url: url("a"), cover_image_alt: "a alt", og_image_url: url("a"),
      extra_image_urls: [url("b"), "https://cdn.example/manual.jpg"], extra_image_alts: ["b alt", "manual"],
    });
    const lib = fake.tables.image_library.map((r) => [r.source_role, r.image_url]);
    expect(lib).toContainEqual(["cover", url("a")]);
    expect(lib).not.toContainEqual(["cover", url("cover")]);
    expect(lib).not.toContainEqual(["gallery", url("a")]);
    expect(payloadOf()).toMatchObject({ photo_ids: ["p-a", "p-b"], cover_photo_id: "p-a" });
  });

  it("can keep the old cover in the gallery, with a library row", async () => {
    await replacePostCover(fake.client, { postId: 16, url: url("a"), keepOldInGallery: true });
    expect(postOf(16).extra_image_urls).toEqual([url("cover"), url("b"), "https://cdn.example/manual.jpg"]);
    expect(fake.tables.image_library.map((r) => [r.source_role, r.image_url])).toContainEqual(["gallery", url("cover")]);
    expect(payloadOf()).toMatchObject({ photo_ids: ["p-a", "p-cover", "p-b"], cover_photo_id: "p-a" });
  });

  it("accepts one of the session's published photos that is not yet in the post", async () => {
    const r = await replaceJournalCover(fake.client, ITEM, url("spare"), false);
    expect(r.cover_image_url).toBe(url("spare"));
    expect(postOf(16)).toMatchObject({ cover_image_alt: "spare alt", og_image_url: url("spare") });
    expect(payloadOf().cover_photo_id).toBe("p-spare");
  });

  it("refuses a URL that is neither in the post nor one of the session's photos", async () => {
    await expect(replacePostCover(fake.client, { postId: 16, url: "https://elsewhere.example/x.jpg", keepOldInGallery: false }))
      .rejects.toBeInstanceOf(PostImagesError);
    expect(postOf(16).cover_image_url).toBe(url("cover"));
  });

  it("on a legacy post only the gallery is eligible, and og_image_url is filled in", async () => {
    await replacePostCover(fake.client, { postId: 3, url: "https://cdn.example/blog/maya-2.jpg", keepOldInGallery: true });
    expect(postOf(3)).toMatchObject({
      cover_image_url: "https://cdn.example/blog/maya-2.jpg", og_image_url: "https://cdn.example/blog/maya-2.jpg",
      extra_image_urls: ["https://cdn.example/blog/maya-cover.jpg", "https://cdn.example/blog/maya-1.jpg"],
    });
    await expect(replacePostCover(fake.client, { postId: 3, url: url("spare"), keepOldInGallery: false }))
      .rejects.toMatchObject({ status: 422 });
  });

  it("refuses to make the current cover the cover again", async () => {
    await expect(replacePostCover(fake.client, { postId: 16, url: url("cover"), keepOldInGallery: false }))
      .rejects.toThrow(/already the cover/);
  });
});
