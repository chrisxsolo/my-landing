// Local wall time + IANA zone → instant, including the two DST edge cases and
// a browser in another zone. Fixtures are far-future so they never go stale.
import { describe, it, expect } from "vitest";
import {
  describeScheduledInstant, formatWallTime, isValidTimeZone, offsetMinutesAt, parseWallTime,
  resolveLocalTime, resolveScheduleInstant, wallTimeAt,
} from "@/lib/contentPublishing/localTime";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-06T20:00:00Z");

describe("resolveLocalTime", () => {
  it("resolves an ordinary Los Angeles time to the UTC instant regardless of the machine zone", () => {
    const r = resolveLocalTime({ year: 2026, month: 11, day: 12, hour: 9, minute: 0 }, LA);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.instant.toISOString()).toBe("2026-11-12T17:00:00.000Z"); // PST, UTC-8
    const summer = resolveLocalTime({ year: 2027, month: 7, day: 4, hour: 9, minute: 0 }, LA);
    if (summer.kind === "ok") expect(summer.instant.toISOString()).toBe("2027-07-04T16:00:00.000Z"); // PDT, UTC-7
  });

  it("reports the spring-forward gap as nonexistent instead of shifting it", () => {
    // Clocks jump 2:00 → 3:00 on 2027-03-14 in Los Angeles.
    const r = resolveLocalTime({ year: 2027, month: 3, day: 14, hour: 2, minute: 30 }, LA);
    expect(r.kind).toBe("nonexistent");
    const before = resolveLocalTime({ year: 2027, month: 3, day: 14, hour: 1, minute: 59 }, LA);
    expect(before.kind).toBe("ok");
    const after = resolveLocalTime({ year: 2027, month: 3, day: 14, hour: 3, minute: 0 }, LA);
    expect(after.kind).toBe("ok");
    if (before.kind === "ok" && after.kind === "ok") {
      expect(after.instant.getTime() - before.instant.getTime()).toBe(60_000); // adjacent instants
    }
  });

  it("reports the fall-back hour as ambiguous with both instants, earliest first", () => {
    // 1:30 AM happens twice on 2027-11-07 in Los Angeles (PDT, then PST).
    const r = resolveLocalTime({ year: 2027, month: 11, day: 7, hour: 1, minute: 30 }, LA);
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") {
      expect(r.candidates.map((d) => d.toISOString())).toEqual(["2027-11-07T08:30:00.000Z", "2027-11-07T09:30:00.000Z"]);
    }
  });

  it("works in zones east of UTC and across the date line", () => {
    const tokyo = resolveLocalTime({ year: 2027, month: 1, day: 1, hour: 0, minute: 5 }, "Asia/Tokyo");
    if (tokyo.kind === "ok") expect(tokyo.instant.toISOString()).toBe("2026-12-31T15:05:00.000Z");
    const kiri = resolveLocalTime({ year: 2027, month: 1, day: 1, hour: 0, minute: 0 }, "Pacific/Kiritimati");
    if (kiri.kind === "ok") expect(kiri.instant.toISOString()).toBe("2026-12-31T10:00:00.000Z");
    expect(offsetMinutesAt(new Date("2027-01-01T00:00:00Z"), "Asia/Kolkata")).toBe(330);
  });

  it("round-trips: the stored instant renders as the chosen wall time in its zone", () => {
    const wall = { year: 2027, month: 5, day: 20, hour: 18, minute: 45 };
    const r = resolveLocalTime(wall, "Europe/Paris");
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(wallTimeAt(r.instant, "Europe/Paris")).toEqual(wall);
    expect(formatWallTime(wallTimeAt(r.instant, "Europe/Paris"))).toBe("2027-05-20T18:45");
    // Seen from a laptop set to Tokyo, the same instant still describes the Paris choice.
    expect(describeScheduledInstant(r.instant, "Europe/Paris")).toBe("May 20, 2027 at 6:45 PM — Europe/Paris");
  });
});

describe("resolveScheduleInstant (server validation)", () => {
  it("accepts a valid future request", () => {
    const r = resolveScheduleInstant({ localWallTime: "2026-11-12T09:00", timeZone: LA }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.instant.toISOString()).toBe("2026-11-12T17:00:00.000Z");
  });

  it("rejects malformed times, impossible dates, unknown zones and past times", () => {
    expect(resolveScheduleInstant({ localWallTime: "2026-11-12 09:00", timeZone: LA }, NOW)).toMatchObject({ ok: false, code: "invalid_time" });
    expect(resolveScheduleInstant({ localWallTime: "2026-02-30T09:00", timeZone: LA }, NOW)).toMatchObject({ ok: false, code: "invalid_time" });
    expect(resolveScheduleInstant({ localWallTime: "2026-11-12T09:00", timeZone: "Mars/Olympus" }, NOW)).toMatchObject({ ok: false, code: "invalid_zone" });
    expect(resolveScheduleInstant({ localWallTime: "2026-11-12T09:00", timeZone: 42 }, NOW)).toMatchObject({ ok: false, code: "invalid_zone" });
    expect(resolveScheduleInstant({ localWallTime: "2026-11-06T11:00", timeZone: LA }, NOW)).toMatchObject({ ok: false, code: "past" });
    // Exactly now is also past: the admin must use Publish now.
    expect(resolveScheduleInstant({ localWallTime: "2026-11-06T12:00", timeZone: LA }, NOW)).toMatchObject({ ok: false, code: "past" });
  });

  it("needs an explicit choice for a repeated hour and refuses a skipped one", () => {
    const twice = resolveScheduleInstant({ localWallTime: "2027-11-07T01:30", timeZone: LA }, NOW);
    expect(twice).toMatchObject({ ok: false, code: "ambiguous" });
    if (!twice.ok) expect(twice.candidates).toHaveLength(2);
    const earlier = resolveScheduleInstant({ localWallTime: "2027-11-07T01:30", timeZone: LA, disambiguation: "earlier" }, NOW);
    if (earlier.ok) expect(earlier.instant.toISOString()).toBe("2027-11-07T08:30:00.000Z");
    const later = resolveScheduleInstant({ localWallTime: "2027-11-07T01:30", timeZone: LA, disambiguation: "later" }, NOW);
    if (later.ok) expect(later.instant.toISOString()).toBe("2027-11-07T09:30:00.000Z");
    const gap = resolveScheduleInstant({ localWallTime: "2027-03-14T02:30", timeZone: LA }, NOW);
    expect(gap).toMatchObject({ ok: false, code: "nonexistent" });
    if (!gap.ok) expect(gap.message).toMatch(/does not exist/);
  });

  it("validates zone names and wall-time strings", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Nowhere/Here")).toBe(false);
    expect(parseWallTime("2026-11-12T25:00")).toBeNull();
    expect(parseWallTime("2026-13-01T09:00")).toBeNull();
    expect(parseWallTime("2026-11-12T09:00")).toEqual({ year: 2026, month: 11, day: 12, hour: 9, minute: 0 });
  });
});
