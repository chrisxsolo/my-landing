import { describe, it, expect } from "vitest";
import {
  estimateRemainingMs, formatDuration, isJobLive, jobPercent, jobProgressLabel, jobStageLabel,
  photoProgressLine, summarizePhotoProgress,
  type JobProgressView, type PhotoStatusRow,
} from "@/lib/contentEngine/jobProgress";

function job(over: Partial<JobProgressView> = {}): JobProgressView {
  return {
    status: "running", phase: "analyze",
    photos_total: 0, photos_done: 0, types_total: 0, types_done: 0,
    last_error: null, soft_errors: [],
    ...over,
  };
}

describe("isJobLive", () => {
  it("treats queued and running as live, everything else as finished", () => {
    expect(isJobLive(job({ status: "queued" }))).toBe(true);
    expect(isJobLive(job({ status: "running" }))).toBe(true);
    for (const status of ["succeeded", "failed", "cancelled"] as const) {
      expect(isJobLive(job({ status }))).toBe(false);
    }
  });
});

describe("jobStageLabel", () => {
  it("names the stage for a live run", () => {
    expect(jobStageLabel(job({ phase: "analyze" }))).toBe("Processing photos");
    expect(jobStageLabel(job({ phase: "generate" }))).toBe("Writing drafts");
  });

  it("reports the outcome once the run is over, whatever phase it stopped in", () => {
    expect(jobStageLabel(job({ status: "succeeded", phase: "done" }))).toBe("Ready for review");
    expect(jobStageLabel(job({ status: "failed", phase: "analyze" }))).toBe("Needs attention");
    expect(jobStageLabel(job({ status: "cancelled", phase: "generate" }))).toBe("Cancelled");
    expect(jobStageLabel(job({ status: "queued" }))).toBe("Queued");
  });
});

describe("jobProgressLabel", () => {
  it("tells the admin the tab can be closed while queued", () => {
    expect(jobProgressLabel(job({ status: "queued" }))).toContain("close this tab");
  });

  it("leaves photo counts to the live line and counts types during generation", () => {
    expect(jobProgressLabel(job({ phase: "analyze", photos_total: 20, photos_done: 12 })))
      .toBe("Analyzing photos, several at a time — you can close this tab.");
    expect(jobProgressLabel(job({ phase: "generate", types_total: 6, types_done: 4 })))
      .toBe("Writing drafts — 4 of 6 done");
  });

  it("omits counts it does not have yet", () => {
    expect(jobProgressLabel(job({ phase: "generate" }))).toBe("Writing drafts");
  });

  it("surfaces the real error on a failed run", () => {
    expect(jobProgressLabel(job({ status: "failed", last_error: "3 photo(s) failed analysis" })))
      .toBe("3 photo(s) failed analysis");
  });

  it("falls back to a plain sentence when a failed run recorded no error", () => {
    expect(jobProgressLabel(job({ status: "failed" }))).toBe("The run stopped before it finished.");
  });

  it("mentions soft problems on an otherwise successful run", () => {
    expect(jobProgressLabel(job({ status: "succeeded", phase: "done" })))
      .toBe("Drafts are ready for your review below.");
    expect(jobProgressLabel(job({
      status: "succeeded", phase: "done", soft_errors: ["guide_photo: nothing matched"],
    }))).toBe("Drafts are ready, with 1 problem(s) to look at.");
  });

  it("says cancelled work is kept, not thrown away", () => {
    expect(jobProgressLabel(job({ status: "cancelled" }))).toContain("kept as a draft");
  });
});

