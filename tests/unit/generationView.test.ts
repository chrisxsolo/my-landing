import { describe, it, expect } from "vitest";
import { generationRowView, generationNotice } from "@/app/admin/content-engine/generationView";
import type { GenerationProgressEntry } from "@/lib/contentEngine/generationProgress";

const NOW = Date.parse("2026-11-04T02:20:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const running: GenerationProgressEntry = { status: "processing", attempt: 1, lease_started_at: at(-40_000), lease_expires_at: at(200_000) };
const stalled: GenerationProgressEntry = { status: "processing", attempt: 1, lease_started_at: at(-400_000), lease_expires_at: at(-100_000) };
const failed: GenerationProgressEntry = { status: "failed", attempt: 1, error: "model call timed out after 240s" };

describe("generationRowView", () => {
  it("a live claim shows as running with no Retry or Skip — the server still owns it", () => {
    const view = generationRowView(running, NOW);
    expect(view.state).toBe("running");
    expect(view.canGenerate).toBe(false);
    expect(view.canSkip).toBe(false);
    expect(view.hint).toMatch(/still working/i);
  });

  it("an expired claim is stalled: Retry only, never Skip (the type was never recorded failed)", () => {
    const view = generationRowView(stalled, NOW);
    expect(view.state).toBe("stalled");
    expect(view.canGenerate).toBe(true);
    expect(view.generateLabel).toBe("Retry");
    expect(view.canSkip).toBe(false);
    expect(view.hint).toMatch(/retry/i);
  });

  it("failed offers Retry and Skip; pending offers Generate; terminal offers nothing", () => {
    expect(generationRowView(failed, NOW)).toMatchObject({ state: "failed", canGenerate: true, generateLabel: "Retry", canSkip: true });
    expect(generationRowView({ status: "pending" }, NOW)).toMatchObject({ state: "pending", canGenerate: true, generateLabel: "Generate", canSkip: false });
    expect(generationRowView({ status: "completed" }, NOW)).toMatchObject({ state: "completed", canGenerate: false, canSkip: false });
    expect(generationRowView({ status: "skipped" }, NOW)).toMatchObject({ state: "skipped", canGenerate: false, canSkip: false });
  });
});

describe("generationNotice", () => {
  const unreachable = { type: "guide_photo", kind: "unreachable" as const, message: "request failed (504)" };

  it("a browser-side 504 while the server claim is live says so and promises no controls", () => {
    const notice = generationNotice(unreachable, running, NOW)!;
    expect(notice).toMatch(/Guide photo/);
    expect(notice).toMatch(/still/i);
    expect(notice).not.toMatch(/retry or skip/i);
  });

  it("a browser-side 504 on a stalled claim points at Retry only", () => {
    const notice = generationNotice(unreachable, stalled, NOW)!;
    expect(notice).toMatch(/stalled/i);
    expect(notice).toMatch(/retry below/i);
    expect(notice).not.toMatch(/skip/i);
  });

  it("a browser-side 504 that the server recorded as failed shows the stored error with both controls", () => {
    const notice = generationNotice(unreachable, failed, NOW)!;
    expect(notice).toContain("model call timed out after 240s");
    expect(notice).toMatch(/retry or skip below/i);
  });

  it("a browser-side error that the server resolved anyway clears itself", () => {
    expect(generationNotice(unreachable, { status: "completed" }, NOW)).toBeNull();
    expect(generationNotice(unreachable, { status: "skipped" }, NOW)).toBeNull();
  });

  it("a 409 is reported as another invocation owning the work, not as a failure", () => {
    const conflict = { type: "journal_post", kind: "conflict" as const, message: "already in progress" };
    expect(generationNotice(conflict, running, NOW)).toMatch(/another request|already/i);
    expect(generationNotice(conflict, running, NOW)).not.toMatch(/failed/i);
    expect(generationNotice(conflict, { status: "completed" }, NOW)).toBeNull();
  });

  it("a recorded failure keeps the server's error and the retry-or-skip pointer", () => {
    const outcome = { type: "portfolio_pick", kind: "failed" as const, message: "unknown photo id" };
    expect(generationNotice(outcome, failed, NOW)).toBe("Portfolio pick: unknown photo id — retry or skip below");
  });
});
