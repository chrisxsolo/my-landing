// The picker's extra sources: published Portfolio photos and the images of
// older journal posts, from the same pool the public pages use, shown only
// when browsing everything and never twice for one URL.
import { describe, expect, it } from "vitest";
import { usageLabel } from "@/app/admin/ExistingPhotoTile";
import { EXTRA_SOURCE_TIER, extraPickerPhotos, journalPickerPhotos, portfolioPickerPhotos } from "@/lib/guidePhotoLibrary/extraSources";
import type { LegacyJournalPhoto } from "@/lib/pagePhotos/journalSource";
import type { PhotoPool } from "@/lib/pagePhotos/pool";
import type { ResolvedPhoto } from "@/lib/pagePhotos/resolve";

const url = (n: number) => `https://x.supabase.co/storage/v1/object/public/portfolio/${n}.jpg`;

function portfolio(over: Partial<ResolvedPhoto> & { portfolioId: number }): ResolvedPhoto {
  return {
    url: url(over.portfolioId), title: `Photo ${over.portfolioId}`, alt: "", category: "grads", featured: false, sortOrder: 0,
    width: null, height: null, quality: 7, sessionKey: "legacy", sessionDate: null, sessionLabel: null, engineSessionId: null,
    school: "sjsu", schoolSource: "text", schoolNote: null, sessionSchoolMissing: false, placeKey: null, placeSource: null,
    eligible: true, ineligibleReason: null, pages: ["grads/sjsu"], ...over,
  };
}

function journal(over: Partial<LegacyJournalPhoto> & { id: string; url: string }): LegacyJournalPhoto {
  return {
    alt: "Maya at Tower Hall", contentHash: null, postId: 21, postSlug: "maya-sjsu", postTitle: "Maya at SJSU", role: "gallery",
    publishedAt: "2024-05-01T00:00:00Z", serviceType: "grads", school: "sjsu", schoolNote: null, sessionKey: "post:21",
    pages: ["grads/sjsu"], ...over,
  };
}

const pool: PhotoPool = {
  photos: [
    portfolio({ portfolioId: 1, sessionLabel: "Maya grad session" }),
    portfolio({ portfolioId: 2, category: "couples", school: null, pages: [] }),
    portfolio({ portfolioId: 3, eligible: false, ineligibleReason: "session is not cleared for marketing" }),
  ],
  explicitSchool: [], sessionSchool: [],
  journal: [
    journal({ id: "journal:21:0", url: url(21), role: "cover" }),
    journal({ id: "journal:22:0", url: url(22), postId: 22, postSlug: "kim-berkeley", postTitle: "Kim at Berkeley", school: "uc-berkeley", alt: "Kim" }),
  ],
  curation: [], spotTags: [], errors: [],
};

describe("extra picker sources", () => {
  it("offers published, eligible Portfolio photos as URL-only picks with a render thumbnail", () => {
    const picks = portfolioPickerPhotos(pool);
    expect(picks.map((p) => p.id)).toEqual(["portfolio:1", "portfolio:2"]);
    expect(picks[0]).toMatchObject({
      source: "portfolio", webUrl: url(1), schoolSlug: "sjsu", sessionName: "Maya grad session", status: "approved",
      tier: EXTRA_SOURCE_TIER, originLabel: "Portfolio #1", usedOnPages: null,
    });
    expect(picks[0].thumbUrl).toContain("/storage/v1/render/image/public/");
    expect(picks[0].thumbUrl).not.toContain("/storage/v1/object/public/");
  });

  it("offers the images of older journal posts, labelled by their post", () => {
    const picks = journalPickerPhotos(pool);
    expect(picks.map((p) => p.id)).toEqual(["journal:21:0", "journal:22:0"]);
    expect(picks[1]).toMatchObject({ source: "journal", sessionName: "Kim at Berkeley", schoolSlug: "uc-berkeley", originLabel: "Journal · Kim at Berkeley" });
  });

  it("filters by school, category and search text", () => {
    expect(extraPickerPhotos(pool, new Set(), { school: "uc-berkeley" }).map((p) => p.id)).toEqual(["journal:22:0"]);
    expect(extraPickerPhotos(pool, new Set(), { category: "couples" }).map((p) => p.id)).toEqual(["portfolio:2"]);
    expect(extraPickerPhotos(pool, new Set(), { q: "maya" }).map((p) => p.id)).toEqual(["portfolio:1", "journal:21:0"]);
  });

  it("never repeats a URL the Content Engine list already shows", () => {
    const picks = extraPickerPhotos(pool, new Set([url(1), url(22)]));
    expect(picks.map((p) => p.id)).toEqual(["portfolio:2", "journal:21:0"]);
  });
});

describe("usageLabel", () => {
  it("says how many public pages show the photo, or nothing when not counted", () => {
    expect(usageLabel({ usedOnPages: null })).toBeNull();
    expect(usageLabel({ usedOnPages: 0 })).toBe("Not used yet");
    expect(usageLabel({ usedOnPages: 1 })).toBe("Used on 1 page");
    expect(usageLabel({ usedOnPages: 3 })).toBe("Used on 3 pages");
  });
});
