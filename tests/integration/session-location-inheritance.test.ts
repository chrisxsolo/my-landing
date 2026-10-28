// Session-location inheritance against the real database: a session whose
// facts name exactly one location fills its blank photos (and a fresh upload)
// with that location as session evidence, follows changes to the facts on
// inherited values only, never touches a manual or GPS location, records
// every change in photo_change_log, is idempotent, and the deployment
// backfill repairs UC Law-style rows the same way.
import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { syncSessionLocationInheritance, syncSessionLocationInheritanceSummary } from "@/lib/photoTagging/inheritLocationSync";

beforeAll(() => resetDb());

const PALACE = "Palace of Fine Arts";
const LOCATION_COLUMNS = "id,photo_location,photo_location_source,photo_location_evidence,photo_location_confirmed_at";

interface LocationRow {
  id: string; photo_location: string | null; photo_location_source: string | null;
  photo_location_evidence: string | null; photo_location_confirmed_at: string | null;
}

async function locationOf(photoId: string): Promise<LocationRow> {
  const { data, error } = await service.from("session_photos").select(LOCATION_COLUMNS).eq("id", photoId).single();
  if (error) throw error;
  return data as LocationRow;
}

async function setFacts(sessionId: string, facts: { primary_location?: string | null; secondary_locations?: string[] }) {
  const { error } = await service.from("photography_sessions").update(facts).eq("id", sessionId);
  if (error) throw error;
}

async function setLocation(photoId: string, location: string, source: "manual" | "gps", evidence: string) {
  const { error } = await service.from("session_photos").update({
    photo_location: location, photo_location_source: source, photo_location_evidence: evidence,
    photo_location_confirmed_at: new Date().toISOString(),
  }).eq("id", photoId);
  if (error) throw error;
}

const inherited = (location: string) => ({ photo_location: location, photo_location_source: "manual", photo_location_evidence: "session" });

describe("one explicit session location", () => {
  it("fills every blank included photo as session evidence, with a confirmation stamp and a history row", async () => {
    const sessionId = await createTestSession();
    await setFacts(sessionId, { primary_location: `  ${PALACE}  `, secondary_locations: [] });
    const [a, b, excluded] = await Promise.all([createTestPhoto(sessionId), createTestPhoto(sessionId), createTestPhoto(sessionId)]);
    await service.from("session_photos").update({ excluded: true }).eq("id", excluded.id);

    const result = await syncSessionLocationInheritance(service, sessionId);
    expect(result).toMatchObject({ updated: 2, failed: 0 });

    for (const photo of [a, b]) {
      const row = await locationOf(photo.id);
      expect(row).toMatchObject(inherited(PALACE));
      expect(row.photo_location_confirmed_at).not.toBeNull();
    }
    expect((await locationOf(excluded.id)).photo_location).toBeNull();

    const { data: log } = await service.from("photo_change_log").select("photo_key,field,old_value,new_value,actor,reason")
      .in("photo_key", [`engine:${a.id}`, `engine:${b.id}`]);
    expect(log).toHaveLength(2);
    expect(log![0]).toMatchObject({ field: "location", old_value: null, new_value: PALACE, actor: "system" });

    // Idempotent: nothing left to write.
    expect(await syncSessionLocationInheritance(service, sessionId)).toMatchObject({ updated: 0, failed: 0 });
  });

  it("gives a new upload the session's location on the server, by photo id", async () => {
    const sessionId = await createTestSession();
    await setFacts(sessionId, { primary_location: PALACE, secondary_locations: [] });
    const older = await createTestPhoto(sessionId);
    const path = issueUploadPath(sessionId, "image/jpeg");
    const buf = await sharp({ create: { width: 80, height: 60, channels: 3, background: { r: 90, g: 120, b: 140 } } }).jpeg().toBuffer();
    const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    const row = await finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "new.jpg", mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
    });

    const summary = await syncSessionLocationInheritanceSummary(service, sessionId, { photoIds: [row.id], reason: "photo uploaded" });
    expect(summary).toEqual({ updated: 1, failed: 0, error: null });
    expect(await locationOf(row.id)).toMatchObject(inherited(PALACE));
    // Scoped to the upload: the older blank photo waits for the session-wide sync.
    expect((await locationOf(older.id)).photo_location).toBeNull();
  });

  it("never overwrites a manual or GPS location, and assigns nothing for a multi-location session", async () => {
    const sessionId = await createTestSession();
    await setFacts(sessionId, { primary_location: PALACE, secondary_locations: [] });
    const [manual, gps, blank] = await Promise.all([createTestPhoto(sessionId), createTestPhoto(sessionId), createTestPhoto(sessionId)]);
    await setLocation(manual.id, "Crissy Field", "manual", "manual");
    await setLocation(gps.id, "Baker Beach", "gps", "gps");

    await syncSessionLocationInheritance(service, sessionId);
    expect(await locationOf(manual.id)).toMatchObject({ photo_location: "Crissy Field", photo_location_evidence: "manual" });
    expect(await locationOf(gps.id)).toMatchObject({ photo_location: "Baker Beach", photo_location_evidence: "gps" });
    expect(await locationOf(blank.id)).toMatchObject(inherited(PALACE));

    const multi = await createTestSession();
    await setFacts(multi, { primary_location: PALACE, secondary_locations: ["Legion of Honor"] });
    const photo = await createTestPhoto(multi);
    expect(await syncSessionLocationInheritance(service, multi)).toMatchObject({ updated: 0 });
    expect((await locationOf(photo.id)).photo_location).toBeNull();
  });
});

