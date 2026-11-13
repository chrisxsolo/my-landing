// The invoice's session time: an agreed clock time is kept exactly, a generic
// golden-hour request becomes a booking window worked out from sunset, and
// anything short of that stays unresolved with a reason. Sunsets here are
// injected; nothing in this file touches the network. Clients are synthetic.
//
// 19:54 on 2027-04-24 is the sunset supplied with the reported case. It is a
// fixture, labelled as one; tests/unit/invoiceSunset.test.ts covers what the
// production sources return.

import { describe, expect, it } from "vitest";
import { buildInvoiceDraft, validateInvoiceDraft } from "@/lib/invoiceDraft/build";
import { localToInstant, isRealDate, zoneOffsetMinutes } from "@/lib/invoiceDraft/localTime";
import { goldenHourWindow, parseSessionTime } from "@/lib/invoiceDraft/sessionTime";
import { SF_LOCALITY, type SunsetResolution } from "@/lib/invoiceDraft/sunset";
import { NO_FACTS, type InvoiceInquiry, type PackageEvidence, type SessionFacts } from "@/lib/invoiceDraft/types";

const LA = "America/Los_Angeles";
const FIXTURE_SOURCE = "user-supplied test sunset";

const avery: InvoiceInquiry = {
  id: 9001, name: "Avery Example", email: "avery@example.test",
  school: "California State University, East Bay", location: null, people: "1", session_type: "Graduation Portrait",
  message: "Hi! I'd love grad photos this spring.", date_in_mind: "April 24",
};

const email = (facts: Partial<SessionFacts>): SessionFacts => ({ ...NO_FACTS, source: "email", date_status: "confirmed", total_status: "confirmed", email_status: "read", ...facts });
const selected = (minutes: number): PackageEvidence => ({ status: "selected", minutes, source_message: 3 });

function sunsetAt(date: string, clock: string, source = FIXTURE_SOURCE): SunsetResolution {
  const [h, m] = clock.split(":").map(Number);
  const local = localToInstant(date, h * 60 + m, LA);
  if (local.status !== "ok") throw new Error("bad fixture");
  return {
    status: "resolved", date, locality: SF_LOCALITY.name, latitude: SF_LOCALITY.latitude, longitude: SF_LOCALITY.longitude,
    timeZone: LA, sunsetUtc: local.instant.toISOString(), source,
  };
}

const golden = { location: "Palace of Fine Arts", date: "2027-04-24", time: "golden hour", time_status: "proposed" as const };
const april = sunsetAt("2027-04-24", "19:54");
const hm = (instant: Date) => instant.toISOString().slice(11, 16);

describe("the reported case: golden hour on 2027-04-24 at the Palace of Fine Arts", () => {
  const draft = buildInvoiceDraft(avery, email(golden), { sunset: april });

  it("is ready at $425 with a 6:30–7:30 pm window, 24 minutes clear of sunset", () => {
    expect(draft.status).toBe("ready");
    expect(draft.reviewReasons).toEqual([]);
    expect(draft.session.time).toBe("6:30–7:30 pm");
    expect(draft.session.timeDetail).toMatchObject({
      status: "calculated", requested: "golden hour", start: "18:30", end: "19:30", endDerived: false,
      timeZone: LA, zoneAbbreviation: "PDT", sourceLabel: "Calculated from sunset",
      sunset: { local: "7:54 pm", source: FIXTURE_SOURCE, locality: "San Francisco" },
    });
    expect(draft.pricing).toMatchObject({ baseCents: 42500, travel: { kind: "included", amountCents: 0 }, totalCents: 42500 });
    expect(validateInvoiceDraft(draft)).toMatchObject({ ok: true });
  });

  it("crosses into April 25 in UTC while the session and due date stay April 24", () => {
    expect(draft.session.timeDetail).toMatchObject({
      startUtc: "2027-04-25T01:30:00.000Z", endUtc: "2027-04-25T02:30:00.000Z", sunset: { utc: "2027-04-25T02:54:00.000Z" },
    });
    expect(draft.session.date).toBe("2027-04-24");
    expect(draft.session.dateConfidence).toBe("confirmed");
    expect(draft.dueDate).toBe("2027-04-24");
  });

  it("keeps the confirmed location and never calls the calculated time confirmed", () => {
    expect(draft.session).toMatchObject({ location: "Palace of Fine Arts", locationSource: "email", school: "California State University, East Bay" });
    expect(draft.session.timeDetail.status).not.toBe("confirmed");
    expect(draft.note).not.toMatch(/6:30|golden|sunset/i);
  });

  it("keeps the booked length for a mini and for 90 minutes", () => {
    const mini = buildInvoiceDraft(avery, email({ ...golden, package: selected(30) }), { sunset: april });
    expect(mini.session).toMatchObject({ time: "6:30–7:00 pm", durationMinutes: 30 });
    expect(mini.pricing.totalCents).toBe(32500);
    const long = buildInvoiceDraft(avery, email({ ...golden, package: selected(90) }), { sunset: april });
    expect(long.session).toMatchObject({ time: "6:00–7:30 pm", durationMinutes: 90 });
  });

  it("shows whichever sunset the source gave: a different sunset moves the window and is named", () => {
    const later = buildInvoiceDraft(avery, email(golden), { sunset: sunsetAt("2027-04-24", "20:10", "US Naval Observatory") });
    expect(later.session.time).toBe("6:45–7:45 pm");
    expect(later.session.timeDetail.sunset).toMatchObject({ local: "8:10 pm", source: "US Naval Observatory" });
  });
});

