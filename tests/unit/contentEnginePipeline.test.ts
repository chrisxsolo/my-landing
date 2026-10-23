import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EnginePackage, EnginePhoto } from "@/app/admin/content-engine/engineTypes";

// The pipeline module is pure orchestration over the engine routes, so the API
// client is faked here: these tests pin the ordering, resume and abort rules.
const analyzeBatch = vi.fn();
const curatePhotos = vi.fn();
const createPackage = vi.fn();
const generateType = vi.fn();

vi.mock("@/app/admin/content-engine/engineApi", () => ({
  engineApi: {
    analyzeBatch: (...a: unknown[]) => analyzeBatch(...a),
    curatePhotos: (...a: unknown[]) => curatePhotos(...a),
    createPackage: (...a: unknown[]) => createPackage(...a),
    generateType: (...a: unknown[]) => generateType(...a),
  },
}));

const {
  analyzeAllPhotos, generateAllTypes, pendingGenerationTypes, runFullPipeline,
  pendingAnalysisCount, includedCount,
} = await import("@/app/admin/content-engine/pipeline");

const SESSION = "11111111-1111-1111-1111-111111111111";

function photo(over: Partial<EnginePhoto> = {}): EnginePhoto {
  return {
    id: crypto.randomUUID(), storage_path: "p", original_filename: null,
    width: 1, height: 1, sort_order: 0, excluded: false,
    analysis_status: "pending", analysis_error: null, analysis_lease_expires_at: null,
    analysis_attempt: 0, alt_text: null, title: null, description: null, tags: [],
    quality_score: null, suggested_category: null, destination_recommendations: null,
    public_derivative_url: null, thumbnailUrl: null, created_at: "2026-10-23",
    ...over,
  };
}

function pkg(progress: Record<string, string>, over: Partial<EnginePackage> = {}): EnginePackage {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    generation_number: 1, status: "generating",
    model_name: "claude-sonnet-4-6", prompt_version: "v1",
    generation_settings: {
      selected_types: Object.keys(progress),
      progress: Object.fromEntries(Object.entries(progress).map(([type, status]) => [
        type, { status: status as "pending", attempt: 1, error: null, usage: null },
      ])),
    },
    created_at: "2026-10-23",
    ...over,
  };
}

/** A fake analyze route backed by a photo queue, honouring 4-per-batch claims. */
function fakeAnalysisQueue(total: number, opts: { failAt?: number } = {}) {
  let unclaimed = total;
  let processed = 0;
  let inFlight = 0;
  let peak = 0;
  return {
    get peak() { return peak; },
    get processed() { return processed; },
    handler: async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      const claimed = Math.min(4, unclaimed);
      unclaimed -= claimed;
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
      if (claimed === 0) return { claimed: 0, completed: 0, failed: 0, remaining: unclaimed };
      const shouldFail = opts.failAt !== undefined && processed >= opts.failAt;
      if (shouldFail) {
        unclaimed += claimed; // failed photos become claimable again
        return { claimed, completed: 0, failed: claimed, remaining: unclaimed };
      }
      processed += claimed;
      return { claimed, completed: claimed, failed: 0, remaining: unclaimed };
    },
  };
}

beforeEach(() => {
  analyzeBatch.mockReset();
  curatePhotos.mockReset();
  createPackage.mockReset();
  generateType.mockReset();
});

describe("pendingGenerationTypes", () => {
  it("returns nothing without an active package", () => {
    expect(pendingGenerationTypes(null)).toEqual([]);
  });

  it("keeps only non-terminal selected types, in generation order", () => {
    const types = pendingGenerationTypes(pkg({
      journal_post: "pending",
      portfolio_pick: "completed",
      school_page_photo: "skipped",
      guide_photo: "failed",
      internal_link_suggestion: "pending",
    }));
    expect(types).toEqual(["internal_link_suggestion", "guide_photo", "journal_post"]);
  });
});

describe("photo counters", () => {
  it("counts pending and failed photos as awaiting analysis, ignoring excluded", () => {
    const photos = [
      photo({ analysis_status: "pending" }),
      photo({ analysis_status: "failed" }),
      photo({ analysis_status: "completed" }),
      photo({ analysis_status: "pending", excluded: true }),
    ];
    expect(pendingAnalysisCount(photos)).toBe(2);
    expect(includedCount(photos)).toBe(3);
  });
});

