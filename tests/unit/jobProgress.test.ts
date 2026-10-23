import { describe, it, expect } from "vitest";
import {
  isJobLive, jobPercent, jobProgressLabel, jobStageLabel,
  type JobProgressView,
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

  it("counts photos during analysis and types during generation", () => {
    expect(jobProgressLabel(job({ phase: "analyze", photos_total: 20, photos_done: 12 })))
      .toBe("Processing photos — 12 of 20 analyzed");
    expect(jobProgressLabel(job({ phase: "generate", types_total: 6, types_done: 4 })))
      .toBe("Writing drafts — 4 of 6 done");
  });

  it("omits counts it does not have yet", () => {
    expect(jobProgressLabel(job({ phase: "analyze" }))).toBe("Processing photos");
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