describe("the booking policy", () => {
  const window = (clock: string, minutes: number, date = "2027-04-24") => {
    const sunset = sunsetAt(date, clock);
    if (sunset.status !== "resolved") throw new Error("bad fixture");
    const w = goldenHourWindow(new Date(sunset.sunsetUtc), minutes);
    return w && {
      start: hm(w.start), end: hm(w.end), length: (w.end.getTime() - w.start.getTime()) / 60000,
      buffer: (new Date(sunset.sunsetUtc).getTime() - w.end.getTime()) / 60000,
    };
  };

  it("starts 90 minutes before sunset on the nearest quarter hour", () => {
    expect(window("19:54", 60)).toEqual({ start: "01:30", end: "02:30", length: 60, buffer: 24 });
    expect(window("19:52", 60)).toMatchObject({ start: "01:15", buffer: 37 });
    expect(window("19:53", 60)).toMatchObject({ start: "01:30", buffer: 23 });
  });

  it("breaks an exact half-quarter tie toward the earlier boundary", () => {
    const sunset = new Date("2027-04-25T02:52:30.000Z");
    const w = goldenHourWindow(sunset, 60);
    expect(hm(w!.start)).toBe("01:15");
    expect(hm(goldenHourWindow(new Date(sunset.getTime() + 1000), 60)!.start)).toBe("01:30");
  });

  it("always runs the full length and ends at least 15 minutes before sunset", () => {
    for (let minute = 0; minute < 60; minute++) {
      for (const length of [30, 60, 90, 120]) {
        const clock = `19:${String(minute).padStart(2, "0")}`;
        const w = window(clock, length)!;
        expect(Number(w.start.slice(3)) % 15, clock).toBe(0);
        expect(w.length, clock).toBe(length);
        expect(w.buffer, clock).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("moves a long session's start back instead of shortening it", () => {
    expect(window("19:54", 90)).toEqual({ start: "01:00", end: "02:30", length: 90, buffer: 24 });
    expect(window("19:54", 120)).toEqual({ start: "00:30", end: "02:30", length: 120, buffer: 24 });
  });

  it("offers nothing for a length with no window on file", () => {
    expect(goldenHourWindow(new Date("2027-04-25T02:54:00Z"), 45)).toBeNull();
    expect(goldenHourWindow(new Date(Number.NaN), 60)).toBeNull();
  });
});

describe("explicit times win over golden hour", () => {
  it("keeps a confirmed 6:00–7:00 pm exactly, even with golden hour in the thread", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "6:00 PM - 7:00 PM", time_status: "confirmed" }), { sunset: april });
    expect(draft.status).toBe("ready");
    expect(draft.session.time).toBe("6:00–7:00 pm");
    expect(draft.session.timeDetail).toMatchObject({ status: "confirmed", start: "18:00", end: "19:00", endDerived: false, sourceLabel: "Confirmed in email", sunset: null });
  });

  it("derives the end of a confirmed start from the package and says so", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "6:00 PM", time_status: "confirmed" }), { sunset: april });
    expect(draft.session.time).toBe("6:00–7:00 pm");
    expect(draft.session.timeDetail).toMatchObject({ status: "confirmed", endDerived: true });
    expect(draft.session.timeDetail.sourceLabel).toMatch(/end derived from the session length/);
  });

  it("shows a proposed time as proposed, not confirmed", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "5:45 PM", time_status: "proposed" }), { sunset: april });
    expect(draft.status).toBe("ready");
    expect(draft.session.time).toBe("5:45–6:45 pm");
    expect(draft.session.timeDetail).toMatchObject({ status: "proposed", sourceLabel: expect.stringMatching(/^Proposed in email, not confirmed/) });
  });

  it("keeps an agreed time that runs past the sunset buffer and warns about it", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "7:00 PM - 8:00 PM", time_status: "confirmed" }), { sunset: april });
    expect(draft.status).toBe("ready");
    expect(draft.session.time).toBe("7:00–8:00 pm");
    expect(draft.warnings.join(" ")).toMatch(/ends 6 minutes after sunset \(7:54 pm, user-supplied test sunset\)\. The time is kept as agreed/);
  });

  it("keeps a confirmed time when the sunset lookup failed", () => {
    const failed: SunsetResolution = { status: "failed", date: "2027-04-24", reason: "the lookup timed out" };
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "6:00 PM - 7:00 PM", time_status: "confirmed" }), { sunset: failed });
    expect(draft.status).toBe("ready");
    expect(draft.session.time).toBe("6:00–7:00 pm");
  });

  it("asks for review when a confirmed range disagrees with the package length", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "6:00 PM - 7:00 PM", time_status: "confirmed", package: selected(30) }), { sunset: april });
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/agreed time 6:00–7:00 pm is 60 minutes, but the package is 30 minutes/);
    expect(draft.session.time).toBe("6:00–7:00 pm");
    expect(draft.pricing.totalCents).toBe(32500);
  });

  it("asks for review on conflicting proposals without picking one", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "6:00 PM", time_status: "conflicting" }), { sunset: april });
    expect(draft.status).toBe("review");
    expect(draft.session.time).toBeNull();
    expect(draft.session.timeDetail.status).toBe("unresolved");
    expect(draft.pricing.totalCents).toBe(42500);
  });
});

