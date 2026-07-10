import { describe, expect, it } from "vitest";
import type { AdminInquiry } from "@/lib/adminInquiries";
import {
  breakdownBy,
  collectionRate,
  safeDelta,
  summarizePeriod,
  topShare,
} from "@/lib/revenue/calc";
import { enrichPayments, normalizeService, type LedgerRow } from "@/lib/revenue/enrich";
import { buildComparisonPeriod, buildPresetPeriod, elapsedFraction } from "@/lib/revenue/periods";
import { detectSchoolKey } from "@/lib/revenue/schools";
import { autoGranularity, bucketSeries, monthlyHeatmap, revenuePace, toCumulative } from "@/lib/revenue/series";
import { buildReceivables } from "@/lib/revenue/receivables";
import { findQualityIssues } from "@/lib/revenue/quality";

function row(overrides: Partial<LedgerRow>): LedgerRow {
  return {
    id: 1,
    inquiry_id: null,
    client_name: "Jane Doe",
    client_email: "jane@example.com",
    amount: "$100",
    amount_cents: 10000,
    method: "Venmo",
    payment_type: "deposit_1",
    invoice: "",
    note: "",
    source: "manual",
    status: "active",
    paid_at: "2026-05-01T12:00:00.000Z",
    session_date: null,
    fee_cents: 0,
    refund_cents: 0,
    imported_at: "2026-05-02T00:00:00.000Z",
    reconciliation_status: "confirmed",
    source_txn_id: "",
    inquiry_session_type: null,
    serviceKey: "unlinked",
    schoolKey: "unlinked",
    inquiry: null,
    ...overrides,
  };
}

function inquiry(overrides: Partial<AdminInquiry>): AdminInquiry {
  return {
    id: 1, name: "Jane Doe", email: "jane@example.com", phone: null,
    session_type: "Graduation Portrait", date_in_mind: null, message: "",
    status: "responded", created_at: "2026-04-01T00:00:00.000Z",
    payment_status: "paid", payment_note: null, payment_detected_at: null,
    booking_confirmed: true, session_date: "2026-05-10", reply_sent_at: null,
    invoice_sent_at: null, contract_sent_at: null, deposit_paid_at: null,
    gallery_delivered_at: null, instagram: null, school: "SJSU",
    preferred_time: null, people: null, location: null, confirmation_sent_at: null,
    needs_reply: null, last_inbound_at: null, last_outbound_at: null,
    last_message_at: null, last_message_direction: null, status_source: null,
    gmail_thread_ids: null,
    ...overrides,
  };
}

describe("safeDelta", () => {
  it("computes percentage change against a non-zero baseline", () => {
    const d = safeDelta(12800, 10000);
    expect(d).toEqual({ kind: "pct", ratio: 0.28, diff: 2800 });
  });
  it("never returns Infinity when the previous period is zero", () => {
    expect(safeDelta(5000, 0)).toEqual({ kind: "new", diff: 5000 });
  });
  it("handles both-zero and missing baselines", () => {
    expect(safeDelta(0, 0)).toEqual({ kind: "zero" });
    expect(safeDelta(100, null)).toEqual({ kind: "none" });
  });
});

describe("summarizePeriod", () => {
  const rows = [
    row({ id: 1, amount_cents: 20000, payment_type: "deposit_1" }),
    row({ id: 2, amount_cents: 30000, payment_type: "deposit_2", fee_cents: 500 }),
    row({ id: 3, amount_cents: 15000, client_email: "bob@x.com", client_name: "Bob", payment_type: "full" }),
    row({ id: 4, amount_cents: 9000, status: "refunded" }),
    row({ id: 5, amount_cents: 9999, status: "voided" }),
    row({ id: 6, amount_cents: 0 }), // zero rows never count as collected
  ];
  const s = summarizePeriod(rows);

  it("counts only confirmed active positive rows as collected", () => {
    expect(s.collectedCents).toBe(65000);
    expect(s.paymentCount).toBe(3);
  });
  it("separates refunds and fees into net", () => {
    expect(s.refundCents).toBe(9000);
    expect(s.feeCents).toBe(500);
    expect(s.netCents).toBe(65000 - 9000 - 500);
  });
  it("derives per-client and per-payment averages", () => {
    expect(s.uniqueClients).toBe(2);
    expect(s.perClientCents).toBe(32500);
    expect(s.avgPaymentCents).toBe(Math.round(65000 / 3));
  });
  it("splits deposit / balance / full revenue", () => {
    expect(s.depositCents).toBe(20000);
    expect(s.balanceCents).toBe(30000);
    expect(s.fullCents).toBe(15000);
  });
  it("excludes unverified auto-recorded rows from collected revenue", () => {
    const tainted = [row({ source: "auto", note: "auto-recorded from gmail" })];
    expect(summarizePeriod(tainted).collectedCents).toBe(0);
  });
});

