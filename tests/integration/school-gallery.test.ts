import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";
import { getSchoolGalleryPhotos } from "@/lib/contentEngine/schoolGalleryData";

beforeAll(() => resetDb());

async function placement(slug: string, photoId: string, sortOrder: number, opts: {
  active?: boolean; alt_override?: string | null; caption?: string | null;
} = {}) {
  const { error } = await service.from("school_page_photos").insert({
    school_slug: slug, session_photo_id: photoId, sort_order: sortOrder,
    active: opts.active ?? true, alt_override: opts.alt_override ?? null, caption: opts.caption ?? null,
  });
  if (error) throw error;
}

describe("getSchoolGalleryPhotos (spec §3.5)", () => {
  it("returns active placements joined to derivative URLs in sort order, alt_override winning", async () => {
    const sessionId = await createTestSession();
    const a = await createTestPhoto(sessionId); // helper sets derivative + alt_text
    const b = await createTestPhoto(sessionId);
    await placement("sjsu", b.id, 2, { caption: "Cap toss" });
    await placement("sjsu", a.id, 1, { alt_override: "Override alt" });

    const photos = await getSchoolGalleryPhotos(service, "sjsu");
    expect(photos.map((p) => p.url)).toEqual([a.public_derivative_url, b.public_derivative_url]);
    expect(photos[0].alt).toBe("Override alt");                       // override wins
    expect(photos[1].alt).toBe("Bay Area grad portrait by soloxsnaps"); // canonical photo alt
    expect(photos[1].caption).toBe("Cap toss");
  });

  it("hides inactive placements and photos without a public derivative", async () => {
    const sessionId = await createTestSession();
    const hidden = await createTestPhoto(sessionId);
    await placement("stanford", hidden.id, 1, { active: false });

    const noDeriv = await createTestPhoto(sessionId, { derivative: false });
    await placement("stanford", noDeriv.id, 2);

    expect(await getSchoolGalleryPhotos(service, "stanford")).toEqual([]);
  });

  it("returns [] for a school with no placements", async () => {
    expect(await getSchoolGalleryPhotos(service, "usf")).toEqual([]);
  });
});