describe("no unsolicited evening range", () => {
  it("offers no time when none was requested", () => {
    const draft = buildInvoiceDraft(avery, email({ location: "Palace of Fine Arts", date: "2027-04-24" }), { sunset: april });
    expect(draft.status).toBe("ready");
    expect(draft.session.time).toBeNull();
    expect(draft.session.timeDetail.status).toBe("none");
  });

  it("reads meaning, not the words 'golden hour'", () => {
    expect(parseSessionTime("golden hour").kind).toBe("golden_hour");
    expect(parseSessionTime("Golden Hour / sunset").kind).toBe("golden_hour");
    const notARequest = [
      "not golden hour", "golden hour is unavailable", "morning, before golden hour", "after sunset", "an hour before sunset",
      "golden hour if possible, no rush", "golden hour after 5", "morning golden hour",
    ];
    for (const phrase of notARequest) expect(parseSessionTime(phrase).kind, phrase).toBe("unclear");
    expect(parseSessionTime("sunrise").kind).toBe("phrase");
    expect(parseSessionTime(null).kind).toBe("none");
  });

  it("takes a clock time only when the whole phrase is one time or one range", () => {
    expect(parseSessionTime("6:00 PM")).toMatchObject({ kind: "clock", startMinutes: 1080, endMinutes: null });
    expect(parseSessionTime("12 pm")).toMatchObject({ kind: "clock", startMinutes: 720 });
    expect(parseSessionTime("11-1 pm")).toMatchObject({ kind: "clock", startMinutes: 660, endMinutes: 780 });
    expect(parseSessionTime("6-7pm")).toMatchObject({ kind: "clock", startMinutes: 1080, endMinutes: 1140 });
    expect(parseSessionTime("5:30-6:30pm")).toMatchObject({ kind: "clock", startMinutes: 1050, endMinutes: 1110 });
    expect(parseSessionTime("6:00 PM - 7:00 PM")).toMatchObject({ kind: "clock", startMinutes: 1080, endMinutes: 1140 });
    expect(parseSessionTime("18:30-19:30")).toMatchObject({ kind: "clock", startMinutes: 1110, endMinutes: 1170 });
    const misreadable = [
      "between 5 and 6 pm", "5 or 6 pm", "sunset at 7:54 pm", "golden hour, sunset 7:54pm", "golden hour or 5pm", "not 5pm, 6pm",
      "after 5pm", "before 6 pm", "May 5 - 6pm", "5pm-4pm", "10pm-12am", "6:00 PM golden hour", "6:30", "noon", "around 6pm",
    ];
    for (const phrase of misreadable) expect(parseSessionTime(phrase).kind, phrase).toBe("unclear");
  });

  it("sends a time it cannot read as one clear time to review, never to a guess", () => {
    for (const time of ["between 5 and 6 pm", "sunset at 7:54 pm", "not golden hour"]) {
      const draft = buildInvoiceDraft(avery, email({ ...golden, time, time_status: "confirmed" }), { sunset: april });
      expect(draft.status, time).toBe("review");
      expect(draft.session.time, time).toBeNull();
      expect(draft.session.timeDetail, time).toMatchObject({ status: "unresolved", requested: time, start: null });
      expect(draft.reviewReasons.join(" "), time).toMatch(/Session time needs confirmation: the thread says/);
      expect(draft.pricing.totalCents, time).toBe(42500);
    }
  });

  it("passes a sunrise request through untouched, with no range", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, time: "sunrise" }), { sunset: april });
    expect(draft.status).toBe("ready");
    expect(draft.session.time).toBe("sunrise");
    expect(draft.session.timeDetail).toMatchObject({ status: "proposed", start: null, end: null, sunset: null });
  });
});

