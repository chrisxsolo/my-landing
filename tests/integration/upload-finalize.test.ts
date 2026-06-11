// Note: the oversized (>25 MB) path is unit-tested in imageVerification with an
// injected cap and kept out of integration tests for speed.
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { service, resetDb, createTestSession } from "./helpers";
import { finalizeUpload, UploadFinalizationError } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";

beforeAll(() => resetDb());

async function jpeg(width = 80, height = 60) {
  return sharp({ create: { width, height, channels: 3, background: { r: 100, g: 150, b: 130 } } })
    .jpeg().toBuffer();
}

async function uploadRaw(path: string, body: Buffer, contentType: string) {
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}

describe("finalizeUpload (spec §4.2)", () => {
  it("inserts a session_photos row with the SERVER-computed hash and dimensions", async () => {
    const sessionId = await createTestSession();
    const path = issueUploadPath(sessionId, "image/jpeg");
    const buf = await jpeg(80, 60);
    await uploadRaw(path, buf, "image/jpeg");

    const row = await finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "shot.jpg", mime: "image/jpeg", sizeBytes: 999, contentHash: "client-claimed-bogus" },
    });

    expect(row.width).toBe(80);
    expect(row.height).toBe(60);
    expect(row.content_hash).not.toBe("client-claimed-bogus");
    expect(row.content_hash).toHaveLength(64); // sha256 hex
    expect(row.storage_path).toBe(path);
    expect(row.analysis_status).toBe("pending");

    const { data } = await service.from("session_photos").select("id,content_hash,width,height").eq("id", row.id).single();
    expect(data!.content_hash).toBe(row.content_hash);
  });

  it("rejects a path belonging to another session and deletes nothing it doesn't own", async () => {
    const sessionId = await createTestSession();
    const other = await createTestSession();
    const path = issueUploadPath(other, "image/jpeg"); // foreign path
    await uploadRaw(path, await jpeg(), "image/jpeg");

    await expect(finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "x.jpg", mime: "image/jpeg", sizeBytes: 1, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);

    // The foreign object must remain (we only delete objects we own + reject).
    const { data } = await service.storage.from(ORIGINALS_BUCKET).download(path);
    expect(data).not.toBeNull();
  });

  it("rejects non-image bytes and deletes the invalid object", async () => {
    const sessionId = await createTestSession();
    const path = issueUploadPath(sessionId, "image/jpeg");
    await uploadRaw(path, Buffer.from("definitely not an image"), "image/jpeg");

    await expect(finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "x.jpg", mime: "image/jpeg", sizeBytes: 1, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);

    const { data } = await service.storage.from(ORIGINALS_BUCKET).download(path);
    expect(data).toBeNull(); // invalid object cleaned up (spec §4.2 step 6)
  });

  it("rejects a duplicate source hash within the same session (unique constraint)", async () => {
    const sessionId = await createTestSession();
    const buf = await jpeg(120, 90);

    const p1 = issueUploadPath(sessionId, "image/jpeg");
    await uploadRaw(p1, buf, "image/jpeg");
    await finalizeUpload({
      client: service, sessionId, storagePath: p1,
      declared: { filename: "a.jpg", mime: "image/jpeg", sizeBytes: buf.length, contentHash: "x" },
    });

    const p2 = issueUploadPath(sessionId, "image/jpeg");
    await uploadRaw(p2, buf, "image/jpeg"); // identical bytes → identical server hash
    await expect(finalizeUpload({
      client: service, sessionId, storagePath: p2,
      declared: { filename: "b.jpg", mime: "image/jpeg", sizeBytes: buf.length, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);

    // p1's object must still be downloadable — the winner's row must not be orphaned.
    const { data: d1 } = await service.storage.from(ORIGINALS_BUCKET).download(p1);
    expect(d1).not.toBeNull();

    // p2 is a different-path duplicate orphan; on 23505 we never delete eagerly
    // (TOCTOU-safe) — the deferred cleanup sweep (spec §4.4) reclaims it.
    const { data: d2 } = await service.storage.from(ORIGINALS_BUCKET).download(p2);
    expect(d2).not.toBeNull();
  });

  it("rejects a path whose object does not exist in storage", async () => {
    const sessionId = await createTestSession();
    const path = `originals/${sessionId}/${randomUUID()}.jpg`; // owned shape, never uploaded
    await expect(finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "x.jpg", mime: "image/jpeg", sizeBytes: 1, contentHash: "x" },
    })).rejects.toBeInstanceOf(UploadFinalizationError);
  });

  it("same-path double-finalize: loser must not delete the winner's object", async () => {
    const sessionId = await createTestSession();
    const path = issueUploadPath(sessionId, "image/jpeg");
    const buf = await jpeg(99, 77);
    await uploadRaw(path, buf, "image/jpeg");

    const call = () => finalizeUpload({
      client: service, sessionId, storagePath: path,
      declared: { filename: "dbl.jpg", mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
    });
    const results = await Promise.allSettled([call(), call()]);
    const wins = results.filter((r) => r.status === "fulfilled");
    expect(wins.length).toBeGreaterThanOrEqual(1); // ≥1 wins; a tie-loser rejects

    // Exactly one row, and its object must still be downloadable.
    const { count } = await service.from("session_photos")
      .select("id", { count: "exact", head: true }).eq("storage_path", path);
    expect(count).toBe(1);
    const { data } = await service.storage.from(ORIGINALS_BUCKET).download(path);
    expect(data).not.toBeNull();
  });
});