describe("analyzeAllPhotos", () => {
  it("drains the queue with several batches in flight", async () => {
    const queue = fakeAnalysisQueue(20);
    analyzeBatch.mockImplementation(queue.handler);
    const result = await analyzeAllPhotos(SESSION, 20);
    expect(result).toEqual({ completed: 20, failed: 0 });
    expect(queue.peak).toBeGreaterThan(1);
    expect(queue.peak).toBeLessThanOrEqual(3);
  });

  it("uses one lane when a single batch covers the work", async () => {
    const queue = fakeAnalysisQueue(3);
    analyzeBatch.mockImplementation(queue.handler);
    await analyzeAllPhotos(SESSION, 3);
    expect(queue.peak).toBe(1);
  });

  it("stops the run on the first failed batch", async () => {
    const queue = fakeAnalysisQueue(20, { failAt: 8 });
    analyzeBatch.mockImplementation(queue.handler);
    const result = await analyzeAllPhotos(SESSION, 20);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.completed).toBeLessThan(20);
    const callsAtStop = analyzeBatch.mock.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(analyzeBatch.mock.calls.length).toBe(callsAtStop);
  });

  it("reports progress as batches commit", async () => {
    analyzeBatch.mockImplementation(fakeAnalysisQueue(8).handler);
    const details: string[] = [];
    await analyzeAllPhotos(SESSION, 8, {
      concurrency: 1, onProgress: (p) => details.push(p.detail),
    });
    expect(details).toEqual([
      "Analyzing photos — 4 of 8 done",
      "Analyzing photos — 8 of 8 done",
    ]);
  });
});

describe("generateAllTypes", () => {
  it("runs independent types together and the journal post last", async () => {
    const started: string[] = [];
    let independentDone = false;
    generateType.mockImplementation(async (_id: string, type: string) => {
      started.push(type);
      if (type === "journal_post") {
        // the journal post consumes the link + testimonial drafts
        expect(independentDone).toBe(true);
      }
      await new Promise((r) => setTimeout(r, 2));
      if (type === "portfolio_pick") independentDone = true;
      return { outcome: "completed", itemIds: [], packageStatus: "ready" };
    });

    const errors = await generateAllTypes("pkg", [
      "internal_link_suggestion", "portfolio_pick", "journal_post",
    ]);
    expect(errors).toEqual([]);
    expect(started.slice(0, 2).sort()).toEqual(["internal_link_suggestion", "portfolio_pick"]);
    expect(started[2]).toBe("journal_post");
  });

  it("collects a readable error per failed type and keeps going", async () => {
    generateType.mockImplementation(async (_id: string, type: string) => {
      if (type === "portfolio_pick") return { outcome: "failed", itemIds: [], packageStatus: "needs_attention", error: "model said no" };
      if (type === "guide_photo") throw new Error("network down");
      return { outcome: "completed", itemIds: [], packageStatus: "ready" };
    });
    const errors = await generateAllTypes("pkg", [
      "internal_link_suggestion", "portfolio_pick", "guide_photo",
    ]);
    expect(errors).toEqual([
      "Portfolio pick: model said no",
      "Guide photo: network down",
    ]);
  });
});

