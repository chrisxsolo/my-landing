import { describe, expect, it } from "vitest";
import {
  chooseCover, refusalMessage, toggleInclusion, type JournalPhotoSelection,
} from "@/lib/contentEngine/journalCoverSelection";
import { journalPostPayloadSchema } from "@/lib/contentEngine/payloads";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const GONE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const existing = new Set([A, B, C]);

const base: JournalPhotoSelection = { photo_ids: [A, B], cover_photo_id: A };

const ok = (r: ReturnType<typeof chooseCover>) => {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r.selection;
};

// The autosave route validates the full payload; every selection the helper
// returns must pass the same schema or the editor would save nothing.
const validPayload = (selection: JournalPhotoSelection) => journalPostPayloadSchema.safeParse({
  title: "t", slug: "t", body: "b", ...selection,
}).success;

describe("chooseCover", () => {
  it("changes only the cover when the photo is already included", () => {
    const next = ok(chooseCover(base, B, existing));
    expect(next).toEqual({ photo_ids: [A, B], cover_photo_id: B });
    expect(validPayload(next)).toBe(true);
  });

  it("adds a photo that is not included yet and makes it the cover in one step", () => {
    const next = ok(chooseCover(base, C, existing));
    expect(next).toEqual({ photo_ids: [A, B, C], cover_photo_id: C });
    expect(next.photo_ids.filter((id) => id === C)).toHaveLength(1);
    expect(validPayload(next)).toBe(true);
  });

  it("is idempotent for the current cover", () => {
    expect(ok(chooseCover(base, A, existing))).toEqual(base);
  });

  it("keeps the other photos and their order", () => {
    const next = ok(chooseCover({ photo_ids: [C, A, B], cover_photo_id: C }, B, existing));
    expect(next.photo_ids).toEqual([C, A, B]);
    expect(next.cover_photo_id).toBe(B);
  });

  it("refuses a photo that no longer exists", () => {
    const r = chooseCover({ photo_ids: [A, GONE], cover_photo_id: A }, GONE, existing);
    expect(r).toEqual({ ok: false, reason: "missing_photo" });
  });

  it("never introduces duplicate ids, even from a duplicated input", () => {
    const next = ok(chooseCover({ photo_ids: [A, A, B], cover_photo_id: A }, B, existing));
    expect(next.photo_ids).toEqual([A, B]);
  });
});

describe("toggleInclusion", () => {
  it("adds a photo without touching the cover", () => {
    expect(ok(toggleInclusion(base, C, existing))).toEqual({ photo_ids: [A, B, C], cover_photo_id: A });
  });

  it("the first photo added to an empty journal becomes its cover", () => {
    const next = ok(toggleInclusion({ photo_ids: [], cover_photo_id: "" }, B, existing));
    expect(next).toEqual({ photo_ids: [B], cover_photo_id: B });
    expect(validPayload(next)).toBe(true);
  });

  it("removing a non-cover photo leaves the cover unchanged", () => {
    expect(ok(toggleInclusion(base, B, existing))).toEqual({ photo_ids: [A], cover_photo_id: A });
  });

  it("removing the cover promotes the first remaining photo that exists", () => {
    const next = ok(toggleInclusion({ photo_ids: [A, GONE, B, C], cover_photo_id: A }, A, existing));
    expect(next).toEqual({ photo_ids: [GONE, B, C], cover_photo_id: B });
    expect(validPayload(next)).toBe(true);
  });

  it("refuses to remove the last photo that could be the cover", () => {
    expect(toggleInclusion({ photo_ids: [A], cover_photo_id: A }, A, existing))
      .toEqual({ ok: false, reason: "last_photo" });
    expect(toggleInclusion({ photo_ids: [A, GONE], cover_photo_id: A }, A, existing))
      .toEqual({ ok: false, reason: "last_photo" });
  });

  it("a missing id can still be removed while another photo is the cover", () => {
    const next = ok(toggleInclusion({ photo_ids: [A, GONE], cover_photo_id: A }, GONE, existing));
    expect(next).toEqual({ photo_ids: [A], cover_photo_id: A });
  });

  it("choosing a cover and toggling inclusion are independent steps", () => {
    const withCover = ok(chooseCover(base, B, existing));
    const thenAdded = ok(toggleInclusion(withCover, C, existing));
    expect(thenAdded).toEqual({ photo_ids: [A, B, C], cover_photo_id: B });
    const thenRemoved = ok(toggleInclusion(thenAdded, A, existing));
    expect(thenRemoved).toEqual({ photo_ids: [B, C], cover_photo_id: B });
  });
});

describe("refusalMessage", () => {
  it("names the photo and says what to do", () => {
    expect(refusalMessage("last_photo", "DSC01907.jpg")).toContain("DSC01907.jpg is the only photo");
    expect(refusalMessage("missing_photo", "DSC01907.jpg")).toContain("cannot be the cover");
  });
});
