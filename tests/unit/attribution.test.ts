import { describe, it, expect } from "vitest";
import { buildAttributionReport } from "@/lib/attribution/build";
import { classifyChannel, inferSource } from "@/lib/attribution/channels";
import type { InquiryLite, PaymentLite, VisitorSessionRow, FunnelEventLite } from "@/lib/attribution/types";

const session = (over: Partial<VisitorSessionRow>): VisitorSessionRow => ({
  anonymous_session_id: "vid", landing_page: null, first_referrer: null, latest_referrer: null,
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null,
  first_seen_at: "2026-05-01T00:00:00Z", ...over,
});
const inquiry = (over: Partial<InquiryLite>): InquiryLite => ({
  id: 1, created_at: "2026-05-03T00:00:00Z", anonymous_session_id: null, session_type: null,
  school: null, location: null, message: "", email: "a@b.com", payment_status: null, ...over,
});
const pay = (over: Partial<PaymentLite>): PaymentLite => ({
  inquiry_id: 1, amount_cents: 0, status: "active", payment_type: "full", paid_at: "2026-05-10T00:00:00Z", ...over,
});

describe("channels", () => {
  it("classifies UTM source first, then referrer host", () => {
    expect(classifyChannel(session({ utm_source: "instagram" })).key).toBe("instagram");
    expect(classifyChannel(session({ utm_source: "ig" })).key).toBe("instagram");
    expect(classifyChannel(session({ first_referrer: "www.google.com" })).key).toBe("google");
    expect(classifyChannel(session({ first_referrer: "direct" })).key).toBe("direct");
  });
  it("infers source from message only when there is a signal", () => {
    expect(inferSource("found you on instagram")?.key).toBe("instagram");
    expect(inferSource("my friend recommended you")?.key).toBe("referral");
    expect(inferSource("hello I want photos")).toBeNull();
  });
});

describe("buildAttributionReport", () => {
  it("ties payments to the source that created them via the session stitch", () => {
    const report = buildAttributionReport({
      sessions: [session({ anonymous_session_id: "v1", utm_source: "instagram", landing_page: "/blog/golden-hour", utm_campaign: "spring", first_referrer: "www.instagram.com" })],
      inquiries: [inquiry({ id: 1, anonymous_session_id: "v1", school: "SJSU" })],
      payments: [pay({ inquiry_id: 1, amount_cents: 40000 })],
      events: [],
    });
    expect(report.totals.tracked).toBe(1);
    expect(report.totals.attributedRevenueCents).toBe(40000);
    const ig = report.bySource.find((s) => s.label === "Instagram");
    expect(ig?.confidence).toBe("tracked");
    expect(ig?.revenueCents).toBe(40000);
    expect(ig?.bookingRate).toBe(1);
    expect(report.byLandingPage[0].key).toBe("/blog/golden-hour");
    expect(report.byBlogPost[0].revenueCents).toBe(40000);
    expect(report.bySchool.find((r) => r.key === "sjsu")?.revenueCents).toBe(40000);
    expect(report.byInstagramCampaign[0].key).toBe("spring");
    // 2026-05-01 first seen → 2026-05-10 paid = 9 days
    expect(report.avgDaysFirstVisitToPayment).toBeCloseTo(9, 5);
  });

  it("labels message-inferred sources and isolates pre-tracking revenue", () => {
    const report = buildAttributionReport({
      sessions: [],
      inquiries: [
        inquiry({ id: 1, message: "saw your instagram", payment_status: "paid" }),
        inquiry({ id: 2, message: "no signal here" }),
      ],
      payments: [pay({ inquiry_id: 1, amount_cents: 30000 }), pay({ inquiry_id: 2, amount_cents: 20000 })],
      events: [],
    });
    expect(report.totals.inferred).toBe(1);
    expect(report.totals.unattributed).toBe(1);
    const inferredIg = report.bySource.find((s) => s.confidence === "inferred");
    expect(inferredIg?.label).toContain("(inferred)");
    expect(inferredIg?.revenueCents).toBe(30000);
    // id=2 has no signal → revenue is unattributed, never silently merged
    expect(report.totals.unattributedRevenueCents).toBe(20000);
    expect(report.totals.attributedRevenueCents).toBe(30000);
  });

  it("computes estimator→inquiry conversion and pages-before-inquiry from events", () => {
    const events: FunnelEventLite[] = [
      { anonymous_session_id: "v1", event_type: "estimator_complete", viewed_at: "2026-05-02T00:00:00Z" },
      { anonymous_session_id: "v1", event_type: "inquiry_submit", viewed_at: "2026-05-03T00:00:00Z" },
      { anonymous_session_id: "v2", event_type: "estimator_complete", viewed_at: "2026-05-02T00:00:00Z" },
      { anonymous_session_id: "v1", event_type: "page_view", viewed_at: "2026-05-01T00:00:00Z" },
      { anonymous_session_id: "v1", event_type: "page_view", viewed_at: "2026-05-02T00:00:00Z" },
      { anonymous_session_id: "v1", event_type: "page_view", viewed_at: "2026-06-01T00:00:00Z" }, // after inquiry, excluded
    ];
    const report = buildAttributionReport({
      sessions: [session({ anonymous_session_id: "v1" })],
      inquiries: [inquiry({ id: 1, anonymous_session_id: "v1", created_at: "2026-05-03T00:00:00Z" })],
      payments: [],
      events,
    });
    expect(report.estimatorToInquiry.estimatorCompletions).toBe(2);
    expect(report.estimatorToInquiry.convertedToInquiry).toBe(1);
    expect(report.estimatorToInquiry.rate).toBeCloseTo(0.5, 5);
    expect(report.pagesViewedBeforeInquiry).toBe(2); // 2 views before, 1 after excluded
  });
});