describe("runFullPipeline", () => {
  const analyzed = () => [photo({ analysis_status: "completed" })];

  it("saves facts before anything is generated", async () => {
    const order: string[] = [];
    createPackage.mockImplementation(async () => {
      order.push("package");
      return { packageId: "pkg" };
    });
    generateType.mockImplementation(async () => ({ outcome: "completed", itemIds: [], packageStatus: "ready" }));

    const result = await runFullPipeline({
      sessionId: SESSION, photos: analyzed(), activePackage: null,
      flushFacts: async () => { order.push("facts"); },
    });
    expect(result.outcome).toBe("complete");
    expect(order[0]).toBe("facts");
    expect(order[1]).toBe("package");
  });

  it("aborts without touching a package when the facts save fails", async () => {
    const result = await runFullPipeline({
      sessionId: SESSION, photos: analyzed(), activePackage: null,
      flushFacts: async () => { throw new Error("invalid school slug: ucsc"); },
    });
    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]).toContain("invalid school slug");
    expect(createPackage).not.toHaveBeenCalled();
    expect(generateType).not.toHaveBeenCalled();
  });

  it("aborts before generating when analysis fails", async () => {
    analyzeBatch.mockImplementation(fakeAnalysisQueue(4, { failAt: 0 }).handler);
    const result = await runFullPipeline({
      sessionId: SESSION, photos: [photo(), photo(), photo(), photo()], activePackage: null,
    });
    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]).toContain("failed analysis");
    expect(createPackage).not.toHaveBeenCalled();
  });

  it("refuses to generate from a session with no included photos", async () => {
    const result = await runFullPipeline({
      sessionId: SESSION, photos: [photo({ excluded: true, analysis_status: "completed" })],
      activePackage: null,
    });
    expect(result.outcome).toBe("aborted");
    expect(result.errors).toEqual(["No included photos — upload photos first"]);
    expect(createPackage).not.toHaveBeenCalled();
  });

  it("generates only the remaining types of an existing package (resume)", async () => {
    generateType.mockImplementation(async () => ({ outcome: "completed", itemIds: [], packageStatus: "ready" }));
    const result = await runFullPipeline({
      sessionId: SESSION, photos: analyzed(),
      activePackage: pkg({
        internal_link_suggestion: "completed",
        portfolio_pick: "failed",
        journal_post: "pending",
      }),
    });
    expect(result.outcome).toBe("complete");
    expect(createPackage).not.toHaveBeenCalled();
    expect(generateType.mock.calls.map((c) => c[1])).toEqual(["portfolio_pick", "journal_post"]);
  });

  it("does nothing more when an existing package is fully generated", async () => {
    const result = await runFullPipeline({
      sessionId: SESSION, photos: analyzed(),
      activePackage: pkg({ journal_post: "completed", portfolio_pick: "skipped" }),
    });
    expect(result.outcome).toBe("complete");
    expect(generateType).not.toHaveBeenCalled();
  });

  it("skips curation for a normal-sized shoot", async () => {
    createPackage.mockResolvedValue({ packageId: "pkg" });
    generateType.mockResolvedValue({ outcome: "completed", itemIds: [], packageStatus: "ready" });
    await runFullPipeline({
      sessionId: SESSION,
      photos: Array.from({ length: 25 }, () => photo({ analysis_status: "completed" })),
      activePackage: null,
    });
    expect(curatePhotos).not.toHaveBeenCalled();
  });

  it("curates a big shoot but still generates if curation fails", async () => {
    curatePhotos.mockRejectedValue(new Error("model picked 11 photo(s), expected exactly 12"));
    createPackage.mockResolvedValue({ packageId: "pkg" });
    generateType.mockResolvedValue({ outcome: "completed", itemIds: [], packageStatus: "ready" });
    const result = await runFullPipeline({
      sessionId: SESSION,
      photos: Array.from({ length: 95 }, () => photo({ analysis_status: "completed" })),
      activePackage: null,
    });
    expect(curatePhotos).toHaveBeenCalledOnce();
    expect(result.outcome).toBe("errors");
    expect(result.errors[0]).toContain("Curation:");
    expect(generateType).toHaveBeenCalled();
  });

  it("surfaces a package conflict instead of generating into the wrong package", async () => {
    createPackage.mockRejectedValue(new Error("an active package already exists"));
    const result = await runFullPipeline({
      sessionId: SESSION, photos: analyzed(), activePackage: null,
    });
    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]).toContain("active package already exists");
    expect(generateType).not.toHaveBeenCalled();
  });

  it("walks the stages in order for a fresh session", async () => {
    analyzeBatch.mockImplementation(fakeAnalysisQueue(4).handler);
    createPackage.mockResolvedValue({ packageId: "pkg" });
    generateType.mockResolvedValue({ outcome: "completed", itemIds: [], packageStatus: "ready" });
    const stages: string[] = [];
    await runFullPipeline({
      sessionId: SESSION, photos: [photo(), photo(), photo(), photo()],
      activePackage: null,
      flushFacts: async () => {},
      onProgress: (p) => { if (stages.at(-1) !== p.stage) stages.push(p.stage); },
    });
    expect(stages).toEqual(["saving", "analyzing", "packaging", "generating", "done"]);
  });
});