describe("golden hour that cannot be resolved stays unresolved, and the price stays", () => {
  const unresolved = (facts: Partial<SessionFacts>, sunset: SunsetResolution | null = april, inquiry = avery) => {
    const draft = buildInvoiceDraft(inquiry, email({ ...golden, ...facts }), { sunset });
    expect(draft.status).toBe("review");
    expect(draft.session.time).toBeNull();
    expect(draft.session.timeDetail).toMatchObject({ status: "unresolved", requested: "golden hour", start: null, end: null, sunset: null });
    expect(draft.reviewReasons.filter((reason) => reason.startsWith("Golden hour requested — time needs confirmation: "))).toHaveLength(1);
    expect(validateInvoiceDraft(draft)).toMatchObject({ ok: true });
    return draft;
  };

  it("when the date is only tentative, missing, or not a real date", () => {
    expect(unresolved({ date_status: "proposed" }).reviewReasons.join(" ")).toMatch(/session date is not confirmed in email/);
    expect(unresolved({ date: null }, null, { ...avery, date_in_mind: null }).reviewReasons.join(" ")).toMatch(/no session date is known/);
    const impossible = unresolved({ date: "2027-02-30" }, null, { ...avery, date_in_mind: null });
    expect(impossible.reviewReasons.join(" ")).toMatch(/no session date is known/);
    expect(impossible).toMatchObject({ dueDate: null, session: { date: null, dateConfidence: "unknown" } });
  });

  it("when the shoot location is unknown, assumed from the school, or outside San Francisco", () => {
    const sfsu = { ...avery, school: "SFSU" };
    expect(unresolved({ location: null }, april, sfsu).reviewReasons.join(" ")).toMatch(/only assumed from the school/);
    const elsewhere = unresolved({ location: "UC Berkeley" });
    expect(elsewhere.reviewReasons.join(" ")).toMatch(/only worked out for San Francisco shoots, and UC Berkeley is not/);
    expect(elsewhere.session.location).toBe("UC Berkeley");
    expect(unresolved({ location: "Point Reyes" }).pricing.totalCents).toBeNull();
  });

  it("when the lookup failed, never ran, or answered for another date, place or zone", () => {
    const priced = (draft: ReturnType<typeof unresolved>) => {
      expect(draft.pricing.totalCents).toBe(42500);
      expect(draft.session).toMatchObject({ date: "2027-04-24", location: "Palace of Fine Arts", locationSource: "email" });
      expect(draft.dueDate).toBe("2027-04-24");
    };
    priced(unresolved({}, { status: "failed", date: "2027-04-24", reason: "the sunset lookup timed out" }));
    priced(unresolved({}, null));
    priced(unresolved({}, sunsetAt("2027-04-23", "19:53")));
    const resolved = april as Extract<SunsetResolution, { status: "resolved" }>;
    priced(unresolved({}, { ...resolved, timeZone: "America/New_York" }));
    priced(unresolved({}, { ...resolved, locality: "Oakland" }));
    priced(unresolved({}, { ...resolved, latitude: 40.7 }));
    priced(unresolved({}, { ...resolved, sunsetUtc: "not a date" }));
    priced(unresolved({}, { ...resolved, sunsetUtc: "2027-04-24T17:00:00.000Z" }));
  });

  it("when the session length is not settled", () => {
    const draft = unresolved({}, april, { ...avery, message: "one hour session or maybe the 30 minute mini session" });
    expect(draft.reviewReasons.join(" ")).toMatch(/session length is not settled/);
  });

  it("when the thread still has more than one time on the table", () => {
    expect(unresolved({ time_status: "conflicting" }).reviewReasons.join(" ")).toMatch(/more than one time on the table/);
  });
});

