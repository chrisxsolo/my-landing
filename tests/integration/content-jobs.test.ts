import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, createPackage } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { runWorkerOnce, JOB_COLUMNS, type ContentEngineJob } from "@/lib/contentEngine/jobRunner";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

// The worker claims the oldest claimable job in the whole queue, so each test
// starts from an empty queue or it could pick up a neighbour's leftovers.
beforeEach(async () => {
  await service.from("content_engine_jobs").delete().not("id", "is", null);
});

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

async function pendingPhoto(sessionId: string, seed: number) {
  // Dimensions vary, not just colour: JPEG quantization collapses near-identical
  // solid colours to identical bytes, which trips unique (session, content_hash).
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
      description: "Backlit portrait", tags: ["sjsu"], quality_score: 8,
      suggested_category: "grads", destination_recommendations: { portfolio: true },
    })),
  });
}

const LINKS_JSON = JSON.stringify({
  links: [{ url: "/pricing/grads", label: "Grad pricing", reason: "next step" }],
});

/**
 * One fake that serves whichever prompt the worker sends: photo analysis (image
 * blocks + ids in the text) or the text-only internal-link pass.
 */
function fakeModel(opts: { onCall?: () => Promise<void> } = {}) {
  const calls: string[] = [];
  const caller: ModelCaller = async (req) => {
    const content = req.messages[0].content;
    const blocks = Array.isArray(content) ? content : [{ type: "text", text: content as string }];
    const text = (blocks as { type: string; text?: string }[])
      .filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const hasImages = (blocks as { type: string }[]).some((b) => b.type === "image");
    const ids = [...new Set([...text.matchAll(UUID_RE)].map((m) => m[0]))];

    if (opts.onCall) await opts.onCall();

    if (hasImages && ids.length > 0) {
      calls.push("analysis");
      return { text: analysisJson(ids), usage: { input_tokens: 1200, output_tokens: 400 }, model: req.model };
    }
    calls.push("links");
    return { text: LINKS_JSON, usage: { input_tokens: 300, output_tokens: 90 }, model: req.model };
  };
  return { caller, calls };
}

async function enqueue(sessionId: string) {
  const { data, error } = await service.rpc("enqueue_content_engine_job", { p_session_id: sessionId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; created: boolean };
  return row;
}

async function jobRow(id: string): Promise<ContentEngineJob> {
  const { data, error } = await service
    .from("content_engine_jobs").select(JOB_COLUMNS).eq("id", id).single();
  if (error) throw error;
  // The column list is a runtime constant, so supabase-js can't infer the row.
  return data as unknown as ContentEngineJob;
}

async function itemsOf(packageId: string) {
  const { data } = await service.from("session_content_items")
    .select("id,content_type,status,published_at").eq("package_id", packageId);
  return data ?? [];
}

/** A session with one unanalyzed photo and a narrow package already in place. */
async function seedSession(types: string[] = ["internal_link_suggestion"]) {
  const sessionId = await createTestSession();
  const photo = await pendingPhoto(sessionId, 1);
  const packageId = await createPackage(sessionId, types, { service_type: "grads" });
  return { sessionId, photo, packageId };
}

describe("enqueue_content_engine_job", () => {
  it("is idempotent — a second enqueue adopts the live run", async () => {
    const sessionId = await createTestSession();
    const first = await enqueue(sessionId);
    const second = await enqueue(sessionId);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job_id).toBe(first.job_id);

    const { count } = await service.from("content_engine_jobs")
      .select("id", { count: "exact", head: true })
      .eq("photography_session_id", sessionId);
    expect(count).toBe(1);
  });

  it("refuses a session whose AI processing is not allowed", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(enqueue(sessionId)).rejects.toThrow(/ai processing is not allowed/i);
  });

  it("allows a new run once the previous one is terminal", async () => {
    const sessionId = await createTestSession();
    const first = await enqueue(sessionId);
    await service.from("content_engine_jobs")
      .update({ status: "succeeded", finished_at: new Date().toISOString() })
      .eq("id", first.job_id);
    const second = await enqueue(sessionId);
    expect(second.created).toBe(true);
    expect(second.job_id).not.toBe(first.job_id);
  });
});

