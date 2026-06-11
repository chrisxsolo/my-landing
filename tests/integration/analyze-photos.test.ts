import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { runAnalysisBatch } from "@/lib/contentEngine/analyzePhotos";
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

describe("runAnalysisBatch (spec §8.1)", () => {
  it("claims, downloads, sends images, validates, and commits completed analyses", async () => {
    const sessionId = await createTestSession();
    const p1 = await realPhoto(sessionId, 1);
    const p2 = await realPhoto(sessionId, 2);
    const fake = fakeModel((ids) => analysisJson(ids));

    const result = await runAnalysisBatch({ client: service, callModel: fake.caller, sessionId });
    expect(result.claimed).toBe(2);
    expect(result.completed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(fake.calls[0]).toBe(2); // one image block per claimed photo

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

  it("marks the whole claimed batch failed when identity validation fails", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 3);
    const fake = fakeModel(() => analysisJson(["99999999-9999-4999-8999-999999999999"])); // unknown id

    const result = await runAnalysisBatch({ client: service, callModel: fake.caller, sessionId });
    expect(result.claimed).toBe(1);
    expect(result.failed).toBe(1);
    const { data: row } = await service.from("session_photos")
      .select("analysis_status,analysis_error").eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("failed");
    expect(row!.analysis_error).toMatch(/unknown session_photo_id/i);
  });

  it("returns zeros when nothing is eligible and reports remaining when more await", async () => {
    const sessionId = await createTestSession();
    const idle = await runAnalysisBatch({
      client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId,
    });
    expect(idle).toEqual({ claimed: 0, completed: 0, failed: 0, remaining: 0 });

    // 5 photos: one batch of 4 leaves 1 remaining
    for (let i = 10; i < 15; i++) await realPhoto(sessionId, i);
    const fake = fakeModel((ids) => analysisJson(ids));
    const first = await runAnalysisBatch({ client: service, callModel: fake.caller, sessionId });
    expect(first.claimed).toBe(4);
    expect(first.remaining).toBe(1);
  });

  it("refuses a session without ai_processing_allowed", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(
      runAnalysisBatch({ client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId }),
    ).rejects.toThrow(/ai processing/i);
  });
});
