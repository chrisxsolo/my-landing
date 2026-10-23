import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EnginePackage, EnginePhoto } from "@/app/admin/content-engine/engineTypes";

// The pipeline module is pure orchestration over the engine routes, so the API
// client is faked here: these tests pin the ordering, resume and abort rules.
const analyzePhotos = vi.fn();
const curatePhotos = vi.fn();
const createPackage = vi.fn();
const generateType = vi.fn();

vi.mock("@/app/admin/content-engine/engineApi", () => ({
  engineApi: {
    analyzePhotos: (...a: unknown[]) => analyzePhotos(...a),
    curatePhotos: (...a: unknown[]) => curatePhotos(...a),
    createPackage: (...a: unknown[]) => createPackage(...a),
    generateType: (...a: unknown[]) => generateType(...a),
  },
}));

const {
  analyzeAllPhotos, generateAllTypes, pendingGenerationTypes,
  pendingAnalysisCount, includedCount, mergePhotoStatuses,
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

const RUN_START = "2026-10-23T22:00:00.000Z";

function round(over: Partial<{
  claimed: number; completed: number; failed: number; remaining: number;
  inFlightElsewhere: number; errors: string[];
}>) {
  return {
    claimed: 0, completed: 0, failed: 0, remaining: 0, inFlightElsewhere: 0, errors: [],
    runStartedAt: RUN_START, ...over,
  };
}

beforeEach(() => {
  analyzePhotos.mockReset();
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
  it("finishes in one round when the server drains everything", async () => {
    analyzePhotos.mockResolvedValueOnce(round({ claimed: 24, completed: 24 }));
    const started: string[] = [];
    const result = await analyzeAllPhotos(SESSION, { onRunStarted: (t) => started.push(t) });
    expect(result).toEqual({ completed: 24, failed: 0, errors: [] });
    expect(analyzePhotos).toHaveBeenCalledTimes(1);
    expect(analyzePhotos).toHaveBeenCalledWith(SESSION, null);
    expect(started).toEqual([RUN_START]);
  });

  it("passes the run start back so photos failed in this run are not retried in a loop", async () => {
    analyzePhotos
      .mockResolvedValueOnce(round({ claimed: 16, completed: 15, failed: 1, remaining: 8, errors: ["bad json"] }))
      .mockResolvedValueOnce(round({ claimed: 8, completed: 8 }));
    const result = await analyzeAllPhotos(SESSION);
    expect(result).toEqual({ completed: 23, failed: 1, errors: ["bad json"] });
    expect(analyzePhotos.mock.calls[1]).toEqual([SESSION, RUN_START]);
  });

  it("waits out photos another worker holds, then stops when nothing is left", async () => {
    const sleeps: number[] = [];
    analyzePhotos
      .mockResolvedValueOnce(round({ remaining: 4, inFlightElsewhere: 4 }))
      .mockResolvedValueOnce(round({}));
    await analyzeAllPhotos(SESSION, { sleep: async (ms) => { sleeps.push(ms); } });
    expect(sleeps).toHaveLength(1);
    expect(analyzePhotos).toHaveBeenCalledTimes(2);
  });

  it("stops rather than spin when nothing is claimable and nobody holds the rest", async () => {
    analyzePhotos.mockResolvedValue(round({ remaining: 2 }));
    await analyzeAllPhotos(SESSION);
    expect(analyzePhotos).toHaveBeenCalledTimes(1);
  });

  it("reports each round so the workspace can refresh", async () => {
    analyzePhotos
      .mockResolvedValueOnce(round({ claimed: 8, completed: 8, remaining: 2 }))
      .mockResolvedValueOnce(round({ claimed: 2, completed: 2 }));
    let rounds = 0;
    await analyzeAllPhotos(SESSION, { onRound: () => { rounds += 1; } });
    expect(rounds).toBe(2);
  });
});

describe("mergePhotoStatuses", () => {
  const status = (id: string, over: Partial<{ analysis_status: string; quality_score: number | null }> = {}) => ({
    id, excluded: false, analysis_status: "completed", analysis_started_at: null,
    analysis_lease_expires_at: null, analyzed_at: null, quality_score: 8, analysis_error: null, ...over,
  });

  it("updates status and score in place, keeping everything else (thumbnails included)", () => {
    const a = photo({ thumbnailUrl: "signed-a" });
    const b = photo();
    const next = mergePhotoStatuses([a, b], [status(a.id)]);
    expect(next[0]).toMatchObject({ analysis_status: "completed", quality_score: 8, thumbnailUrl: "signed-a" });
    expect(next[1]).toBe(b);
  });

  it("returns the same array when nothing changed, so React can skip the render", () => {
    const a = photo({ analysis_status: "completed", quality_score: 8 });
    const photos = [a];
    expect(mergePhotoStatuses(photos, [status(a.id)])).toBe(photos);
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
