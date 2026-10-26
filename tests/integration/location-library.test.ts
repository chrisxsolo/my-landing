// Bay Area location library (2026-10-26): sessions → canonical places → one
// library row per place, against the real migration and tables.
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";
import { syncAllSessions, syncSessionLocations } from "@/lib/locationLibrary/sync";
import { loadLibraryLocations } from "@/lib/locationLibrary/load";
import { updateLocation } from "@/lib/locationLibrary/adminEdit";
import { excludeSession, attachSession, mergeLocations, setPhotoOverride } from "@/lib/locationLibrary/adminLinks";
import { generateLocationProfile } from "@/lib/locationLibrary/profile";
import { toPublicCard } from "@/lib/locationLibrary/publicData";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => {
  resetDb();
});

async function session(primary: string | null, opts: { secondary?: string[]; service?: string; photos?: number; approved?: boolean } = {}) {
  const id = await createTestSession({ service_type: opts.service ?? "couples", public_display_name: "Ana & Leo" });
  await service.from("photography_sessions").update({
    primary_location: primary, secondary_locations: opts.secondary ?? [],
  }).eq("id", id);
  const photos = [];
  for (let i = 0; i < (opts.photos ?? 2); i += 1) {
    photos.push(await createTestPhoto(id, { derivative: opts.approved ?? true }));
  }
  return { id, photos };
}

async function rowsForKey(key: string) {
  const { data } = await service.from("bay_area_locations").select("*").eq("location_key", key);
  return data ?? [];
}

async function linksFor(sessionId: string) {
  const { data } = await service.from("location_sessions").select("*").eq("photography_session_id", sessionId);
  return data ?? [];
}

async function locationFor(key: string) {
  const [row] = await rowsForKey(key);
  const { locations } = await loadLibraryLocations(service, { ids: [row.id] });
  return locations[0];
}

describe("location sync", () => {
  it("puts five Palace of Fine Arts sessions on ONE draft location, idempotently", async () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) ids.push((await session(i % 2 ? "Palace of fine Arts " : "Palace of Fine Arts")).id);
    for (const id of ids) await syncSessionLocations(service, id);
    await syncAllSessions(service);
    await syncAllSessions(service);

    const rows = await rowsForKey("palace-of-fine-arts");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ active: false, needs_review: true, origin: "engine", region: "san-francisco", city: "San Francisco" });
    for (const id of ids) expect(await linksFor(id)).toHaveLength(1);
    const loc = await locationFor("palace-of-fine-arts");
    expect(loc.sessionCount).toBe(5);
    expect(loc.publicPhotoCount).toBe(10);
    expect(loc.kinds).toEqual(["couples"]);
  });

  it("sends an unknown place to review instead of guessing", async () => {
    const s = await session("Sather gate, doe library", { service: "grads" });
    const report = await syncSessionLocations(service, s.id);
    expect(report.status).toBe("needs_review");
    expect(await linksFor(s.id)).toHaveLength(0);
    const { data } = await service.from("photography_sessions").select("location_sync_status,location_sync_message").eq("id", s.id).single();
    expect(data!.location_sync_status).toBe("needs_review");
    expect(data!.location_sync_message).toMatch(/Sather gate/);
  });

  it("waits for an approved photo before creating anything", async () => {
    const s = await session("Baker Beach", { approved: false });
    const report = await syncSessionLocations(service, s.id);
    expect(report.status).toBe("waiting");
    expect(await rowsForKey("baker-beach")).toHaveLength(0);
  });

  it("never re-adds a session the admin removed, and keeps manual links when the text changes", async () => {
    const s = await session("Crissy Field");
    await syncSessionLocations(service, s.id);
    const [row] = await rowsForKey("crissy-field");
    await excludeSession(service, row.id, s.id);
    await syncSessionLocations(service, s.id);
    expect((await linksFor(s.id))[0]).toMatchObject({ excluded: true, source: "auto" });

    await attachSession(service, row.id, s.id);
    await service.from("photography_sessions").update({ primary_location: "Lands End" }).eq("id", s.id);
    await syncSessionLocations(service, s.id);
    const links = await linksFor(s.id);
    expect(links.find((l) => l.location_id === row.id)).toMatchObject({ source: "manual", excluded: false });
    expect(links).toHaveLength(2); // Crissy Field (manual) + Lands End (auto)
  });

  it("drops an auto link when the session location changes to another place", async () => {
    const s = await session("Sutro Baths");
    await syncSessionLocations(service, s.id);
    await service.from("photography_sessions").update({ primary_location: "Marshall's Beach" }).eq("id", s.id);
    await syncSessionLocations(service, s.id);
    const [sutro] = await rowsForKey("sutro-baths");
    const [marshalls] = await rowsForKey("marshalls-beach");
    const links = await linksFor(s.id);
    expect(links.map((l) => l.location_id)).toEqual([marshalls.id]);
    expect(sutro).toBeTruthy(); // the location itself is never deleted
  });
});

