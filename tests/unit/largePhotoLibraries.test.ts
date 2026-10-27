// Libraries past PostgREST's 1000-row cap: every loader must read all rows
// (also when the server caps lower than the page size), and a sync must never
// act on a partial read.
import { describe, expect, it } from "vitest";
import { loadLibrary } from "@/lib/guidePhotoLibrary/load";
import { loadSessionLocation } from "@/lib/contentEngine/sessionLocation";
import { loadLibraryLocations } from "@/lib/locationLibrary/load";
import { syncAllSessions, syncSessionLocations } from "@/lib/locationLibrary/sync";
import { LOCATIONS_TABLE, LOCATION_SESSIONS_TABLE } from "@/lib/locationLibrary/taxonomy";
import { fakeSupabase, manyRows } from "./support/fakeSupabase";

const PALACE = { latitude: 37.8029, longitude: -122.4484 };
const LEGION = { latitude: 37.7845, longitude: -122.5008 };
const sid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

function sessionRow(i: number, over: Record<string, unknown> = {}) {
  return {
    id: sid(i), public_display_name: `Session ${i}`, internal_client_name: null, service_type: "couples",
    relationship_type: null, school_slug: null, primary_location: "Palace of Fine Arts", secondary_locations: [],
    session_date: "2026-05-01", start_time: null, lighting_condition: null, vibe: null,
    marketing_permission: true, marketing_permission_revoked_at: null, location_sync_status: null,
    location_sync_message: null, location_synced_at: null, created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`, ...over,
  };
}

function photoRow(i: number, sessionIndex: number, over: Record<string, unknown> = {}) {
  return {
    id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, photography_session_id: sid(sessionIndex),
    storage_path: `o/${i}.jpg`, public_derivative_url: `https://x/d/${i}.jpg`, excluded: false, quality_score: 7,
    sort_order: i, gps_latitude: null, gps_longitude: null, alt_text: null, title: null, description: null, tags: [],
    created_at: "2026-01-01T00:00:00Z", ...over,
  };
}

const palaceRow = { id: 1, title: "Palace of Fine Arts", slug: "palace-of-fine-arts", location_key: "palace-of-fine-arts",
  alias_keys: [], order: 1, active: true, image_url: null, featured_photo_id: null, featured_session_id: null };

describe("location library loads past 1000 rows", () => {
  // 1,200 sessions linked to the Palace, two photos each (2,400 photos).
  const tables = () => ({
    [LOCATIONS_TABLE]: [palaceRow],
    [LOCATION_SESSIONS_TABLE]: manyRows(1200, (i) => ({ id: `l-${String(i).padStart(5, "0")}`, location_id: 1,
      photography_session_id: sid(i), source: "auto", excluded: false })),
    photography_sessions: manyRows(1200, (i) => sessionRow(i)),
    session_photos: manyRows(2400, (i) => photoRow(i, i % 1200)),
  });

  it("counts every linked session and public photo", async () => {
    const [loc] = (await loadLibraryLocations(fakeSupabase(tables()).client)).locations;
    expect(loc.sessionCount).toBe(1200);
    expect(loc.publicPhotoCount).toBe(2400);
  });

  it("still reads everything when the server caps pages at 500", async () => {
    const [loc] = (await loadLibraryLocations(fakeSupabase(tables(), { serverCap: 500 }).client)).locations;
    expect(loc.publicPhotoCount).toBe(2400);
  });
});

describe("location sync on a session with more than 1000 photos", () => {
  // No typed location: the place comes from the photos' median GPS. The first
  // 1,000 frames are at the Legion of Honor, the other 1,350 at the Palace.
  const tables = () => ({
    [LOCATIONS_TABLE]: [palaceRow],
    [LOCATION_SESSIONS_TABLE]: [{ id: "l-1", location_id: 1, photography_session_id: sid(1), source: "auto", excluded: false }],
    photography_sessions: [sessionRow(1, { primary_location: null })],
    session_photos: manyRows(2350, (i) => photoRow(i, 1, {
      gps_latitude: (i < 1000 ? LEGION : PALACE).latitude, gps_longitude: (i < 1000 ? LEGION : PALACE).longitude,
    })),
  });

  it("uses every photo's GPS and keeps the right link", async () => {
    const report = await syncSessionLocations(fakeSupabase(tables()).client, sid(1));
    expect(report).toMatchObject({ status: "synced", linkedKeys: ["palace-of-fine-arts"], removedLinks: 0 });
  });

  it("a failed page makes the sync an error and removes nothing", async () => {
    const fake = fakeSupabase(tables(), { failRead: { table: "session_photos", fromRow: 1000 } });
    const report = await syncSessionLocations(fake.client, sid(1));
    expect(report.status).toBe("error");
    expect(fake.ops.filter((op) => op.table === LOCATION_SESSIONS_TABLE)).toEqual([]);
  });
});

describe("full location sync lists every session", () => {
  it("syncs all 1,200 sessions", async () => {
    const fake = fakeSupabase({
      [LOCATIONS_TABLE]: [palaceRow], [LOCATION_SESSIONS_TABLE]: [],
      photography_sessions: manyRows(1200, (i) => sessionRow(i)),
      session_photos: manyRows(1200, (i) => photoRow(i, i)),
    });
    expect((await syncAllSessions(fake.client)).sessions).toHaveLength(1200);
  });
});

describe("guide photo library and session location past 1000 rows", () => {
  it("the picker library loads every session and photo", async () => {
    const fake = fakeSupabase({
      photography_sessions: manyRows(1200, (i) => sessionRow(i)),
      session_photos: manyRows(2350, (i) => photoRow(i, i % 1200)),
    }, { serverCap: 500 });
    const lib = await loadLibrary(fake.client, { kind: "guide", guide: "couples", slug: "palace-of-fine-arts" });
    expect(lib.sessions.size).toBe(1200);
    expect(lib.photos).toHaveLength(2350);
  });

  it("a session's location evidence uses every photo", async () => {
    const fake = fakeSupabase({
      session_photos: manyRows(2350, (i) => photoRow(i, 1, {
        gps_latitude: (i < 1000 ? LEGION : PALACE).latitude, gps_longitude: (i < 1000 ? LEGION : PALACE).longitude,
      })),
    });
    const { resolution } = await loadSessionLocation(fake.client, sid(1), null);
    expect(resolution.status === "verified" && resolution.place.key).toBe("palace-of-fine-arts");
  });
});
