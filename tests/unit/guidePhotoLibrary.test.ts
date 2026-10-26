import { describe, expect, it } from "vitest";
import { locationOptions, photoStatus, rankLibrary, type LibraryPhoto, type LibrarySession } from "@/lib/guidePhotoLibrary/rank";
import { toLibrarySession, engineSchoolForSpot, publicThumbUrl } from "@/lib/guidePhotoLibrary/load";
import { KNOWN_PLACES } from "@/lib/locations/places";

function session(over: Partial<LibrarySession> & { id: string }): LibrarySession {
  return {
    name: over.id, serviceType: "couples", schoolSlug: null, placeKeys: [],
    locationKey: null, locationLabel: null, permissionOk: true, ...over,
  };
}

function photo(over: Partial<LibraryPhoto> & { id: string; sessionId: string }): LibraryPhoto {
  return { hasDerivative: true, excluded: false, qualityScore: 7, sortOrder: 0, inGuide: null, ...over };
}

const sessions = new Map([
  ["rochelle", session({ id: "rochelle", name: "Rochelle Palace", placeKeys: ["palace-of-fine-arts"], locationKey: "palace-of-fine-arts", locationLabel: "Palace of Fine Arts" })],
  ["kayla", session({ id: "kayla", name: "Kayla Shark Fin", placeKeys: ["shark-fin-cove"], locationKey: "shark-fin-cove", locationLabel: "Shark Fin Cove" })],
  ["kim", session({ id: "kim", name: "Kim", serviceType: "grads", schoolSlug: "uc-berkeley" })],
  ["tara", session({ id: "tara", name: "Tara", serviceType: "grads", schoolSlug: "sf-state" })],
  ["nope", session({ id: "nope", name: "No permission", permissionOk: false, placeKeys: ["palace-of-fine-arts"] })],
]);

const photos: LibraryPhoto[] = [
  photo({ id: "kim-1", sessionId: "kim" }),
  photo({ id: "kayla-1", sessionId: "kayla", qualityScore: 10 }),
  photo({ id: "roch-draft", sessionId: "rochelle", hasDerivative: false, excluded: true, qualityScore: 9 }),
  photo({ id: "roch-live", sessionId: "rochelle", qualityScore: 6 }),
  photo({ id: "roch-gallery", sessionId: "rochelle", inGuide: { rowId: "r1", published: true, hero: false } }),
  photo({ id: "nope-1", sessionId: "nope", hasDerivative: false }),
];

const palace = { kind: "guide", guide: "couples", slug: "palace-of-fine-arts" } as const;

describe("rankLibrary", () => {
  it("puts gallery photos, then this location, then the same category first", () => {
    const ids = rankLibrary(photos, sessions, palace).map((p) => p.id);
    expect(ids).toEqual(["roch-gallery", "roch-live", "roch-draft", "nope-1", "kayla-1"]);
  });

  it("ranks approved photos ahead of unapproved ones within a tier, even at lower quality", () => {
    const ranked = rankLibrary(photos, sessions, palace);
    const live = ranked.findIndex((p) => p.id === "roch-live");
    const draft = ranked.findIndex((p) => p.id === "roch-draft");
    expect(live).toBeLessThan(draft);
    expect(ranked[draft].status).toBe("needs_approval");
  });

  it("keeps other categories out of suggestions but shows them in the whole library", () => {
    expect(rankLibrary(photos, sessions, palace).some((p) => p.id === "kim-1")).toBe(false);
    expect(rankLibrary(photos, sessions, palace, { scope: "all" }).at(-1)?.id).toBe("kim-1");
  });

  it("filters by search, location and category", () => {
    expect(rankLibrary(photos, sessions, palace, { q: "kayla" }).map((p) => p.id)).toEqual(["kayla-1"]);
    expect(rankLibrary(photos, sessions, palace, { location: "shark-fin-cove" }).map((p) => p.id)).toEqual(["kayla-1"]);
    expect(rankLibrary(photos, sessions, palace, { scope: "all", category: "grads" }).map((p) => p.id)).toEqual(["kim-1"]);
  });

  it("ranks the matching school first for a grad campus-spot target", () => {
    const tara = photo({ id: "tara-1", sessionId: "tara", qualityScore: 10 });
    const ranked = rankLibrary([...photos, tara], sessions, { kind: "gradSpot", spotSchoolId: "berkeley" }, {}, "uc-berkeley");
    expect(ranked.map((p) => p.id)).toEqual(["kim-1", "tara-1"]);
    expect(ranked[0].tier).toBe(1);
  });

  it("counts a grad session shot on that campus as this school even without a school set", () => {
    const trang = session({ id: "trang", serviceType: "grads", placeKeys: ["uc-berkeley"] });
    const ranked = rankLibrary([photo({ id: "trang-1", sessionId: "trang" })], new Map([["trang", trang]]), { kind: "gradSpot", spotSchoolId: "berkeley" }, {}, "uc-berkeley");
    expect(ranked[0].tier).toBe(1);
  });
});

describe("photoStatus", () => {
  it("blocks sessions without marketing permission", () => {
    expect(photoStatus({ hasDerivative: true }, { permissionOk: false })).toBe("no_permission");
    expect(photoStatus({ hasDerivative: false }, { permissionOk: true })).toBe("needs_approval");
  });
});

describe("toLibrarySession", () => {
  const base = {
    id: "s", public_display_name: "Rochelle ", internal_client_name: null, service_type: "couples",
    school_slug: null, secondary_locations: [], session_date: null,
    marketing_permission: true, marketing_permission_revoked_at: null,
  };

  it("matches messy location text to the place key the guide slug uses", () => {
    const s = toLibrarySession({ ...base, primary_location: "Palace of fine Arts " }, KNOWN_PLACES);
    expect(s.placeKeys).toContain("palace-of-fine-arts");
    expect(s.locationLabel).toBe("Palace of Fine Arts");
    expect(s.name).toBe("Rochelle");
  });

  it("keeps unknown locations filterable by their text", () => {
    const s = toLibrarySession({ ...base, primary_location: "Somewhere Odd" }, KNOWN_PLACES);
    expect(s.placeKeys).toEqual([]);
    expect(s.locationKey).toBe("text:somewhere odd");
    expect(locationOptions([s])).toEqual([{ key: "text:somewhere odd", label: "Somewhere Odd" }]);
  });

  it("treats a revoked permission as no permission", () => {
    expect(toLibrarySession({ ...base, primary_location: null, marketing_permission_revoked_at: "2026-01-01" }, KNOWN_PLACES).permissionOk).toBe(false);
  });
});

describe("helpers", () => {
  it("maps grad spot school ids to engine school slugs", () => {
    expect(engineSchoolForSpot("berkeley")).toBe("uc-berkeley");
    expect(engineSchoolForSpot("sfsu")).toBe("sf-state");
    expect(engineSchoolForSpot("nowhere")).toBeNull();
  });

  it("builds a resized render URL for a public derivative", () => {
    const url = publicThumbUrl("https://x.supabase.co/storage/v1/object/public/grad-photos/engine/a/b/c.jpg");
    expect(url).toContain("/storage/v1/render/image/public/grad-photos/engine/a/b/c.jpg");
    expect(url).toContain("width=480");
  });
});
