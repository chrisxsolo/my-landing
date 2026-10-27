import { describe, expect, it } from "vitest";
import { averageBookingCents, headlineRevenue } from "@/lib/revenue/headline";

const NOW = new Date(2026, 9, 27, 10, 0, 0); // Oct 27 2026, local time

function pay(o: Record<string, unknown>) {
  return {
    status: "active", source: "pass1", note: "", amount: "", amount_cents: 10000,
    paid_at: "2026-10-07T00:11:05Z", session_date: null, inquiry_id: null, client_email: "", client_name: "A",
    ...o,
  };
}

describe("headlineRevenue (Home tab card)", () => {
  it("counts every confirmed ledger payment by its paid date, linked or not", () => {
    const rows = [
      pay({ amount_cents: 55000, inquiry_id: null }), // unlinked — was invisible to the old card
      pay({ amount_cents: 42500, inquiry_id: 123, paid_at: "2026-10-18T17:04:36Z" }),
      pay({ amount_cents: 20000, paid_at: "2026-09-10T12:00:00Z" }),
      pay({ amount_cents: 99900, status: "voided" }),
      pay({ amount_cents: 0 }),
    ];
    const h = headlineRevenue(rows, NOW);
    expect(h.thisMonthCents).toBe(97500);
    expect(h.lastMonthCents).toBe(20000);
    expect(h.ytdCents).toBe(117500);
  });

  it("counts a deposit and its balance once each, never the balance twice", () => {
    const rows = [
      pay({ inquiry_id: 7, payment_type: "deposit_1", amount_cents: 21250, paid_at: "2026-10-02T12:00:00Z" }),
      pay({ inquiry_id: 7, payment_type: "deposit_2", amount_cents: 21250, paid_at: "2026-10-20T12:00:00Z" }),
    ];
    expect(headlineRevenue(rows, NOW).thisMonthCents).toBe(42500);
  });

  it("reads $0 only when the ledger has no payment in the month", () => {
    expect(headlineRevenue([pay({ paid_at: "2026-05-01T12:00:00Z" })], NOW).thisMonthCents).toBe(0);
  });
});

describe("averageBookingCents", () => {
  it("groups by inquiry, else by payer, and ignores non-revenue rows", () => {
    const rows = [
      pay({ inquiry_id: 1, amount_cents: 20000 }),
      pay({ inquiry_id: 1, amount_cents: 20000 }),
      pay({ client_name: "Solo", amount_cents: 30000 }),
      pay({ client_name: "Other", amount_cents: 50000 }),
      pay({ inquiry_id: 2, amount_cents: 70000, status: "voided" }),
    ];
    expect(averageBookingCents(rows)).toBe(40000);
    expect(averageBookingCents([])).toBeNull();
  });
});
