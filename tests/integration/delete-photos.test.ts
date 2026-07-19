// Bulk photo deletion (admin trims an over-large upload): rows + originals go,
// published photos (live public derivative) are refused, foreign sessions are
// untouchable.
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";
import { deleteSessionPhotos } from "@/lib/contentEngine/deletePhotos";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";

beforeAll(() => resetDb());

async function storagePathOf(photoId: string) {
  const { data, error } = await service.from("session_photos")
    .select("storage_path").eq("id", photoId).single();
  if (error) throw error;
  return data.storage_path as string;
}

async function seedOriginal(path: string) {
  const { error } = await service.storage.from(ORIGINALS_BUCKET)
    .upload(path, Buffer.from("jpeg-bytes"), { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
}

describe("deleteSessionPhotos", () => {
  it("deletes rows and storage originals for unpublished photos", async () => {
    const sessionId = await createTestSession();
    const a = await createTestPhoto(sessionId, { derivative: false });
    const b = await createTestPhoto(sessionId, { derivative: false });
    const pathA = await storagePathOf(a.id);
    await seedOriginal(pathA);

    const result = await deleteSessionPhotos(service, sessionId, [a.id, b.id]);
    expect([...result.deleted].sort()).toEqual([a.id, b.id].sort());
    expect(result.skippedPublished).toEqual([]);

    const { data: rows } = await service.from("session_photos").select("id").in("id", [a.id, b.id]);
    expect(rows).toEqual([]);
    const { data: obj } = await service.storage.from(ORIGINALS_BUCKET).download(pathA);
    expect(obj).toBeNull();
  });

  it("skips photos with a live public derivative and deletes the rest", async () => {
    const sessionId = await createTestSession();
    const published = await createTestPhoto(sessionId); // helper default: has derivative
    const plain = await createTestPhoto(sessionId, { derivative: false });

    const result = await deleteSessionPhotos(service, sessionId, [published.id, plain.id]);
    expect(result.deleted).toEqual([plain.id]);
    expect(result.skippedPublished).toEqual([published.id]);

    const { data } = await service.from("session_photos").select("id").eq("id", published.id).maybeSingle();
    expect(data?.id).toBe(published.id);
  });

  it("ignores photo ids belonging to another session", async () => {
    const sessionId = await createTestSession();
    const other = await createTestSession();
    const foreign = await createTestPhoto(other, { derivative: false });

    const result = await deleteSessionPhotos(service, sessionId, [foreign.id]);
    expect(result.deleted).toEqual([]);
    expect(result.skippedPublished).toEqual([]);
    const { data } = await service.from("session_photos").select("id").eq("id", foreign.id).maybeSingle();
    expect(data?.id).toBe(foreign.id);
  });
});
