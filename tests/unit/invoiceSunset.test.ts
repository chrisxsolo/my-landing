// Where the invoice's sunset comes from. The published value is the US Naval
// Observatory's; the fallback is the repository's solar calculator, which is
// held here to the published figures. No test in this file uses the network:
// the lookup's fetch is injected.
//
// PUBLISHED holds USNO "Sun and Moon Data for One Day" sunsets for San
// Francisco (37.7749, -122.4194), local time, retrieved 2026-11-11 from
// aa.usno.navy.mil/api/rstt/oneday. They are the validation fixtures for the
// calculator and the tolerance it is labelled with.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDateAndMinutes } from "@/lib/invoiceDraft/localTime";
import {
  CALCULATED_SOURCE, CALCULATED_TOLERANCE_MINUTES, SF_LOCALITY, USNO_SOURCE,
  calculatedSunset, clearSunsetCache, parseUsnoSunset, resolveSunset, usableSunset, type SunsetFetch,
} from "@/lib/invoiceDraft/sunset";

const PUBLISHED: [date: string, sunset: string, offsetHours: number][] = [
  ["2026-12-05", "16:51", -8], ["2027-01-15", "17:15", -8], ["2027-03-13", "18:15", -8], ["2027-03-14", "19:16", -7],
  ["2027-04-24", "19:54", -7], ["2027-05-22", "20:19", -7], ["2027-06-21", "20:35", -7], ["2027-09-22", "19:07", -7],
  ["2027-11-06", "18:06", -7], ["2027-11-07", "17:05", -8], ["2027-12-21", "16:54", -8], ["2028-02-29", "18:03", -8],
];

const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

function usnoBody(date: string, sunset: string, offsetHours: number, overrides: Record<string, unknown> = {}) {
  const [year, month, day] = date.split("-").map(Number);
  return {
    apiversion: "4.0.1", type: "Feature",
    geometry: { type: "Point", coordinates: [SF_LOCALITY.longitude, SF_LOCALITY.latitude] },
    properties: { data: { year, month, day, tz: offsetHours, sundata: [{ phen: "Rise", time: "06:23" }, { phen: "Set", time: sunset }], ...overrides } },
  };
}

const answering = (body: unknown, ok = true): SunsetFetch => vi.fn(async () => ({ ok, json: async () => body }));

beforeEach(() => {
  clearSunsetCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the calculated fallback, validated against the published ephemeris", () => {
  it(`stays within ${CALCULATED_TOLERANCE_MINUTES} minutes of every published sunset, on the session's own local date`, () => {
    for (const [date, published] of PUBLISHED) {
      const sunset = calculatedSunset(date);
      expect(sunset.status, date).toBe("resolved");
      if (sunset.status !== "resolved") continue;
      const local = localDateAndMinutes(new Date(sunset.sunsetUtc), SF_LOCALITY.timeZone);
      expect(local.date, date).toBe(date);
      expect(Math.abs(local.minutes - minutesOf(published)), date).toBeLessThanOrEqual(CALCULATED_TOLERANCE_MINUTES);
      expect(sunset.source, date).toBe(CALCULATED_SOURCE);
    }
  });

  it("is labelled a calculation, with its tolerance, never a verified lookup", () => {
    expect(CALCULATED_SOURCE).toMatch(/^calculated sunset/);
    expect(CALCULATED_SOURCE).toContain(`±${CALCULATED_TOLERANCE_MINUTES} min`);
  });

  it("fails rather than guessing for a date that does not exist", () => {
    expect(calculatedSunset("2027-02-30")).toMatchObject({ status: "failed" });
    expect(calculatedSunset("soon")).toMatchObject({ status: "failed" });
  });
});

