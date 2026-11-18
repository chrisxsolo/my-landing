// Sync outcome wording, the shared progress-stage resolver, and the open
// conversation's refresh rules. Synthetic fixtures only.
import { describe, expect, it, vi } from "vitest";
import { resolveInquiryPortalStatus } from "@/lib/clientSessions";
import { createRevalidator, mergeProgressFields } from "@/lib/inquiryRevalidation";
import {
  buildSyncMessage,
  deriveSyncStatus,
  describeSyncResponse,
  emptySyncReport,
  syncChangedSessions,
  withStageOutcomes,
  DISCOVERY_STAGES,
} from "@/lib/timelineSync/report";

describe("sync report", () => {
  const stage = (name: (typeof DISCOVERY_STAGES)[number], over = {}) =>
    ({ stage: name, listFailed: false, failedReads: 0, truncated: false, ...over });

  it("is complete only when nothing failed or was cut short", () => {
    expect(deriveSyncStatus(emptySyncReport())).toBe("complete");
    const review = { ...emptySyncReport(), ambiguous: { providerNotices: 2, sessions: 0 } };
    expect(deriveSyncStatus(review)).toBe("complete");
  });

  it("is partial on unreadable mail, truncation, failed scans or writes, or leftover work", () => {
    const base = emptySyncReport();
    expect(deriveSyncStatus(withStageOutcomes(base, [stage("payments", { failedReads: 3 })]))).toBe("partial");
    expect(deriveSyncStatus(withStageOutcomes(base, [stage("provider_documents", { truncated: true })]))).toBe("partial");
    expect(deriveSyncStatus({ ...base, failed: { ...base.failed, writes: 1 } })).toBe("partial");
    expect(deriveSyncStatus({ ...base, remaining: { ...base.remaining, scans: 4 } })).toBe("partial");
  });

  it("is failed when every Gmail search failed", () => {
    const all = DISCOVERY_STAGES.map(name => stage(name, { listFailed: true }));
    expect(deriveSyncStatus(withStageOutcomes(emptySyncReport(), all))).toBe("failed");
  });

  it("never says 'up to date' for an incomplete run with no changes", () => {
    const report = { ...emptySyncReport(), status: "partial" as const };
    const message = buildSyncMessage({ ...report, failed: { ...report.failed, scans: 2 } });
    expect(message).not.toMatch(/up to date/);
    expect(message).toMatch(/2 client threads could not be scanned/);
  });

  it("describes the response for callers", () => {
    expect(describeSyncResponse(false, { error: "Gmail not connected." })).toEqual({ status: "failed", message: "Gmail not connected." });
    const partial = { ...emptySyncReport(), status: "partial" as const };
    expect(describeSyncResponse(true, { report: partial, message: "m" })).toEqual({ status: "partial", message: "m" });
    expect(syncChangedSessions({ report: partial })).toBe(false);
    expect(syncChangedSessions({ report: { ...partial, applied: { inquiries: 0, sessions: 1, sessionsCreated: 0, replyStatuses: 0 } } })).toBe(true);
  });
});

describe("resolveInquiryPortalStatus", () => {
  it("shows booking in progress for an inquiry-only client with document evidence", () => {
    expect(resolveInquiryPortalStatus(null, { invoice_sent_at: "2026-11-10T00:00:00Z" })).toBe("booking_in_progress");
    expect(resolveInquiryPortalStatus(undefined, { reply_sent_at: "2026-11-10T00:00:00Z" })).toBe("booking_in_progress");
  });

  it("stays at inquiry received with no activity, and never reads as booked without payment", () => {
    expect(resolveInquiryPortalStatus(null, {})).toBe("inquiry_received");
    expect(resolveInquiryPortalStatus(null, {
      invoice_sent_at: "2026-11-10T00:00:00Z", contract_sent_at: "2026-11-10T00:00:00Z", payment_status: "unpaid",
    })).toBe("booking_in_progress");
  });

  it("keeps a stored stage, including one set by hand", () => {
    expect(resolveInquiryPortalStatus("editing", { invoice_sent_at: "2026-11-10T00:00:00Z" })).toBe("editing");
    expect(resolveInquiryPortalStatus("inquiry_received", { reply_sent_at: "2026-11-10T00:00:00Z" })).toBe("inquiry_received");
  });

  it("still lifts a paid client to booked", () => {
    expect(resolveInquiryPortalStatus(null, { deposit_paid_at: "2026-11-10T00:00:00Z" })).toBe("booked");
  });
});

describe("conversation progress refresh", () => {
  it("merges only progress fields and leaves everything else alone", () => {
    const current = { name: "Alex Example", message: "draft-adjacent", invoice_sent_at: null, reply_sent_at: "a" };
    const fresh = { name: "CHANGED", message: "CHANGED", invoice_sent_at: "2026-11-10T00:00:00Z", reply_sent_at: "a" };
    expect(mergeProgressFields(current, fresh)).toEqual({ ...current, invoice_sent_at: "2026-11-10T00:00:00Z" });
  });

  it("returns the same object when nothing changed", () => {
    const current = { invoice_sent_at: "x" };
    expect(mergeProgressFields(current, { invoice_sent_at: "x" })).toBe(current);
  });

  it("runs one request at a time and respects the minimum interval", async () => {
    let clock = 0;
    const load = vi.fn(async () => ({ v: 1 }));
    const apply = vi.fn();
    const revalidator = createRevalidator({ load, apply, minIntervalMs: 5_000, now: () => clock });
    await Promise.all([revalidator.trigger(), revalidator.trigger(), revalidator.trigger()]);
    clock = 1_000;
    await revalidator.trigger();
    expect(load).toHaveBeenCalledTimes(1);
    clock = 6_000;
    await revalidator.trigger();
    expect(load).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("drops a response that started before a local edit", async () => {
    let release!: (value: { v: number }) => void;
    const apply = vi.fn();
    const revalidator = createRevalidator({
      load: () => new Promise<{ v: number }>(resolve => { release = resolve; }),
      apply, minIntervalMs: 0,
    });
    const pending = revalidator.trigger();
    revalidator.noteLocalEdit();
    release({ v: 1 });
    await pending;
    expect(apply).not.toHaveBeenCalled();
  });

  it("a forced refresh skips the interval and reruns after an in-flight read", async () => {
    const releases: ((value: { v: number }) => void)[] = [];
    const apply = vi.fn();
    const revalidator = createRevalidator({
      load: () => new Promise<{ v: number }>(resolve => { releases.push(resolve); }),
      apply, minIntervalMs: 60_000, now: () => 0,
    });
    const first = revalidator.trigger();
    void revalidator.trigger({ force: true }); // a sync finished while the read was in flight
    releases[0]({ v: 1 });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(releases).toHaveLength(2);
    releases[1]({ v: 2 });
    await first;
    expect(apply).toHaveBeenLastCalledWith({ v: 2 });
  });

  it("applies nothing after dispose and reports load errors without throwing", async () => {
    const onError = vi.fn();
    const failing = createRevalidator({ load: async () => { throw new Error("offline"); }, apply: vi.fn(), minIntervalMs: 0, onError });
    await failing.trigger();
    expect(onError).toHaveBeenCalledTimes(1);

    const apply = vi.fn();
    const disposed = createRevalidator({ load: async () => ({ v: 1 }), apply, minIntervalMs: 0 });
    disposed.dispose();
    await disposed.trigger();
    expect(apply).not.toHaveBeenCalled();
  });
});
