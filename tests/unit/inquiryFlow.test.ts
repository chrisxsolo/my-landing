// The estimator → contact form hand-off, and the contact form's submit order.
import { describe, expect, it, vi } from "vitest";
import {
  buildBookingIntentParams,
  formatBookingIntentSummary,
  mergeIntentPrefill,
  parseBookingIntent,
} from "@/lib/bookingIntent";
import { runInquirySubmission } from "@/lib/contactSubmission";

describe("booking intent hand-off", () => {
  it("round-trips package, headcount, add-ons, date, location, and travel status", () => {
    const params = buildBookingIntentParams({
      sourcePage: "grad-estimator",
      sessionType: "Graduation Portrait",
      school: "Other Bay Area Location",
      headcount: 3,
      duration: "90 minutes",
      date: "May 15, 2027",
      location: "Lands End",
      addOns: ["Extra outfit", "72-hour delivery"],
      estimatedTotal: 975,
      travelPending: true,
    });
    const intent = parseBookingIntent(params);
    expect(intent).toMatchObject({
      sessionType: "Graduation Portrait",
      headcount: 3,
      duration: "90 minutes",
      date: "May 15, 2027",
      location: "Lands End",
      addOns: ["Extra outfit", "72-hour delivery"],
      estimatedTotal: 975,
      travelPending: true,
    });
    expect(formatBookingIntentSummary(intent)).toContain("Estimated total (before travel): $975");
  });

  it("leaves travelPending off when travel is known", () => {
    const intent = parseBookingIntent(buildBookingIntentParams({ estimatedTotal: 350 }));
    expect(intent.travelPending).toBeUndefined();
    expect(formatBookingIntentSummary(intent)).toContain("Estimated total: $350");
  });

  it("applies a new prefill without overwriting fields the visitor typed", () => {
    const current = {
      name: "Sam", email: "sam@example.com", message: "Hi",
      sessionType: "Graduation Portrait", school: "SJSU", people: "2", date: "June 2", location: "",
    };
    const next = mergeIntentPrefill(
      current,
      parseBookingIntent(new URLSearchParams("sessionType=Couples+Session&location=Lands+End&date=May+1")),
      new Set(["date", "name", "email", "message"]),
    );
    expect(next).toEqual({
      ...current,
      sessionType: "Couples Session",
      school: "",
      people: "",
      location: "Lands End",
      date: "June 2", // typed by the visitor: kept
    });
  });
});

describe("contact form submission", () => {
  it("still reports success and navigates when saving the summary throws", async () => {
    const onSent = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runInquirySubmission({
      send: async () => {},
      remember: () => { throw new DOMException("quota", "QuotaExceededError"); },
      onSent,
    });
    expect(result).toEqual({ ok: true });
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0])).not.toContain("@");
    error.mockRestore();
  });

  it("reports the server's error and does not remember or navigate when sending fails", async () => {
    const remember = vi.fn();
    const onSent = vi.fn();
    const result = await runInquirySubmission({
      send: async () => { throw new Error("Please wait a minute before sending another inquiry."); },
      remember,
      onSent,
    });
    expect(result).toEqual({ ok: false, error: "Please wait a minute before sending another inquiry." });
    expect(remember).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for an unnamed failure", async () => {
    const result = await runInquirySubmission({
      send: async () => { throw "network"; },
      remember: () => {},
      onSent: () => {},
    });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});