describe("when the facts change", () => {
  async function seeded() {
    const sessionId = await createTestSession();
    await setFacts(sessionId, { primary_location: PALACE, secondary_locations: [] });
    const [inheritedPhoto, manual, gps] = await Promise.all([createTestPhoto(sessionId), createTestPhoto(sessionId), createTestPhoto(sessionId)]);
    await setLocation(manual.id, PALACE, "manual", "manual");
    await setLocation(gps.id, PALACE, "gps", "gps");
    await syncSessionLocationInheritance(service, sessionId);
    expect(await locationOf(inheritedPhoto.id)).toMatchObject(inherited(PALACE));
    return { sessionId, inheritedPhoto, manual, gps };
  }

  it("one location → another: only inherited values move", async () => {
    const { sessionId, inheritedPhoto, manual, gps } = await seeded();
    await setFacts(sessionId, { primary_location: "Crissy Field" });
    expect(await syncSessionLocationInheritance(service, sessionId)).toMatchObject({ updated: 1, failed: 0 });
    expect(await locationOf(inheritedPhoto.id)).toMatchObject(inherited("Crissy Field"));
    expect((await locationOf(manual.id)).photo_location).toBe(PALACE);
    expect((await locationOf(gps.id)).photo_location).toBe(PALACE);
  });

  it("one location → several: only inherited values are cleared", async () => {
    const { sessionId, inheritedPhoto, manual, gps } = await seeded();
    await setFacts(sessionId, { secondary_locations: ["Legion of Honor"] });
    expect(await syncSessionLocationInheritance(service, sessionId)).toMatchObject({ updated: 1, failed: 0 });
    expect(await locationOf(inheritedPhoto.id)).toMatchObject({ photo_location: null, photo_location_source: null, photo_location_evidence: null, photo_location_confirmed_at: null });
    expect((await locationOf(manual.id)).photo_location).toBe(PALACE);
    expect((await locationOf(gps.id)).photo_location).toBe(PALACE);
  });

  it("one location → none: only inherited values are cleared, and a retry is a no-op", async () => {
    const { sessionId, inheritedPhoto, manual } = await seeded();
    await setFacts(sessionId, { primary_location: null });
    expect(await syncSessionLocationInheritance(service, sessionId)).toMatchObject({ updated: 1, failed: 0 });
    expect((await locationOf(inheritedPhoto.id)).photo_location).toBeNull();
    expect((await locationOf(manual.id)).photo_location).toBe(PALACE);
    expect(await syncSessionLocationInheritance(service, sessionId)).toMatchObject({ updated: 0, failed: 0 });
  });

  it("reports a session that does not exist as a failed sync, never a silent success", async () => {
    const summary = await syncSessionLocationInheritanceSummary(service, "00000000-0000-4000-8000-000000000000");
    expect(summary.failed).toBe(1);
    expect(summary.error).toMatch(/not found/);
  });
});

describe("the deployment backfill (20261027000033)", () => {
  const dbUrl = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const psql = ["psql", "/opt/homebrew/opt/libpq/bin/psql", "/usr/local/opt/libpq/bin/psql"].find((p) => p === "psql" || existsSync(p)) ?? "psql";
  const run = (file: string) => execFileSync(psql, [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", file], { stdio: "pipe" });

  it("repairs UC Law-style rows, leaves manual / GPS / multi-location rows alone, verifies, and rolls back cleanly", async () => {
    const single = await createTestSession();
    await setFacts(single, { primary_location: PALACE, secondary_locations: [] });
    const [blank, manual, excluded] = await Promise.all([createTestPhoto(single), createTestPhoto(single), createTestPhoto(single)]);
    await setLocation(manual.id, "Crissy Field", "manual", "manual");
    await service.from("session_photos").update({ excluded: true }).eq("id", excluded.id);
    const multi = await createTestSession();
    await setFacts(multi, { primary_location: PALACE, secondary_locations: ["Legion of Honor"] });
    const multiPhoto = await createTestPhoto(multi);

    run("supabase/migrations/20261027000033_session_location_inheritance.sql");
    run("supabase/migrations/20261027000033_session_location_inheritance_verify.sql");
    expect(await locationOf(blank.id)).toMatchObject(inherited(PALACE));
    expect((await locationOf(blank.id)).photo_location_confirmed_at).not.toBeNull();
    expect(await locationOf(manual.id)).toMatchObject({ photo_location: "Crissy Field", photo_location_evidence: "manual" });
    expect((await locationOf(excluded.id)).photo_location).toBeNull();
    expect((await locationOf(multiPhoto.id)).photo_location).toBeNull();
    const { data: log } = await service.from("photo_change_log").select("actor,reason,new_value").eq("photo_key", `engine:${blank.id}`);
    expect(log).toEqual([{ actor: "system", reason: "backfill: inherited the session's only location", new_value: PALACE }]);

    // Idempotent: a second run writes nothing more.
    run("supabase/migrations/20261027000033_session_location_inheritance.sql");
    expect((await service.from("photo_change_log").select("id").eq("photo_key", `engine:${blank.id}`)).data).toHaveLength(1);

    run("supabase/migrations/20261027000033_session_location_inheritance_rollback.sql");
    expect((await locationOf(blank.id)).photo_location).toBeNull();
    expect((await locationOf(manual.id)).photo_location).toBe("Crissy Field");
    expect((await service.from("photo_change_log").select("id").eq("photo_key", `engine:${blank.id}`)).data).toHaveLength(0);
  });
});