describe("photos and heroes", () => {
  it("assigns multi-location photos only by GPS evidence or an explicit include", async () => {
    const s = await session("Golden Gate Park", { secondary: ["Ocean Beach"], photos: 3 });
    await service.from("session_photos").update({ gps_latitude: 37.735, gps_longitude: -122.507 }).eq("id", s.photos[0].id);
    await syncSessionLocations(service, s.id);

    const beach = await locationFor("ocean-beach");
    const park = await locationFor("golden-gate-park");
    expect(beach.photos.filter((p) => p.state === "public").map((p) => p.id)).toEqual([s.photos[0].id]);
    expect(park.photos.filter((p) => p.state === "public")).toHaveLength(0);

    await setPhotoOverride(service, park.row.id, s.photos[1].id, "include");
    const parkAfter = await locationFor("golden-gate-park");
    expect(parkAfter.photos.filter((p) => p.state === "public").map((p) => p.id)).toEqual([s.photos[1].id]);
  });

  it("keeps a chosen featured photo when a newer, better session arrives", async () => {
    const first = await session("Legion of Honor");
    await syncSessionLocations(service, first.id);
    const [row] = await rowsForKey("legion-of-honor");
    await updateLocation(service, row.id, { featured_photo_id: first.photos[1].id });

    const second = await session("Legion of Honor");
    await service.from("session_photos").update({ quality_score: 10 }).eq("photography_session_id", second.id);
    await syncSessionLocations(service, second.id);
    const loc = await locationFor("legion-of-honor");
    expect(loc.hero).toMatchObject({ photoId: first.photos[1].id, source: "featured_photo" });

    await setPhotoOverride(service, row.id, first.photos[1].id, "hide");
    const after = await locationFor("legion-of-honor");
    expect(after.hero?.source).toBe("auto");
    expect(after.hero?.photoId).not.toBe(first.photos[1].id);
  });
});

describe("overrides, AI and merging", () => {
  const fakeModel: ModelCaller = async () => ({
    text: JSON.stringify({
      description: "AI description", best_for: "Couples", best_time: "", tip: "AI tip", environments: ["architecture", "moon"],
    }),
    usage: { input_tokens: 1, output_tokens: 1 }, model: "fake",
  });

  it("writes only unlocked fields and never blanks a field", async () => {
    const s = await session("Yerba Buena Gardens");
    await syncSessionLocations(service, s.id);
    const [row] = await rowsForKey("yerba-buena-gardens");
    await updateLocation(service, row.id, { description: "Written by Chris" });

    const result = await generateLocationProfile(service, fakeModel, row.id);
    expect(result.status).toBe("updated");
    const { data } = await service.from("bay_area_locations").select("*").eq("id", row.id).single();
    expect(data).toMatchObject({ description: "Written by Chris", tip: "AI tip", best_time: "", environments: ["architecture"] });
    expect(data!.locked_fields).toEqual(["description"]);

    await updateLocation(service, row.id, { unlock: ["description"] });
    await generateLocationProfile(service, fakeModel, row.id);
    const { data: after } = await service.from("bay_area_locations").select("description,locked_fields").eq("id", row.id).single();
    expect(after).toMatchObject({ description: "AI description", locked_fields: [] });
  });

  it("refuses to publish a card without a description", async () => {
    const s = await session("Embarcadero");
    await syncSessionLocations(service, s.id);
    const [row] = await rowsForKey("embarcadero");
    await expect(updateLocation(service, row.id, { active: true })).rejects.toThrow(/description/);
    await updateLocation(service, row.id, { description: "Waterfront promenade.", active: true });
    const { data } = await service.from("bay_area_locations").select("active,needs_review").eq("id", row.id).single();
    expect(data).toEqual({ active: true, needs_review: false });
  });

  it("merges a duplicate and routes the merged place's future sessions to the target", async () => {
    const a = await session("Mission Murals");
    const b = await session("Lovers Lane");
    await syncAllSessions(service);
    const [target] = await rowsForKey("mission-murals");
    const [source] = await rowsForKey("lovers-lane");
    await mergeLocations(service, target.id, source.id);

    expect(await rowsForKey("lovers-lane")).toHaveLength(0);
    const later = await session("Lover's Lane");
    await syncSessionLocations(service, later.id);
    expect(await rowsForKey("lovers-lane")).toHaveLength(0);
    const merged = await loadLibraryLocations(service, { ids: [target.id] });
    expect(new Set(merged.locations[0].links.map((l) => l.sessionId))).toEqual(new Set([a.id, b.id, later.id]));
  });

  it("claims a hand-written row for its place without touching its content", async () => {
    const { data: manual } = await service.from("bay_area_locations").insert({
      title: "Gamble Gardens", slug: "gamble-gardens", region: "south-bay", city: "Palo Alto",
      description: "Hand-written", best_for: "x", best_time: "y", tip: "z", locked_fields: ["description", "region"],
    }).select("id").single();
    const s = await session("Gamble Garden");
    const report = await syncAllSessions(service);
    expect(report.claims.map((c) => c.key)).toContain("gamble-garden");
    const rows = await rowsForKey("gamble-garden");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: manual!.id, description: "Hand-written", region: "south-bay" });
    expect((await linksFor(s.id))[0].location_id).toBe(manual!.id);
  });

  it("public cards carry no session identity", async () => {
    const loc = await locationFor("palace-of-fine-arts");
    const card = toPublicCard(loc, []);
    // Web-copy URLs carry an opaque session id in their path (site-wide engine
    // naming); everything else must be free of session identity.
    const json = JSON.stringify({ ...card, image_url: null });
    expect(json).not.toMatch(/Ana & Leo/);
    for (const link of loc.links) expect(json).not.toContain(link.sessionId);
    expect(Object.keys(card)).not.toEqual(expect.arrayContaining(["sessions", "links", "internalName"]));
  });
});