describe("jobPercent", () => {
  it("scales analysis across the first 60%", () => {
    expect(jobPercent(job({ phase: "analyze", photos_total: 20, photos_done: 0 }))).toBe(0);
    expect(jobPercent(job({ phase: "analyze", photos_total: 20, photos_done: 10 }))).toBe(30);
    expect(jobPercent(job({ phase: "analyze", photos_total: 20, photos_done: 20 }))).toBe(60);
  });

  it("scales generation across the last 30%", () => {
    expect(jobPercent(job({ phase: "generate", types_total: 6, types_done: 0 }))).toBe(70);
    expect(jobPercent(job({ phase: "generate", types_total: 6, types_done: 6 }))).toBe(100);
  });

  it("never divides by a zero total", () => {
    expect(jobPercent(job({ phase: "analyze", photos_total: 0 }))).toBe(0);
    expect(jobPercent(job({ phase: "generate", types_total: 0 }))).toBe(70);
  });

  it("is 100 when succeeded and nothing to draw once finished otherwise", () => {
    expect(jobPercent(job({ status: "succeeded", phase: "done" }))).toBe(100);
    expect(jobPercent(job({ status: "failed" }))).toBeNull();
    expect(jobPercent(job({ status: "cancelled" }))).toBeNull();
  });

  it("stays monotonic across the phase boundaries", () => {
    const series = [
      jobPercent(job({ phase: "analyze", photos_total: 4, photos_done: 4 })),
      jobPercent(job({ phase: "curate" })),
      jobPercent(job({ phase: "package" })),
      jobPercent(job({ phase: "generate", types_total: 6, types_done: 0 })),
      jobPercent(job({ phase: "generate", types_total: 6, types_done: 3 })),
      jobPercent(job({ status: "succeeded", phase: "done" })),
    ] as number[];
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
    }
  });
});

describe("per-photo progress", () => {
  const T0 = Date.parse("2026-10-23T22:00:00.000Z");
  const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();
  const row = (over: Partial<PhotoStatusRow>): PhotoStatusRow => ({
    id: crypto.randomUUID(), excluded: false, analysis_status: "pending",
    analysis_started_at: null, analysis_lease_expires_at: null, analyzed_at: null,
    quality_score: null, analysis_error: null, ...over,
  });

  it("splits photos into completed, in progress, waiting and failed", () => {
    const now = T0 + 30_000;
    const p = summarizePhotoProgress([
      row({ analysis_status: "completed", analysis_started_at: iso(1000), analyzed_at: iso(11_000) }),
      row({ analysis_status: "processing", analysis_started_at: iso(20_000), analysis_lease_expires_at: iso(200_000) }),
      // a dead worker's photo: lease lapsed, so it is back in the queue
      row({ analysis_status: "processing", analysis_started_at: iso(-300_000), analysis_lease_expires_at: iso(-120_000) }),
      row({ analysis_status: "pending" }),
      row({ analysis_status: "failed", analysis_error: "bad json" }),
      row({ analysis_status: "pending", excluded: true }),
    ], now, iso(0));
    expect(p).toMatchObject({ total: 5, completed: 1, analyzing: 1, waiting: 2, failed: 1, completedInRun: 1 });
    expect(p.firstStartMs).toBe(T0 + 1000);
    expect(photoProgressLine(p)).toBe("1 of 5 analyzed · 1 in progress · 2 waiting · 1 failed");
  });

  it("does not count work from before this run toward its pace", () => {
    const p = summarizePhotoProgress([
      row({ analysis_status: "completed", analysis_started_at: iso(-90_000), analyzed_at: iso(-80_000) }),
    ], T0, iso(0));
    expect(p.completedInRun).toBe(0);
    expect(p.firstStartMs).toBeNull();
  });

  it("estimates time left from the measured pace once there is enough of it", () => {
    const base = { total: 24, completed: 6, analyzing: 8, waiting: 10, failed: 0, completedInRun: 6, firstStartMs: T0 };
    // 6 photos in 12s → 2s each → 18 left ≈ 36s
    expect(estimateRemainingMs(base, T0 + 12_000)).toBe(36_000);
    expect(estimateRemainingMs({ ...base, completedInRun: 2 }, T0 + 12_000)).toBeNull();
    expect(estimateRemainingMs(base, T0 + 3_000)).toBeNull();
    expect(estimateRemainingMs({ ...base, analyzing: 0, waiting: 0 }, T0 + 12_000)).toBeNull();
  });

  it("formats durations like a stopwatch", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(185_400)).toBe("3:05");
    expect(formatDuration(3_730_000)).toBe("1:02:10");
  });
});
