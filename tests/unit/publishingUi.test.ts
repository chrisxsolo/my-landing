// Pure UI helpers for scheduling: the bulk publish excludes scheduled items,
// the queue filters sort states, and the control's confirmation line.
import { describe, it, expect } from "vitest";
import { publishableNow } from "@/app/admin/content-engine/[id]/ActionBar";
import { matchesFilter } from "@/app/admin/content-engine/schedule/ScheduleQueue";
import { describeScheduleDraft, toScheduleWhen } from "@/app/admin/publishing/ScheduleControl";
import { healthVerdict } from "@/app/admin/content-engine/schedule/PublishingHealthCard";
import type { EngineItem, PublicationScheduleDto } from "@/app/admin/content-engine/engineTypes";
import type { PublishingHealth, ScheduleQueueEntry } from "@/lib/contentPublishing/types";

const item = (id: string, status: EngineItem["status"]) => ({ id, status, content_type: "journal_post" } as unknown as EngineItem);
const sched = (itemId: string, state: PublicationScheduleDto["state"]) =>
  ({ id: `s-${itemId}`, content_item_id: itemId, state, due_at: "2031-01-01T00:00:00Z", time_zone: "UTC", local_wall_time: "2031-01-01T00:00" } as unknown as PublicationScheduleDto);

describe("publishableNow", () => {
  it("excludes approved items with an active schedule and reports them separately", () => {
    const items = [item("a", "approved"), item("b", "approved"), item("c", "draft"), item("d", "approved")];
    const r = publishableNow(items, [sched("b", "queued"), sched("d", "cancelled")]);
    expect(r.now.map((i) => i.id)).toEqual(["a", "d"]);
    expect(r.scheduled.map((i) => i.id)).toEqual(["b"]);
  });
  it("blocked and failed schedules still hold the item back from bulk publish", () => {
    const r = publishableNow([item("a", "approved"), item("b", "approved")], [sched("a", "blocked"), sched("b", "failed")]);
    expect(r.now).toEqual([]);
    expect(r.scheduled).toHaveLength(2);
  });
});

describe("queue filters", () => {
  const entry = (state: PublicationScheduleDto["state"], overdue = false) =>
    ({ schedule: sched("x", state), overdue } as unknown as ScheduleQueueEntry);
  it("sorts states into the tabs the admin sees", () => {
    expect(matchesFilter(entry("queued"), "upcoming")).toBe(true);
    expect(matchesFilter(entry("processing"), "upcoming")).toBe(true);
    expect(matchesFilter(entry("blocked"), "attention")).toBe(true);
    expect(matchesFilter(entry("failed"), "attention")).toBe(true);
    expect(matchesFilter(entry("queued", true), "attention")).toBe(true); // overdue shows twice on purpose
    expect(matchesFilter(entry("published"), "upcoming")).toBe(false);
    expect(matchesFilter(entry("cancelled"), "cancelled")).toBe(true);
  });
});

describe("describeScheduleDraft", () => {
  const now = new Date("2026-11-06T20:00:00Z");
  it("confirms a valid choice in the admin's words", () => {
    const d = { date: "2026-11-12", time: "09:00", timeZone: "America/Los_Angeles" };
    expect(describeScheduleDraft(d, now)).toEqual({ text: "Scheduled for November 12, 2026 at 9:00 AM — America/Los_Angeles", ok: true, ambiguous: false });
    expect(toScheduleWhen(d)).toEqual({ localWallTime: "2026-11-12T09:00", timeZone: "America/Los_Angeles", disambiguation: undefined });
  });
  it("blocks past, skipped and (until chosen) repeated times", () => {
    expect(describeScheduleDraft({ date: "2026-11-05", time: "09:00", timeZone: "America/Los_Angeles" }, now).ok).toBe(false);
    expect(describeScheduleDraft({ date: "2027-03-14", time: "02:30", timeZone: "America/Los_Angeles" }, now)).toMatchObject({ ok: false, ambiguous: false });
    const twice = describeScheduleDraft({ date: "2027-11-07", time: "01:30", timeZone: "America/Los_Angeles" }, now);
    expect(twice).toMatchObject({ ok: false, ambiguous: true });
    expect(describeScheduleDraft({ date: "2027-11-07", time: "01:30", timeZone: "America/Los_Angeles", disambiguation: "later" }, now).ok).toBe(true);
  });
});

describe("healthVerdict", () => {
  const base: PublishingHealth = {
    lastRun: { id: 1, source: "cron", started_at: "2026-11-06T19:59:30Z", finished_at: "2026-11-06T19:59:31Z", claimed: 0, published: 0, blocked: 0, failed: 0, retried: 0, refreshed: 0, error: null },
    overdue: 0, refreshPending: 0,
    counts: { queued: 2, processing: 0, published: 5, blocked: 0, failed: 0, cancelled: 1 },
    trigger: { installed: true, scheduled: true, active: true, schedule: "* * * * *", lastRun: null },
    serverNow: "2026-11-06T20:00:00Z",
  };
  it("is healthy only when the trigger exists AND a tick was observed recently", () => {
    expect(healthVerdict(base).label).toBe("Running");
    expect(healthVerdict({ ...base, trigger: { ...base.trigger, scheduled: false } }).label).toBe("Trigger not configured");
    expect(healthVerdict({ ...base, lastRun: null }).label).toBe("No recent tick");
    expect(healthVerdict({ ...base, lastRun: { ...base.lastRun!, started_at: "2026-11-06T18:00:00Z" } }).label).toBe("No recent tick");
    expect(healthVerdict({ ...base, overdue: 1 }).label).toBe("Overdue work");
  });
});
