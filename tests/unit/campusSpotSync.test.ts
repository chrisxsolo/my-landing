// The campus-spot sync end to end against an in-memory Supabase that caps
// every response at 1000 rows like PostgREST: large libraries, incomplete
// reads, and photos that stop being public.
import { describe, expect, it } from "vitest";
import { buildPhotoFacts, loadPhotoFacts } from "@/lib/campusSpotFill/photoFacts";
import { readPublicAutoRows } from "@/lib/campusSpotFill/store";
import { syncCampusSpotPhotos } from "@/lib/campusSpotFill/sync";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { fakeSupabase, manyRows } from "./support/fakeSupabase";

const url = (n: number | string) => `https://x.supabase.co/storage/v1/object/public/derivatives/${n}.jpg`;
const AUTO = "campus_spot_auto_photos";
const SESSION = { id: "s-1", public_display_name: "Grad", service_type: "grads", school_slug: "sjsu",
  primary_location: null, secondary_locations: [], marketing_permission: true, marketing_permission_revoked_at: null };

function enginePhoto(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `p-${String(i).padStart(5, "0")}`, public_derivative_url: url(i), content_hash: `h-${i}`, excluded: false,
    photo_location: null, photo_location_source: null, gps_latitude: null, gps_longitude: null,
    alt_text: null, quality_score: 7, width: 1000, height: 1500, photography_session_id: SESSION.id,
    photography_sessions: SESSION, ...extra,
  };
}

const towerSteps = { id: 30, school_id: "sjsu", school_name: "San José State University", school_short: "SJSU",
  name: "Tower Lawn Steps", description: "", tip: "", icon: "📍", image_url: null, order: 1 };

function claimRpc(tables: Record<string, Record<string, unknown>[]>) {
  return {
    claim_campus_spot_photo: (a: Record<string, unknown>) => {
      const rows = (tables[AUTO] ??= []);
      if (rows.some((r) => r.image_url === a.p_image_url || (r.school_slug === a.p_school_slug && r.spot_key === a.p_spot_key))) return false;
      rows.push({ school_slug: a.p_school_slug, spot_key: a.p_spot_key, image_url: a.p_image_url, evidence: a.p_evidence });
      return true;
    },
  };
}

/** 2,350 Content Engine photos; the Portfolio photo's own original is row 2,000 and was confirmed at Tower Hall steps. */
function bigLibrary() {
  const tables: Record<string, Record<string, unknown>[]> = {
    location_spots: [towerSteps],
    portfolio_images: [{ id: 1, title: "SJSU graduate portrait", alt: "SJSU graduate portrait", image_url: url("portfolio-1"),
      category_slug: "grads", featured: false, sort_order: 1, width: 1000, height: 1500, content_hash: "h-2000",
      school: "sjsu", location: null, session_label: null, published: true }],
    session_photos: manyRows(2350, (i) => enginePhoto(i, i === 2000
      ? { photo_location: "Tower Hall steps", photo_location_source: "manual" } : {})),
  };
  return tables;
}

describe("campus spot photo facts", () => {
  it("reads every session photo past the 1000-row cap", async () => {
    const fake = fakeSupabase(bigLibrary());
    const facts = await loadPhotoFacts(fake.client, KNOWN_PLACES);
    expect(facts.get(url(2000))?.photoLocation).toEqual({ text: "Tower Hall steps", source: "manual", placeKey: null });
    expect(facts.get(url("portfolio-1"))?.photoLocation?.text).toBe("Tower Hall steps");
    expect(fake.reads.filter(([t]) => t === "session_photos").length).toBeGreaterThan(2);
  });

  it("blocks excluded, revoked and unpublished photos, and places GPS", () => {
    const revoked = { ...SESSION, marketing_permission_revoked_at: "2026-10-01T00:00:00Z" };
    const facts = buildPhotoFacts([
      enginePhoto(1, { excluded: true }),
      enginePhoto(2, { photography_sessions: revoked }),
      enginePhoto(3, { gps_latitude: 37.8029, gps_longitude: -122.4484 }),
    ], [
      { id: 9, image_url: url("pf-9"), content_hash: "h-1", location: "Palace of Fine Arts", published: true },
      { id: 10, image_url: url("pf-10"), content_hash: null, location: null, published: false },
    ], KNOWN_PLACES);
    expect(facts.get(url(1))?.blocked).toBe("excluded in the Content Engine");
    expect(facts.get(url(2))?.blocked).toBe("session is not cleared for marketing");
    expect(facts.get(url(3))?.gpsPlace).toEqual({ key: "palace-of-fine-arts", name: "Palace of Fine Arts" });
    expect(facts.get(url("pf-9"))).toMatchObject({ blocked: "excluded in the Content Engine",
      photoLocation: { text: "Palace of Fine Arts", source: "tag", placeKey: "palace-of-fine-arts" } });
    expect(facts.get(url("pf-10"))?.blocked).toBe("unpublished in the Portfolio");
  });
});

