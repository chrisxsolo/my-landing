import { beforeEach, describe, expect, it, vi } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";

vi.mock("@/lib/locations/registry", () => ({
  loadKnownPlaces: async () => KNOWN_PLACES,
  loadPublishedDbGuides: async () => [],
}));
vi.mock("@/lib/contentEngine/relatedPosts", () => ({ missingBlogLinks: async () => [] }));

const { publishBlockReason } = await import("@/lib/contentEngine/publishPreflight");

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;

// A read-only stand-in for the few PostgREST calls the preflight makes.
function fakeClient() {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select: () => builder,
        eq: (col: string, value: unknown) => { rows = rows.filter((r) => r[col] === value); return builder; },
        in: (col: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[col])); return builder; },
        not: (col: string) => { rows = rows.filter((r) => r[col] !== null && r[col] !== undefined); return builder; },
        single: async () => (rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "no rows" } }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
      };
      return builder;
    },
  } as never;
}

const PHOTO_A = "00000000-0000-4000-8000-00000000000a";
const PHOTO_B = "00000000-0000-4000-8000-00000000000b";

function seed(session: Row, snapshot: Row, photos: Row[] = []) {
  tables = {
    session_content_packages: [{ id: "pkg", photography_session_id: "s1", session_facts_snapshot: snapshot }],
    photography_sessions: [{ id: "s1", school_slug: null, secondary_locations: [], ...session }],
    session_photos: photos.map((p) => ({ photography_session_id: "s1", ...p })),
  };
}

const post = (body: string, title = "Golden hour portraits") =>
  ({ title, body, meta_description: "Portraits in San Francisco.", photo_ids: [PHOTO_A, PHOTO_B], cover_photo_id: PHOTO_A });

const check = (body: string) => publishBlockReason(fakeClient(), "journal_post", post(body), "pkg");

describe("journal preflight: current session facts beat stale snapshots", () => {
  beforeEach(() => seed(
    { primary_location: "Legion of Honor" },
    { primary_location: "Palace of Fine Arts", secondary_locations: [] },
  ));

  it("blocks a post claiming the snapshot's old location after the session was corrected", async () => {
    const reason = await check("We shot at the Palace of Fine Arts as the fog rolled in.");
    expect(reason).toContain("Palace of Fine Arts");
  });

  it("allows the corrected location", async () => {
    expect(await check("We shot at the Legion of Honor as the fog rolled in.")).toBeNull();
  });

  it("explains which place, where, and what to do", async () => {
    const reason = await check("We shot at the Palace of Fine Arts as the fog rolled in.");
    expect(reason).toContain('• body says the session was at Palace of Fine Arts: "We shot at the Palace');
    expect(reason).toContain("This session's locations: Legion of Honor.");
  });

  it("allows a link to the old place's guide", async () => {
    const body = "We shot at the Legion of Honor.\n\nSee also: our [Palace of Fine Arts guide](/locations/sf/palace-of-fine-arts).";
    expect(await check(body)).toBeNull();
  });
});

describe("journal preflight: confirmed photo locations", () => {
  it("allows a place confirmed on a photo in the post", async () => {
    seed({ primary_location: "Legion of Honor" }, {}, [
      { id: PHOTO_B, photo_location: "Lands End", photo_location_source: "manual" },
    ]);
    expect(await check("We finished at Lands End after the Legion of Honor.")).toBeNull();
  });

  it("ignores a confirmed location on a photo the post does not show", async () => {
    seed({ primary_location: "Legion of Honor" }, {}, [
      { id: "00000000-0000-4000-8000-0000000000ff", photo_location: "Lands End", photo_location_source: "gps" },
    ]);
    expect(await check("We finished at Lands End after the Legion of Honor.")).toContain("Lands End");
  });
});

describe("journal preflight: snapshot fallback", () => {
  it("uses the snapshot when the live session has no location at all", async () => {
    seed({ primary_location: null }, { primary_location: "Palace of Fine Arts", secondary_locations: [] });
    expect(await check("We shot at the Palace of Fine Arts.")).toBeNull();
    expect(await check("We shot at the Legion of Honor.")).toContain("saved when this post was generated");
  });
});
