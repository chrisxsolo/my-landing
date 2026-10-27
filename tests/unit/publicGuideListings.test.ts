// Public hubs and the locations explorer's related links list only published
// location guides: an unpublished guide renders noindex, so linking it from a
// public page sends crawlers to a page they are told to ignore. Admin screens
// still see every guide.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getAllCouplesLocations, getCouplesLocationSummaries } from "@/lib/couplesGuide/locations";
import { getAllFamilyLocations, getFamilyLocationSummaries } from "@/lib/familyGuide/locations";
import { getAllPortraitLocations, getPortraitLocationSummaries } from "@/lib/portraitGuide/locations";
import { loadRelatedContent } from "@/lib/locationLibrary/related";
import type { LibraryLocation } from "@/lib/locationLibrary/load";

vi.mock("@/lib/locations/registry", () => ({ loadPublishedDbGuides: async () => [] }));

const publishedSlugs = (all: { slug: string; published: boolean }[]) =>
  all.filter((l) => l.published).map((l) => l.slug);

describe("public hub summaries", () => {
  it.each([
    ["couples", getAllCouplesLocations, getCouplesLocationSummaries],
    ["family", getAllFamilyLocations, getFamilyLocationSummaries],
    ["portrait", getAllPortraitLocations, getPortraitLocationSummaries],
  ] as const)("%s summaries list exactly the published guides", (_guide, all, summaries) => {
    expect(summaries().map((s) => s.slug)).toEqual(publishedSlugs(all()));
  });

  it("still exposes unpublished guides to routing and admin via getAll*", () => {
    expect(getAllCouplesLocations().some((l) => !l.published)).toBe(true);
    expect(getAllFamilyLocations().some((l) => !l.published)).toBe(true);
  });
});

function libraryLocation(id: number, key: string): LibraryLocation {
  return {
    row: { id, location_key: key, alias_keys: [] },
    links: [],
  } as unknown as LibraryLocation;
}

const client = {} as SupabaseClient;
const palace = libraryLocation(1, "palace-of-fine-arts");

describe("related guide links for a library location", () => {
  it("public pages get only published guides for the place", async () => {
    const related = (await loadRelatedContent(client, [palace]))[1];
    expect(related.map((l) => l.href)).toEqual(["/couples-guide/locations/palace-of-fine-arts"]);
  });

  it("admin screens keep the unpublished guides too", async () => {
    const related = (await loadRelatedContent(client, [palace], { includeUnpublished: true }))[1];
    expect(related.map((l) => l.href)).toEqual([
      "/couples-guide/locations/palace-of-fine-arts",
      "/family-guide/locations/palace-of-fine-arts",
      "/portrait-guide/locations/palace-of-fine-arts",
    ]);
  });

  it("a place with only unpublished guides gets no public guide link", async () => {
    const baker = libraryLocation(2, "baker-beach");
    expect((await loadRelatedContent(client, [baker]))[2]).toEqual([]);
    expect((await loadRelatedContent(client, [baker], { includeUnpublished: true }))[2].map((l) => l.href))
      .toEqual(["/portrait-guide/locations/baker-beach"]);
  });
});
