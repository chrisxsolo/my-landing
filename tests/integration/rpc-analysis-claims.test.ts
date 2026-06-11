import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";

beforeAll(() => resetDb());

async function setAnalysis(photoId: string, fields: Record<string, unknown>) {
  const { error } = await service.from("session_photos").update(fields).eq("id", photoId);
  if (error) throw error;
}

async function claim(sessionId: string, opts: { photoIds?: string[]; max?: number; lease?: number } = {}) {
  return service.rpc("claim_photos_for_analysis", {
    p_session_id: sessionId,
    p_photo_ids: opts.photoIds ?? null,
    p_max_photos: opts.max ?? 4,
    p_lease_seconds: opts.lease ?? 180,
  });
}

describe("claim_photos_for_analysis (spec §8.1 step 1)", () => {
  it("claims pending photos: processing + future lease + attempt 1", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending", analysis_attempt: 0 });

    const { data, error } = await claim(sessionId);
    expect(error).toBeNull();
    expect(data).toContain(photo.id);

    const { data: row } = await service.from("session_photos")
      .select("analysis_status,analysis_attempt,analysis_lease_expires_at,analysis_started_at")
      .eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("processing");
    expect(row!.analysis_attempt).toBe(1);
    expect(new Date(row!.analysis_lease_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("cannot steal an unexpired claim; can reclaim an expired one (attempt increments)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, {
      analysis_status: "processing", analysis_attempt: 1,
      analysis_lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
    });
    const live = await claim(sessionId);
    expect(live.error).toBeNull();
    expect(live.data).toEqual([]); // unexpired → not claimable

    await setAnalysis(photo.id, {
      analysis_lease_expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    const expired = await claim(sessionId);
    expect(expired.data).toContain(photo.id);
    const { data: row } = await service.from("session_photos")
      .select("analysis_attempt").eq("id", photo.id).single();
    expect(row!.analysis_attempt).toBe(2);
  });

  it("skips excluded photos and respects p_max_photos ordering by sort_order", async () => {
    const sessionId = await createTestSession();
    const a = await createTestPhoto(sessionId);
    const b = await createTestPhoto(sessionId);
    const c = await createTestPhoto(sessionId);
    await setAnalysis(a.id, { analysis_status: "pending", sort_order: 1 });
    await setAnalysis(b.id, { analysis_status: "pending", sort_order: 2, excluded: true });
    await setAnalysis(c.id, { analysis_status: "pending", sort_order: 3 });

    const { data } = await claim(sessionId, { max: 2 });
    expect(data).toEqual([a.id, c.id]); // excluded b skipped
  });

  it("refuses when ai_processing_allowed is false", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending" });
    const { error } = await claim(sessionId);
    expect(error?.message).toMatch(/ai processing/i);
  });

  it("concurrent claims never double-claim a photo", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending", analysis_attempt: 0 });

    const results = await Promise.all([claim(sessionId), claim(sessionId)]);
    const claimed = results.flatMap((r) => (r.data ?? []) as string[]);
    expect(claimed.filter((id) => id === photo.id)).toHaveLength(1);
    const { data: row } = await service.from("session_photos")
      .select("analysis_attempt").eq("id", photo.id).single();
    expect(row!.analysis_attempt).toBe(1); // claimed exactly once
  });
});

describe("record_analysis_batch (spec §8.1 steps 4-5)", () => {
  function successResult(photoId: string) {
    return {
      session_photo_id: photoId, success: true,
      analysis_model: "claude-sonnet-4-6", analysis_version: "test-v1",
      fields: {
        alt_text: "Grad in SJSU colors at golden hour", title: "Tower Lawn portrait",
        description: "Backlit portrait near Tower Lawn.", tags: ["sjsu", "golden hour"],
        quality_score: 8, suggested_category: "grads",
        destination_recommendations: { portfolio: true, school_page: true },
      },
      payload: { raw: "model response", usage: { input_tokens: 1000, output_tokens: 200 } },
    };
  }

  async function claimedPhoto(sessionId: string) {
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending" });
    const { data } = await claim(sessionId, { photoIds: [photo.id] });
    expect(data).toContain(photo.id);
    return photo;
  }

  it("commits a successful batch: fields + payload + completed", async () => {
    const sessionId = await createTestSession();
    const photo = await claimedPhoto(sessionId);

    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId, p_results: [successResult(photo.id)],
    });
    expect(error).toBeNull();

    const { data: row } = await service.from("session_photos").select("*").eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("completed");
    expect(row!.alt_text).toBe("Grad in SJSU colors at golden hour");
    expect(row!.tags).toEqual(["sjsu", "golden hour"]);
    expect(row!.quality_score).toBe(8);
    expect(row!.suggested_category).toBe("grads");
    expect(row!.analysis_model).toBe("claude-sonnet-4-6");
    expect(row!.analysis_version).toBe("test-v1");
    expect(row!.analysis_payload.usage.input_tokens).toBe(1000);
    expect(row!.analyzed_at).not.toBeNull();
  });

  it("records a failed photo with a safe error", async () => {
    const sessionId = await createTestSession();
    const photo = await claimedPhoto(sessionId);
    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId,
      p_results: [{ session_photo_id: photo.id, success: false, error: "identity validation failed",
                    analysis_model: "claude-sonnet-4-6", analysis_version: "test-v1" }],
    });
    expect(error).toBeNull();
    const { data: row } = await service.from("session_photos")
      .select("analysis_status,analysis_error").eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("failed");
    expect(row!.analysis_error).toMatch(/identity validation/);
  });

  it("rejects the WHOLE batch when any lease is expired", async () => {
    const sessionId = await createTestSession();
    const ok = await claimedPhoto(sessionId);
    const stale = await claimedPhoto(sessionId);
    await setAnalysis(stale.id, { analysis_lease_expires_at: new Date(Date.now() - 1000).toISOString() });

    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId, p_results: [successResult(ok.id), successResult(stale.id)],
    });
    expect(error?.message).toMatch(/lease/i);
    // rollback: the ok photo must still be processing, not completed
    const { data: row } = await service.from("session_photos")
      .select("analysis_status").eq("id", ok.id).single();
    expect(row!.analysis_status).toBe("processing");
  });

  it("rejects a photo from another session", async () => {
    const sessionA = await createTestSession();
    const sessionB = await createTestSession();
    const foreign = await claimedPhoto(sessionB);
    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionA, p_results: [successResult(foreign.id)],
    });
    expect(error?.message).toMatch(/not part of session/i);
  });

  it("caps an oversized raw payload instead of storing it", async () => {
    const sessionId = await createTestSession();
    const photo = await claimedPhoto(sessionId);
    const huge = successResult(photo.id);
    huge.payload = { raw: "x".repeat(100_000) } as never;
    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId, p_results: [huge],
    });
    expect(error).toBeNull();
    const { data: row } = await service.from("session_photos")
      .select("analysis_payload").eq("id", photo.id).single();
    expect(row!.analysis_payload.truncated).toBe(true);
  });
});