describe("campus spot sync on a large library", () => {
  it("fills a spot from photo-level evidence found past row 1000", async () => {
    const tables = bigLibrary();
    const report = await syncCampusSpotPhotos(fakeSupabase(tables, { rpc: claimRpc(tables) }).client, { apply: true });
    expect(report.claimed).toEqual([{ schoolSlug: "sjsu", spotKey: "tower-hall-steps", imageUrl: url("portfolio-1"),
      evidence: "place", detail: 'photo location "Tower Hall steps" (manual)' }]);
    expect(tables[AUTO]).toHaveLength(1);
  });

  it("an incomplete read aborts the run before any release", async () => {
    const tables = bigLibrary();
    tables[AUTO] = [{ school_slug: "sjsu", spot_key: "tower-hall-steps", image_url: url("portfolio-1"), evidence: "place" }];
    const fake = fakeSupabase(tables, { rpc: claimRpc(tables), failRead: { table: "session_photos", fromRow: 1000 } });
    await expect(syncCampusSpotPhotos(fake.client, { apply: true })).rejects.toThrow(/session photo facts/);
    expect(fake.ops).toEqual([]);
    expect(tables[AUTO]).toHaveLength(1);
  });
});

describe("campus spot sync: photos that stop being public", () => {
  // A photo placed on the SJSU page explicitly (school_page_photos) whose session later lost marketing permission.
  function explicitRevoked() {
    const revoked = { ...SESSION, marketing_permission_revoked_at: "2026-10-20T00:00:00Z" };
    const photo = enginePhoto(5, { photography_sessions: revoked, photo_location: "Tower Hall steps", photo_location_source: "manual" });
    return {
      location_spots: [towerSteps],
      session_photos: [photo],
      school_page_photos: [{ id: "spp-1", school_slug: "sjsu", alt_override: null, caption: null, sort_order: 0, active: true,
        session_photos: { ...photo, photography_session_id: SESSION.id } }],
      [AUTO]: [{ school_slug: "sjsu", spot_key: "tower-hall-steps", image_url: url(5), evidence: "place" }],
    } as Record<string, Record<string, unknown>[]>;
  }

  it("the public page stops showing it at once", async () => {
    expect(await readPublicAutoRows(fakeSupabase(explicitRevoked()).client)).toEqual([]);
  });

  it("the sync releases it", async () => {
    const tables = explicitRevoked();
    const report = await syncCampusSpotPhotos(fakeSupabase(tables, { rpc: claimRpc(tables) }).client, { apply: true });
    expect(report.released.map((r) => r.reason)).toEqual(["the photo is no longer public for this school"]);
    expect(report.claimed).toEqual([]);
    expect(tables[AUTO]).toEqual([]);
  });
});

describe("campus spot sync: USF sections that left the page", () => {
  // The Lone Mountain stairs became a composition inside the Lone Mountain
  // card, so an automatic photo left on the old standalone section is released
  // and the same photo, still in the pool, fills the consolidated card.
  it("releases the stale stairs pick and re-fills the consolidated Lone Mountain card from it", async () => {
    const usfSession = { ...SESSION, school_slug: "usf", primary_location: "Lone Mountain stairs" };
    const tables: Record<string, Record<string, unknown>[]> = {
      location_spots: [],
      portfolio_images: [{ id: 7, title: "USF grad on the Lone Mountain stairs", alt: "USF grad on the Lone Mountain stairs",
        image_url: url("pf-7"), category_slug: "grads", featured: false, sort_order: 1, width: 1000, height: 1500,
        content_hash: "h-7", school: "usf", location: null, session_label: null, published: true }],
      session_photos: [enginePhoto(7, { photography_sessions: usfSession })],
      [AUTO]: [{ school_slug: "usf", spot_key: "lone-mountain-stairs", image_url: url("pf-7"), evidence: "text" }],
    };
    const report = await syncCampusSpotPhotos(fakeSupabase(tables, { rpc: claimRpc(tables) }).client, { apply: true });
    expect(report.released).toEqual([{
      row: { schoolSlug: "usf", spotKey: "lone-mountain-stairs", imageUrl: url("pf-7"), evidence: "text" },
      reason: "the spot is no longer on the page",
    }]);
    expect(report.claimed.map((c) => [c.schoolSlug, c.spotKey, c.imageUrl])).toEqual([["usf", "lone-mountain-palm-walkway", url("pf-7")]]);
    expect(tables[AUTO]).toEqual([{ school_slug: "usf", spot_key: "lone-mountain-palm-walkway", image_url: url("pf-7"), evidence: "session" }]);
    expect(tables.portfolio_images).toHaveLength(1);
    expect(tables.session_photos).toHaveLength(1);
    expect(report.unmatched.map((u) => u.spot)).not.toContain("usf → Lone Mountain Stairs");
  });
});
