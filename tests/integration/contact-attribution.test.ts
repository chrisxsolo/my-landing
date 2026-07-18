// End-to-end funnel test (spec: estimator → contact → inquiry → attribution).
//
// Exercises the real path a graduation lead takes:
//   1. configure an estimate          (lib/pricing.calculateGraduationEstimate)
//   2. hand it to the contact form     (lib/bookingIntent serialize/parse)
//   3. submit the form                 (the actual POST handler in app/api/contact)
//   4. an inquiry row is created       (with the prefilled selections)
//   5. attribution is attached         (anonymous_session_id stitch + inquiry_submit event)
//
// The contact route builds its own Supabase client from NEXT_PUBLIC_SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY, so we point those at the local test DB before it runs.
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb } from "./helpers";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { calculateGraduationEstimate } from "@/lib/pricing";
import {
  buildBookingIntentParams,
  parseBookingIntent,
  headcountToSelectValue,
  formatBookingIntentSummary,
} from "@/lib/bookingIntent";

// Route → test DB. Set before the handler's createSupabaseServerClient() runs.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY ?? "";
delete process.env.RESEND_API_KEY; // skip the email send — the inquiry must still save

import { POST } from "@/app/api/contact/route";

const grad = PRICING_CATALOG.graduation;

beforeAll(() => resetDb());

describe("graduation estimator → contact → inquiry → attribution", () => {
  it("prefills the form, creates the inquiry, and stitches attribution", async () => {
    // ── 1. configure an estimate ────────────────────────────────────────────
    const estimate = calculateGraduationEstimate({
      school: "uc-berkeley",
      people: 3,
      sessionLength: "1.5hr",
      extraOutfit: true,
      secondLocation: false,
      expedited: true,
      champagne: false,
    });
    expect(estimate.subtotal).toBeGreaterThan(0);

    // ── 2. estimator → contact prefill (round-trips through the query string) ─
    const addOns = [grad.addOns.extraOutfit.shortLabel, grad.addOns.expedited.shortLabel];
    const intent = parseBookingIntent(
      buildBookingIntentParams({
        sourcePage: "grad-estimator",
        sessionType: "Graduation Portrait",
        school: "UC Berkeley",
        headcount: 3,
        duration: "90 minutes",
        addOns,
        estimatedTotal: estimate.subtotal,
      }),
    );
    expect(intent.sessionType).toBe("Graduation Portrait");
    expect(intent.school).toBe("UC Berkeley");
    expect(intent.headcount).toBe(3);
    expect(intent.duration).toBe("90 minutes");
    expect(intent.addOns).toEqual(addOns);
    expect(intent.estimatedTotal).toBe(estimate.subtotal);
    // The headcount must land on a real <select> option value (the old graduates→blank bug).
    expect(headcountToSelectValue(intent.headcount!)).toBe("3");

    // Mirror ContactClient.getInitialForm() + the submit-time message fold.
    const form = {
      name: "Mia Rodriguez",
      email: `e2e-${Date.now()}@example.com`,
      phone: "",
      instagram: "",
      sessionType: intent.sessionType ?? "",
      school: intent.school ?? "",
      people: intent.headcount ? headcountToSelectValue(intent.headcount) : "",
      date: "",
      preferredTime: "",
      location: "",
      message: "Looking to book around graduation week.",
    };
    expect(form.sessionType).toBe("Graduation Portrait");
    expect(form.school).toBe("UC Berkeley");
    expect(form.people).toBe("3");

    const summary = formatBookingIntentSummary(intent);
    const message = `${summary}\n\n${form.message}`.trim();
    expect(summary).toContain("Estimated total:");
    expect(summary).toContain(grad.addOns.expedited.shortLabel);

    // ── 3. submit the form via the real route handler ───────────────────────
    const visitorId = crypto.randomUUID(); // the attribution stitch key
    const payload = {
      ...form,
      message,
      website: "", // honeypot empty
      renderedAt: Date.now() - 5_000, // past the human-timing gate
      anonymousSessionId: visitorId,
    };
    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://www.google.com/" },
      body: JSON.stringify(payload),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    // ── 4. an inquiry row is created with the prefilled selections ───────────
    const { data: inquiry, error } = await service
      .from("inquiries")
      .select("*")
      .eq("email", form.email)
      .single();
    expect(error).toBeNull();
    expect(inquiry).toBeTruthy();
    expect(inquiry!.name).toBe("Mia Rodriguez");
    expect(inquiry!.session_type).toBe("Graduation Portrait");
    expect(inquiry!.school).toBe("University of California, Berkeley"); // canonical name (schoolDetection.ts)
    expect(inquiry!.people).toBe("3");
    expect(inquiry!.status).toBe("new");
    expect(inquiry!.message).toContain("Add-ons:");
    expect(inquiry!.message).toContain("Estimated total:");

    // ── 5. attribution is attached ──────────────────────────────────────────
    // 5a. the stitch: inquiry carries the visitor id.
    expect(inquiry!.anonymous_session_id).toBe(visitorId);

    // 5b. a server-side inquiry_submit funnel event, tied to the same visitor.
    const { data: events } = await service
      .from("content_events")
      .select("event_type, path, anonymous_session_id")
      .eq("anonymous_session_id", visitorId);
    expect(events).toBeTruthy();
    const submit = events!.find((e) => e.event_type === "inquiry_submit");
    expect(submit, "expected an inquiry_submit funnel event for this visitor").toBeTruthy();
    expect(submit!.path).toBe("/contact");
  });
});