describe("runWorkerOnce", () => {
  it("is idle when nothing is queued", async () => {
    const fake = fakeModel();
    const result = await runWorkerOnce({ client: service, callModel: fake.caller });
    expect(result.picked).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("carries a session from unanalyzed photos to reviewable drafts in one invocation", async () => {
    const { sessionId, photo, packageId } = await seedSession();
    const { job_id } = await enqueue(sessionId);
    const fake = fakeModel();

    const result = await runWorkerOnce({ client: service, callModel: fake.caller });

    expect(result.picked).toBe(true);
    expect(result.jobId).toBe(job_id);
    expect(result.status).toBe("succeeded");
    expect(result.phase).toBe("done");

    const job = await jobRow(job_id);
    expect(job.status).toBe("succeeded");
    expect(job.phase).toBe("done");
    expect(job.package_id).toBe(packageId);
    expect(job.last_error).toBeNull();
    expect(job.soft_errors).toEqual([]);
    expect(job.photos_total).toBe(1);
    expect(job.photos_done).toBe(1);
    expect(job.finished_at).not.toBeNull();
    expect(job.lease_expires_at).toBeNull();

    const { data: photoRow } = await service.from("session_photos")
      .select("analysis_status,alt_text").eq("id", photo.id).single();
    expect(photoRow!.analysis_status).toBe("completed");

    const items = await itemsOf(packageId);
    expect(items).toHaveLength(1);
    expect(items[0].content_type).toBe("internal_link_suggestion");
    // A run drafts; it never publishes.
    expect(items[0].status).toBe("draft");
    expect(items[0].published_at).toBeNull();
  });

  it("adopts the session's live package instead of creating a second one", async () => {
    const { sessionId, packageId } = await seedSession();
    await enqueue(sessionId);
    const fake = fakeModel();
    await runWorkerOnce({ client: service, callModel: fake.caller });

    const { data: packages } = await service.from("session_content_packages")
      .select("id").eq("photography_session_id", sessionId);
    expect(packages).toHaveLength(1);
    expect(packages![0].id).toBe(packageId);
  });

  it("creates its own package when the session has none", async () => {
    const sessionId = await createTestSession();
    await pendingPhoto(sessionId, 2);
    const { job_id } = await enqueue(sessionId);
    const fake = fakeModel();

    // Budget 0 means one step per invocation: analyze, curate, package, …
    for (let i = 0; i < 4; i += 1) {
      await runWorkerOnce({ client: service, callModel: fake.caller, budgetMs: 0 });
    }
    const job = await jobRow(job_id);
    expect(job.package_id).not.toBeNull();
    expect(job.types_total).toBeGreaterThan(0);

    const { data: packages } = await service.from("session_content_packages")
      .select("id,generation_settings").eq("photography_session_id", sessionId);
    expect(packages).toHaveLength(1);
  });

  it("hands a long run back as queued without spending an attempt", async () => {
    const { sessionId } = await seedSession();
    const { job_id } = await enqueue(sessionId);
    const fake = fakeModel();

    const first = await runWorkerOnce({ client: service, callModel: fake.caller, budgetMs: 0 });
    expect(first.handedOff).toBe(true);
    expect(first.stepsRun).toBe(1);

    const midway = await jobRow(job_id);
    expect(midway.status).toBe("queued");
    expect(midway.lease_expires_at).toBeNull();
    // A clean hand-off is not a retry — otherwise a big shoot would exhaust
    // its own attempts just by being long.
    expect(midway.attempts).toBe(0);

    // A later invocation (cron tick) continues the same job to the end.
    for (let i = 0; i < 6; i += 1) {
      const step = await runWorkerOnce({ client: service, callModel: fake.caller, budgetMs: 0 });
      if (step.status === "succeeded") break;
    }
    expect((await jobRow(job_id)).status).toBe("succeeded");
  });

  it("recovers a run whose worker died holding the lease", async () => {
    const { sessionId, packageId } = await seedSession();
    const { job_id } = await enqueue(sessionId);

    // Simulate the crash: claimed, then the invocation vanished.
    const { error: claimErr } = await service.rpc("claim_content_engine_job", {
      p_lease_seconds: 120, p_max_attempts: 5,
    });
    if (claimErr) throw claimErr;
    expect((await jobRow(job_id)).status).toBe("running");

    // While the lease is live nobody may touch it.
    const blocked = await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(blocked.picked).toBe(false);

    await service.from("content_engine_jobs")
      .update({ lease_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", job_id);

    const recovered = await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(recovered.picked).toBe(true);
    expect(recovered.status).toBe("succeeded");

    const job = await jobRow(job_id);
    expect(job.attempts).toBe(1); // the stolen lease, and only that, cost an attempt
    expect(await itemsOf(packageId)).toHaveLength(1);
  });

  it("never writes a second draft when a finished step is replayed", async () => {
    const { sessionId, packageId } = await seedSession();
    const { job_id } = await enqueue(sessionId);
    await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(await itemsOf(packageId)).toHaveLength(1);

    // Force the run back to the generate phase and clear the package's progress
    // so the type looks pending again — the harshest replay: the same step runs
    // a second time against a package that already holds its draft.
    const { data: pkg } = await service.from("session_content_packages")
      .select("generation_settings").eq("id", packageId).single();
    const settings = pkg!.generation_settings as {
      selected_types: string[]; progress: Record<string, unknown>;
    };
    settings.progress.internal_link_suggestion = { status: "pending", attempt: 0, error: null, usage: null };
    await service.from("session_content_packages")
      .update({ generation_settings: settings, status: "generating" }).eq("id", packageId);
    await service.from("content_engine_jobs")
      .update({ status: "queued", phase: "generate", finished_at: null }).eq("id", job_id);

    const replay = await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(replay.status).toBe("succeeded");

    const items = await itemsOf(packageId);
    expect(items).toHaveLength(1); // idempotency_key held the line
  });

  it("stops when the admin cancels mid-run and keeps what was generated", async () => {
    const { sessionId, packageId } = await seedSession();
    const { job_id } = await enqueue(sessionId);

    // Cancel from inside the first model call — i.e. while a step is in flight.
    let cancelled = false;
    const fake = fakeModel({
      onCall: async () => {
        if (cancelled) return;
        cancelled = true;
        await service.from("content_engine_jobs")
          .update({ status: "cancelled", finished_at: new Date().toISOString() })
          .eq("id", job_id);
      },
    });

    const result = await runWorkerOnce({ client: service, callModel: fake.caller });
    expect(result.status).toBe("cancelled");

    const job = await jobRow(job_id);
    expect(job.status).toBe("cancelled");
    // The step in flight was allowed to finish; its output is a draft and drafts
    // are never rolled back.
    expect(await itemsOf(packageId)).toHaveLength(0);
    expect(job.phase).not.toBe("done");
  });

  it("will not claim a cancelled run", async () => {
    const { sessionId } = await seedSession();
    const { job_id } = await enqueue(sessionId);
    await service.from("content_engine_jobs").update({ status: "cancelled" }).eq("id", job_id);

    const result = await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(result.picked).toBe(false);
  });

  it("fails with something the admin can act on when a session has no photos", async () => {
    const sessionId = await createTestSession();
    const { job_id } = await enqueue(sessionId);

    const result = await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(result.status).toBe("failed");

    const job = await jobRow(job_id);
    expect(job.status).toBe("failed");
    expect(job.last_error).toMatch(/no included photos/i);
  });

  it("stops the run when a photo fails analysis, naming where to retry", async () => {
    const sessionId = await createTestSession();
    await pendingPhoto(sessionId, 3);
    const { job_id } = await enqueue(sessionId);
    const broken: ModelCaller = async () => { throw new Error("vision call exploded"); };

    const result = await runWorkerOnce({ client: service, callModel: broken });
    expect(result.status).toBe("failed");

    const job = await jobRow(job_id);
    expect(job.last_error).toMatch(/failed analysis/i);
    // The photo is left reclaimable so the admin's Retry button works.
    const { data: photoRow } = await service.from("session_photos")
      .select("analysis_status").eq("photography_session_id", sessionId).single();
    expect(photoRow!.analysis_status).toBe("failed");
  });

  it("records a failed content type as a soft error and still finishes the run", async () => {
    // guide_photo on a grads session with no school is skipped by the target,
    // so pair a type that fails validation with one that succeeds.
    const { sessionId, packageId } = await seedSession([
      "internal_link_suggestion", "portfolio_pick",
    ]);
    const { job_id } = await enqueue(sessionId);

    const caller: ModelCaller = async (req) => {
      const content = req.messages[0].content;
      const blocks = Array.isArray(content) ? content : [{ type: "text", text: content as string }];
      const text = (blocks as { type: string; text?: string }[])
        .filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
      const hasImages = (blocks as { type: string }[]).some((b) => b.type === "image");
      const ids = [...new Set([...text.matchAll(UUID_RE)].map((m) => m[0]))];
      if (hasImages && ids.length > 0) {
        return { text: analysisJson(ids), usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
      }
      if (/portfolio/i.test(req.system)) {
        return { text: "not json at all", usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
      }
      return { text: LINKS_JSON, usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
    };

    const result = await runWorkerOnce({ client: service, callModel: caller });
    expect(result.status).toBe("succeeded");

    const job = await jobRow(job_id);
    expect(job.soft_errors.length).toBeGreaterThan(0);
    expect(job.soft_errors.join(" ")).toMatch(/portfolio_pick/);
    // The healthy type still produced its draft.
    const items = await itemsOf(packageId);
    expect(items.map((i) => i.content_type)).toContain("internal_link_suggestion");
  });

  it("retires a run that keeps crashing instead of retrying it forever", async () => {
    const { sessionId } = await seedSession();
    const { job_id } = await enqueue(sessionId);
    await service.from("content_engine_jobs")
      .update({ status: "running", attempts: 5, lease_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", job_id);

    const result = await runWorkerOnce({ client: service, callModel: fakeModel().caller });
    expect(result.picked).toBe(false);

    const job = await jobRow(job_id);
    expect(job.status).toBe("failed");
    expect(job.last_error).toMatch(/maximum number of attempts/i);
  });
});
