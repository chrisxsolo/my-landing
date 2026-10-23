import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { analysisRunMarker, runAnalysis } from "@/lib/contentEngine/analyzePhotos";
import Anthropic from "@anthropic-ai/sdk";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

// Real bytes in real storage: upload + finalize like production does.
// Seed varies the DIMENSIONS (not just color): JPEG quantization collapses
// near-identical solid colors to identical bytes, which would trip the
// unique (session, content_hash) constraint.
async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 300 + seed * 2, height: 240, channels: 3, background: { r: (seed * 40) % 255, g: 120, b: 90 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  return finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `p${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
}

function analysisJson(ids: string[]) {
  return JSON.stringify({
    photos: ids.map((id) => ({
      session_photo_id: id, alt_text: "Grad at Tower Lawn golden hour", title: "Tower Lawn",
      description: "Backlit portrait", tags: ["sjsu", "golden hour"], quality_score: 8,
      suggested_category: "grads", destination_recommendations: { portfolio: true },
    })),
  });
}

function fakeModel(buildText: (idsInPrompt: string[]) => string): { caller: ModelCaller; calls: number[] } {
  const calls: number[] = [];
  const caller: ModelCaller = async (req) => {
    // ids appear in the user text block (spec: results keyed by session_photo_id)
    const textBlock = (req.messages[0].content as { type: string; text?: string }[])
      .filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const ids = [...textBlock.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)]
      .map((m) => m[0]);
    const imageBlocks = (req.messages[0].content as { type: string }[]).filter((b) => b.type === "image");
    calls.push(imageBlocks.length);
    return { text: buildText([...new Set(ids)]), usage: { input_tokens: 1234, output_tokens: 567 }, model: req.model };
  };
  return { caller, calls };
}

const noSleep = async () => {};

async function statusOf(id: string) {
  const { data } = await service.from("session_photos")
    .select("analysis_status,analysis_error,quality_score").eq("id", id).single();
  return data!;
}

describe("runAnalysis (spec §8.1, one photo per call)", () => {
  it("analyzes every photo with one image per call and commits each result", async () => {
    const sessionId = await createTestSession();
    const p1 = await realPhoto(sessionId, 1);
    const p2 = await realPhoto(sessionId, 2);
    const fake = fakeModel((ids) => analysisJson(ids));

    const result = await runAnalysis({ client: service, callModel: fake.caller, sessionId });
    expect(result).toMatchObject({ claimed: 2, completed: 2, failed: 0, remaining: 0 });
    expect(fake.calls).toEqual([1, 1]); // one image block per call

    const { data: rows } = await service.from("session_photos")
      .select("id,analysis_status,alt_text,quality_score,analysis_model,analysis_version,analysis_payload")
      .in("id", [p1.id, p2.id]);
    for (const row of rows!) {
      expect(row.analysis_status).toBe("completed");
      expect(row.alt_text).toBe("Grad at Tower Lawn golden hour");
      expect(row.quality_score).toBe(8);
      expect(row.analysis_model).toBe("claude-sonnet-4-6");
      expect(row.analysis_version).toBe(PROMPT_VERSION);
      expect(row.analysis_payload.usage.input_tokens).toBe(1234);
    }
  });

  it("runs photos concurrently, up to the requested lanes", async () => {
    const sessionId = await createTestSession();
    for (let i = 20; i < 26; i++) await realPhoto(sessionId, i);
    let inFlight = 0;
    let peak = 0;
    const caller: ModelCaller = async (req) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 40));
      inFlight -= 1;
      return fakeModel((ids) => analysisJson(ids)).caller(req);
    };
    const result = await runAnalysis({ client: service, callModel: caller, sessionId, concurrency: 3 });
    expect(result.completed).toBe(6);
    expect(peak).toBe(3);
  });

  it("keeps a mistyped id from failing the photo — the result binds to the photo sent", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 3);
    const fake = fakeModel(() => analysisJson(["99999999-9999-4999-8999-999999999999"]));
    const result = await runAnalysis({ client: service, callModel: fake.caller, sessionId });
    expect(result.completed).toBe(1);
    expect((await statusOf(photo.id)).analysis_status).toBe("completed");
  });

  it("isolates a failing photo: the others still complete", async () => {
    const sessionId = await createTestSession();
    const good = await realPhoto(sessionId, 30);
    const bad = await realPhoto(sessionId, 31);
    const fake = fakeModel((ids) => (ids.includes(bad.id) ? "not json at all" : analysisJson(ids)));

    const result = await runAnalysis({ client: service, callModel: fake.caller, sessionId, sleep: noSleep });
    expect(result).toMatchObject({ completed: 1, failed: 1, remaining: 0 });
    expect(result.errors[0]).toMatch(/no JSON object/i);
    expect((await statusOf(good.id)).analysis_status).toBe("completed");
    const failed = await statusOf(bad.id);
    expect(failed.analysis_status).toBe("failed");
    expect(failed.analysis_error).toMatch(/no JSON object/i);
  });

  it("retries a transient API failure and succeeds", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 4);
    const ok = fakeModel((ids) => analysisJson(ids));
    let calls = 0;
    const flaky: ModelCaller = async (req) => {
      calls += 1;
      if (calls === 1) throw Anthropic.APIError.generate(529, { error: { message: "overloaded" } }, "overloaded", new Headers());
      return ok.caller(req);
    };
    const result = await runAnalysis({ client: service, callModel: flaky, sessionId, sleep: noSleep });
    expect(calls).toBe(2);
    expect(result.completed).toBe(1);
    expect((await statusOf(photo.id)).analysis_status).toBe("completed");
  });

  it("does not retry a request the API rejected outright", async () => {
    const sessionId = await createTestSession();
    await realPhoto(sessionId, 5);
    let calls = 0;
    const rejecting: ModelCaller = async () => {
      calls += 1;
      throw Anthropic.APIError.generate(400, { error: { message: "bad image" } }, "bad image", new Headers());
    };
    const result = await runAnalysis({ client: service, callModel: rejecting, sessionId, sleep: noSleep });
    expect(calls).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("leaves photos that already failed in this run for the admin instead of looping", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 6);
    const runStart = await analysisRunMarker(service, sessionId);
    const broken = fakeModel(() => "not json");
    await runAnalysis({ client: service, callModel: broken.caller, sessionId, attemptedSince: runStart, sleep: noSleep });
    expect((await statusOf(photo.id)).analysis_status).toBe("failed");

    const again = fakeModel((ids) => analysisJson(ids));
    const second = await runAnalysis({ client: service, callModel: again.caller, sessionId, attemptedSince: runStart });
    expect(second).toMatchObject({ claimed: 0, remaining: 0 });
    expect(again.calls).toEqual([]);

    // A new run (the admin's Retry) does pick it up.
    const retry = await runAnalysis({
      client: service, callModel: again.caller, sessionId,
      attemptedSince: await analysisRunMarker(service, sessionId),
    });
    expect(retry.completed).toBe(1);
  });

  it("never analyzes a photo twice when two runs race on the same session", async () => {
    const sessionId = await createTestSession();
    for (let i = 40; i < 48; i++) await realPhoto(sessionId, i);
    const seen: string[] = [];
    const counting: ModelCaller = async (req) => {
      const text = (req.messages[0].content as { type: string; text?: string }[])
        .filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const ids = [...new Set([...text.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].map((m) => m[0]))];
      seen.push(...ids);
      await new Promise((r) => setTimeout(r, 15));
      return { text: analysisJson(ids), usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
    };
    const [a, b] = await Promise.all([
      runAnalysis({ client: service, callModel: counting, sessionId, concurrency: 4 }),
      runAnalysis({ client: service, callModel: counting, sessionId, concurrency: 4 }),
    ]);
    expect(a.completed + b.completed).toBe(8);
    expect(new Set(seen).size).toBe(seen.length); // no photo sent twice
  });

  it("stops claiming new photos once asked to stop (cancellation)", async () => {
    const sessionId = await createTestSession();
    for (let i = 50; i < 55; i++) await realPhoto(sessionId, i);
    let checks = 0;
    const result = await runAnalysis({
      client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId,
      concurrency: 1, shouldStop: async () => ++checks > 2,
    });
    expect(result.completed).toBe(2);
    expect(result.remaining).toBe(3);
  });

  it("returns zeros when nothing is eligible", async () => {
    const sessionId = await createTestSession();
    const idle = await runAnalysis({
      client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId,
    });
    expect(idle).toMatchObject({ claimed: 0, completed: 0, failed: 0, remaining: 0 });
  });

  it("refuses a session without ai_processing_allowed", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(
      runAnalysis({ client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId }),
    ).rejects.toThrow(/ai processing/i);
  });
});