describe("dates, zones and daylight saving", () => {
  const cases: [string, string, string, string, string][] = [
    ["2027-01-15", "17:15", "3:45–4:45 pm", "PST", "2027-01-15T23:45:00.000Z"],
    ["2027-03-13", "18:15", "4:45–5:45 pm", "PST", "2027-03-14T00:45:00.000Z"],
    ["2027-03-14", "19:16", "5:45–6:45 pm", "PDT", "2027-03-15T00:45:00.000Z"],
    ["2027-06-21", "20:35", "7:00–8:00 pm", "PDT", "2027-06-22T02:00:00.000Z"],
    ["2027-11-06", "18:06", "4:30–5:30 pm", "PDT", "2027-11-06T23:30:00.000Z"],
    ["2027-11-07", "17:05", "3:30–4:30 pm", "PST", "2027-11-07T23:30:00.000Z"],
    ["2028-02-29", "18:03", "4:30–5:30 pm", "PST", "2028-03-01T00:30:00.000Z"],
  ];

  it("uses the zone's own offset on each date, winter, summer and either side of both changes", () => {
    for (const [date, sunset, time, zone, startUtc] of cases) {
      const draft = buildInvoiceDraft(avery, email({ ...golden, date }), { sunset: sunsetAt(date, sunset) });
      expect(draft.session.time, date).toBe(time);
      expect(draft.session.timeDetail, date).toMatchObject({ zoneAbbreviation: zone, startUtc, timeZone: LA });
      expect(draft.session.date, date).toBe(date);
      expect(draft.dueDate, date).toBe(date);
    }
  });

  it("gives the same answer whatever zone the host runs in", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "Asia/Tokyo", "America/New_York", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        const draft = buildInvoiceDraft(avery, email(golden), { sunset: april });
        expect(draft.session.time, tz).toBe("6:30–7:30 pm");
        expect(draft.session.timeDetail.startUtc, tz).toBe("2027-04-25T01:30:00.000Z");
        expect(draft.dueDate, tz).toBe("2027-04-24");
      }
    } finally {
      if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
    }
  });

  it("reads offsets from the zone database, not a fixed one", () => {
    expect(zoneOffsetMinutes(new Date("2027-04-25T02:00:00Z"), LA)).toBe(-420);
    expect(zoneOffsetMinutes(new Date("2027-01-15T02:00:00Z"), LA)).toBe(-480);
  });

  it("checks real calendar validity, leap days included", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2027-02-29")).toBe(false);
    expect(isRealDate("2027-04-31")).toBe(false);
    expect(isRealDate("2027-4-24")).toBe(false);
  });

  it("reports a wall time the clocks skipped or repeated instead of picking an offset", () => {
    expect(localToInstant("2027-03-14", 2 * 60 + 30, LA).status).toBe("nonexistent");
    expect(localToInstant("2027-11-07", 60 + 30, LA).status).toBe("ambiguous");
    expect(localToInstant("2027-03-14", 18 * 60, LA)).toMatchObject({ status: "ok" });
  });

  it("sends an explicit time inside a daylight-saving change to review", () => {
    const draft = buildInvoiceDraft(avery, email({ ...golden, date: "2027-11-07", time: "1:30 AM", time_status: "confirmed" }), { sunset: null });
    expect(draft.status).toBe("review");
    expect(draft.session.time).toBeNull();
    expect(draft.reviewReasons.join(" ")).toMatch(/daylight-saving change on 2027-11-07/);
  });
});
