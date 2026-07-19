import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";
import { curateTopPicks } from "@/lib/contentEngine/curatePhotos";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

async function analyzedPhotos(sessionId: string, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const photo = await createTestPhoto(sessionId, { derivative: false, alt: `Grad portrait ${i}` });
    // varied scores so ordering in the prompt is meaningful
    await service.from("session_photos").update({ quality_score: (i % 10) + 1 }).eq("id", photo.id);
    ids.push(photo.id);
  }
  return ids;
}

// Candidate ids appear in the userText as JSON photo summaries.
function fakeModel(build: (candidateIds: string[]) => string): { caller: ModelCaller; calls: () => number } {
  let calls = 0;
  const caller: ModelCaller = async (req) => {
    calls++;
    const text = typeof req.messages[0].content === "string" ? req.messages[0].content : "";
    const ids = [...text.matchAll(/"session_photo_id":\s*"([0-9a-f-]{36})"/g)].map((m) => m[1]);
    return { text: build(ids), usage: { input_tokens: 10, output_tokens: 5 }, model: req.model };
  };
  return { caller, calls: () => calls };
}

async function excludedIds(sessionId: string): Promise<Set<string>> {
  const { data } = await service.from("session_photos")
    .select("id").eq("photography_session_id", sessionId).eq("excluded", true);
  return new Set((data ?? []).map((r) => r.id as string));
}

describe("curateTopPicks", () => {
  it("keeps the model's picks and excludes every other analyzed photo", async () => {
    const sessionId = await createTestSession();
    await analyzedPhotos(sessionId, 15);
    let pickedIds: string[] = [];
    const fake = fakeModel((ids) => {
      pickedIds = ids.slice(0, 12);
      return JSON.stringify({ picks: pickedIds });
    });

    const result = await curateTopPicks({ client: service, callModel: fake.caller, sessionId });
    expect(result).toEqual({ curated: true, total: 15, picked: 12, excluded: 3 });

    const excluded = await excludedIds(sessionId);
    expect(excluded.size).toBe(3);
    for (const id of pickedIds) expect(excluded.has(id)).toBe(false);
  });

  it("no-ops without a model call when the pool is at or under the pick count", async () => {
    const sessionId = await createTestSession();
    await analyzedPhotos(sessionId, 5);
    const fake = fakeModel((ids) => JSON.stringify({ picks: ids }));

    const result = await curateTopPicks({ client: service, callModel: fake.caller, sessionId });
    expect(result).toEqual({ curated: false, total: 5, picked: 5, excluded: 0 });
    expect(fake.calls()).toBe(0);
    expect((await excludedIds(sessionId)).size).toBe(0);
  });

  it("excludes NOTHING when the model returns the wrong number of picks", async () => {
    const sessionId = await createTestSession();
    await analyzedPhotos(sessionId, 15);
    const fake = fakeModel((ids) => JSON.stringify({ picks: ids.slice(0, 3) }));

    await expect(
      curateTopPicks({ client: service, callModel: fake.caller, sessionId }),
    ).rejects.toThrow(/picked 3 photo/i);
    expect((await excludedIds(sessionId)).size).toBe(0);
  });

  it("excludes NOTHING when the model invents a session_photo_id", async () => {
    const sessionId = await createTestSession();
    await analyzedPhotos(sessionId, 15);
    const fake = fakeModel((ids) => JSON.stringify({
      picks: [...ids.slice(0, 11), "99999999-9999-4999-8999-999999999999"],
    }));

    await expect(
      curateTopPicks({ client: service, callModel: fake.caller, sessionId }),
    ).rejects.toThrow(/unknown session_photo_id/i);
    expect((await excludedIds(sessionId)).size).toBe(0);
  });

  it("refuses a session without ai_processing_allowed", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(
      curateTopPicks({
        client: service, callModel: fakeModel((ids) => JSON.stringify({ picks: ids })).caller, sessionId,
      }),
    ).rejects.toThrow(/ai processing/i);
  });
});