describe("breakdowns and concentration", () => {
  const rows = [
    row({ id: 1, amount_cents: 60000, serviceKey: "graduation" }),
    row({ id: 2, amount_cents: 30000, serviceKey: "couples", client_email: "b@x.com" }),
    row({ id: 3, amount_cents: 10000, serviceKey: "family", client_email: "c@x.com" }),
  ];
  it("shares sum to 1 and entries sort by revenue", () => {
    const entries = breakdownBy(rows, p => p.serviceKey);
    expect(entries.map(e => e.key)).toEqual(["graduation", "couples", "family"]);
    expect(entries.reduce((s, e) => s + e.share, 0)).toBeCloseTo(1);
    expect(topShare(entries, 1)).toBeCloseTo(0.6);
  });
  it("collectionRate handles a fully collected book", () => {
    expect(collectionRate(10000, 0)).toBe(1);
    expect(collectionRate(7500, 2500)).toBe(0.75);
    expect(collectionRate(0, 0)).toBe(1);
  });
});

describe("periods", () => {
  const now = new Date(2026, 5, 11, 10, 0, 0); // Jun 11 2026
  it("builds calendar presets", () => {
    const m = buildPresetPeriod("thisMonth", now);
    expect(m.start?.getMonth()).toBe(5);
    expect(m.end?.getDate()).toBe(30);
    const grad = buildPresetPeriod("gradSeason", now);
    expect(grad.start?.getMonth()).toBe(2);
    expect(grad.end?.getMonth()).toBe(5);
  });
  it("compares whole months against the previous calendar month", () => {
    const period = buildPresetPeriod("thisMonth", now);
    const prev = buildComparisonPeriod(period, "prevPeriod");
    expect(prev?.start?.getMonth()).toBe(4);
    expect(prev?.end?.getDate()).toBe(31);
  });
  it("returns null comparisons for open-ended ranges", () => {
    expect(buildComparisonPeriod(buildPresetPeriod("all", now), "prevPeriod")).toBeNull();
  });
  it("rejects invalid custom ranges", () => {
    const p = buildPresetPeriod("custom", now, { start: "2026-06-10", end: "2026-06-01" });
    expect(p.start).toBeNull();
  });
  it("clamps elapsed fraction", () => {
    const period = buildPresetPeriod("thisMonth", now);
    const f = elapsedFraction(period, now);
    expect(f).toBeGreaterThan(0.3);
    expect(f).toBeLessThan(0.4);
  });
});

describe("series", () => {
  const period = buildPresetPeriod("custom", new Date(2026, 5, 11), { start: "2026-05-01", end: "2026-05-31" });
  const rows = [
    row({ id: 1, paid_at: "2026-05-01T12:00:00.000Z", amount_cents: 10000 }),
    row({ id: 2, paid_at: "2026-05-15T12:00:00.000Z", amount_cents: 20000 }),
  ];
  it("zero-fills buckets across the period", () => {
    const pts = bucketSeries(rows, period, "day");
    expect(pts.length).toBe(31);
    expect(pts.reduce((s, p) => s + p.cents, 0)).toBe(30000);
    expect(pts.filter(p => p.cents > 0).length).toBe(2);
  });
  it("accumulates cumulatively", () => {
    const pts = toCumulative(bucketSeries(rows, period, "day"));
    expect(pts[pts.length - 1].cents).toBe(30000);
  });
  it("picks granularity from span", () => {
    expect(autoGranularity(period)).toBe("day");
    expect(autoGranularity(buildPresetPeriod("all", new Date()))).toBe("month");
  });
  it("keeps weekly buckets aligned across the March DST transition", () => {
    const ytd = buildPresetPeriod("custom", new Date(2026, 5, 11), { start: "2026-01-01", end: "2026-06-11" });
    const dstRows = [
      row({ id: 1, paid_at: "2026-02-05T20:00:00.000Z", amount_cents: 10000 }),
      row({ id: 2, paid_at: "2026-05-18T19:00:00.000Z", amount_cents: 50000 }), // after DST change
    ];
    const pts = bucketSeries(dstRows, ytd, "week");
    // Revenue paid after the DST change must still land in a rendered bucket.
    expect(pts.reduce((s, p) => s + p.cents, 0)).toBe(60000);
    expect(Math.max(...pts.map(p => p.cents))).toBe(50000);
  });
  it("builds a month×year heatmap", () => {
    const cells = monthlyHeatmap(rows);
    expect(cells).toEqual([{ year: 2026, month: 4, cents: 30000, count: 2 }]);
  });
  it("projects pace only mid-period and compares at the same elapsed point", () => {
    const june = buildPresetPeriod("thisMonth", new Date(2026, 5, 5));
    const juneRows = [row({ id: 3, paid_at: "2026-06-02T12:00:00.000Z", amount_cents: 30000 })];
    const may = buildComparisonPeriod(june, "prevPeriod")!;
    const pace = revenuePace(juneRows, june, rows, may, new Date(2026, 5, 5));
    expect(pace.soFarCents).toBe(30000);
    expect(pace.compTotalCents).toBe(30000);
    // ~13% of June elapsed → cutoff lands ~May 5: only the May 1 payment counts.
    expect(pace.compAtSamePointCents).toBe(10000);
    expect(pace.projectedCents).toBeGreaterThan(30000);
  });
});