describe("the published lookup", () => {
  it("asks only for a date, coordinates and the zone offset, at the fixed endpoint", async () => {
    const fetcher = answering(usnoBody("2027-04-24", "19:54", -7));
    const sunset = await resolveSunset("2027-04-24", SF_LOCALITY, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://aa.usno.navy.mil/api/rstt/oneday?date=2027-04-24&coords=37.7749,-122.4194&tz=-7");
    expect(sunset).toEqual({
      status: "resolved", date: "2027-04-24", locality: "San Francisco", latitude: 37.7749, longitude: -122.4194,
      timeZone: "America/Los_Angeles", sunsetUtc: "2027-04-25T02:54:00.000Z", source: USNO_SOURCE,
    });
  });

  it("asks with the winter offset in winter", async () => {
    const fetcher = answering(usnoBody("2027-01-15", "17:15", -8));
    const sunset = await resolveSunset("2027-01-15", SF_LOCALITY, fetcher);
    expect((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/tz=-8$/);
    expect(sunset).toMatchObject({ sunsetUtc: "2027-01-16T01:15:00.000Z", source: USNO_SOURCE });
  });

  it("reads every published fixture to the right instant", () => {
    for (const [date, published, offset] of PUBLISHED) {
      const instant = parseUsnoSunset(usnoBody(date, published, offset), date, SF_LOCALITY, offset);
      expect(instant && localDateAndMinutes(instant, SF_LOCALITY.timeZone), date).toEqual({ date, minutes: minutesOf(published) });
    }
  });

  it("caches a published answer by date and place, and never the fallback", async () => {
    const fetcher = answering(usnoBody("2027-04-24", "19:54", -7));
    await resolveSunset("2027-04-24", SF_LOCALITY, fetcher);
    await resolveSunset("2027-04-24", SF_LOCALITY, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    clearSunsetCache();
    const down = answering({}, false);
    await resolveSunset("2027-04-24", SF_LOCALITY, down);
    await resolveSunset("2027-04-24", SF_LOCALITY, down);
    expect(down).toHaveBeenCalledTimes(2);
  });
});

describe("a lookup that cannot be trusted falls back to the labelled calculation", () => {
  const fallsBack = async (fetcher: SunsetFetch) => {
    const sunset = await resolveSunset("2027-04-24", SF_LOCALITY, fetcher);
    expect(sunset).toMatchObject({ status: "resolved", date: "2027-04-24", source: CALCULATED_SOURCE });
    expect(usableSunset(sunset, "2027-04-24")).toBe(true);
  };

  it("on a timeout or network error", async () => {
    await fallsBack(vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); }));
  });

  it("on an error status or a body that is not the expected shape", async () => {
    await fallsBack(answering(usnoBody("2027-04-24", "19:54", -7), false));
    await fallsBack(answering("<html>maintenance</html>"));
    await fallsBack(answering(null));
    await fallsBack(vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError("bad json"); } })));
  });

  it("on an answer for the wrong date, place or offset", async () => {
    await fallsBack(answering(usnoBody("2027-04-23", "19:53", -7)));
    await fallsBack(answering(usnoBody("2027-04-24", "19:54", 0)));
    await fallsBack(answering({ ...usnoBody("2027-04-24", "19:54", -7), geometry: { type: "Point", coordinates: [-73.98, 40.75] } }));
  });

  it("on a missing or malformed sunset", async () => {
    await fallsBack(answering(usnoBody("2027-04-24", "19:54", -7, { sundata: [{ phen: "Rise", time: "06:23" }] })));
    await fallsBack(answering(usnoBody("2027-04-24", "7:54 pm", -7)));
    await fallsBack(answering(usnoBody("2027-04-24", "25:99", -7)));
    await fallsBack(answering(usnoBody("2027-04-24", "06:10", -7)));
  });

  it("on a published sunset far from where the sun actually sets, or more than one", async () => {
    await fallsBack(answering(usnoBody("2027-04-24", "15:00", -7)));
    await fallsBack(answering(usnoBody("2027-04-24", "23:59", -7)));
    await fallsBack(answering(usnoBody("2027-04-24", "20:05", -7)));
    await fallsBack(answering(usnoBody("2027-04-24", "19:54", -7, { sundata: [{ phen: "Set", time: "19:54" }, { phen: "Set", time: "19:55" }] })));
  });
});

describe("what never resolves", () => {
  it("returns nothing without a date and fails on a date that is not real, without calling out", async () => {
    const fetcher = answering(usnoBody("2027-04-24", "19:54", -7));
    expect(await resolveSunset(null, SF_LOCALITY, fetcher)).toBeNull();
    expect(await resolveSunset("2027-02-30", SF_LOCALITY, fetcher)).toMatchObject({ status: "failed", reason: expect.stringMatching(/not a real calendar date/) });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a resolution for another date, zone or place, or with a broken instant", () => {
    const good = calculatedSunset("2027-04-24");
    if (good.status !== "resolved") throw new Error("expected a sunset");
    expect(usableSunset(good, "2027-04-24")).toBe(true);
    expect(usableSunset(good, "2027-04-25")).toBe(false);
    expect(usableSunset({ ...good, timeZone: "UTC" }, "2027-04-24")).toBe(false);
    expect(usableSunset({ ...good, locality: "Oakland" }, "2027-04-24")).toBe(false);
    expect(usableSunset({ ...good, sunsetUtc: "Infinity" }, "2027-04-24")).toBe(false);
    expect(usableSunset({ status: "failed", date: "2027-04-24", reason: "x" }, "2027-04-24")).toBe(false);
    expect(usableSunset(null, "2027-04-24")).toBe(false);
  });
});