describe("schools and services", () => {
  it("normalizes messy school text deterministically", () => {
    expect(detectSchoolKey({ school: "San Jose State University" })).toBe("sjsu");
    expect(detectSchoolKey({ school: "SJSU" })).toBe("sjsu");
    expect(detectSchoolKey({ school: "Stanford / Palo Alto" })).toBe("stanford");
    expect(detectSchoolKey({ school: "", message: "graduating from UC Berkeley" })).toBe("berkeley");
    expect(detectSchoolKey({ school: "CA" })).toBe("other");
    expect(detectSchoolKey(null)).toBe("unlinked");
  });
  it("normalizes session types into service groups", () => {
    expect(normalizeService("Graduation Portrait", true)).toBe("graduation");
    expect(normalizeService("Engagement shoot", true)).toBe("couples");
    expect(normalizeService(null, false)).toBe("unlinked");
  });
  it("enriches payments with inquiry dimensions", () => {
    const [enriched] = enrichPayments(
      [row({ inquiry_id: 7, inquiry_session_type: "Graduation Portrait" })],
      [inquiry({ id: 7, school: "SJSU" })],
    );
    expect(enriched.serviceKey).toBe("graduation");
    expect(enriched.schoolKey).toBe("sjsu");
  });
});

describe("receivables", () => {
  const now = new Date(2026, 5, 11);
  it("estimates outstanding from a single retainer and ages it", () => {
    const payments = enrichPayments(
      [row({ id: 1, inquiry_id: 7, amount_cents: 20000, payment_type: "deposit_1" })],
      [inquiry({ id: 7, session_date: "2026-05-20" })],
    );
    const [r] = buildReceivables(payments, [inquiry({ id: 7, session_date: "2026-05-20" })], now);
    expect(r).toBeDefined();
    expect(r.totalIsEstimate).toBe(true);
    expect(r.outstandingCents).toBe(r.totalCents - 20000);
    expect(r.bucket).toBe("due8to30"); // 22 days past session
  });
  it("treats a complete deposit pair as settled", () => {
    const payments = enrichPayments(
      [
        row({ id: 1, inquiry_id: 7, amount_cents: 20000, payment_type: "deposit_1" }),
        row({ id: 2, inquiry_id: 7, amount_cents: 25000, payment_type: "deposit_2" }),
      ],
      [inquiry({ id: 7 })],
    );
    expect(buildReceivables(payments, [inquiry({ id: 7 })], now)).toHaveLength(0);
  });
});

describe("quality rules", () => {
  it("flags duplicates, unlinked rows, and personal transfers", () => {
    const rows = [
      row({ id: 1, reconciliation_status: "confirmed" }),
      row({ id: 2, paid_at: "2026-05-02T12:00:00.000Z", reconciliation_status: "confirmed" }),
      row({ id: 3, amount_cents: 5000, client_name: "Roomie", client_email: "r@x.com", note: "rent for june" }),
    ];
    const issues = findQualityIssues(rows);
    const rules = issues.map(i => i.rule);
    expect(rules).toContain("duplicate");
    expect(rules).toContain("personalTransfer");
    expect(rules).toContain("unlinkedClient");
  });
  it("does not flag reviewed duplicate groups or linked clean rows", () => {
    const clean = [
      row({ id: 1, inquiry_id: 4, reconciliation_status: "reconciled" }),
      row({ id: 2, inquiry_id: 4, paid_at: "2026-05-02T12:00:00.000Z", reconciliation_status: "reconciled" }),
    ];
    expect(findQualityIssues(clean)).toHaveLength(0);
  });
  it("flags balances without retainers and missing dates", () => {
    const rows = [
      row({ id: 9, inquiry_id: 1, payment_type: "deposit_2" }),
      row({ id: 10, inquiry_id: 2, client_email: "z@x.com", paid_at: null as unknown as string, session_date: null }),
    ];
    const rules = findQualityIssues(rows).map(i => i.rule);
    expect(rules).toContain("balanceWithoutRetainer");
    expect(rules).toContain("missingDate");
  });
});
