import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYMENT_FILTERS,
  applyPaymentFilters,
  findDuplicateSuspects,
  normalizePaymentMethod,
  paymentsToCsv,
  type PaymentRow,
} from "@/lib/paymentFilters";

function row(overrides: Partial<PaymentRow>): PaymentRow {
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
    imported_at: "2026-06-01T00:00:00.000Z",
    reconciliation_status: "confirmed",
    source_txn_id: "",
    inquiry_session_type: null,
    ...overrides,
  };
}

describe("applyPaymentFilters", () => {
  const rows = [
    row({ id: 1, client_name: "Jane Doe", amount_cents: 10000, paid_at: "2026-05-01T00:00:00Z" }),
    row({ id: 2, client_name: "Bob Smith", client_email: "bob@x.com", invoice: "INV-42", amount_cents: 25000, paid_at: "2026-05-03T00:00:00Z", method: "Zelle" }),
    row({ id: 3, client_name: "Amy Lee", client_email: "amy@x.com", note: "graduation shoot", amount_cents: 5000, paid_at: "2026-05-02T00:00:00Z", payment_type: "full", inquiry_session_type: "graduation" }),
  ];

  it("searches name, email, invoice, and note", () => {
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, search: "jane" }).map(r => r.id)).toEqual([1]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, search: "bob@x" }).map(r => r.id)).toEqual([2]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, search: "inv-42" }).map(r => r.id)).toEqual([2]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, search: "graduation" }).map(r => r.id)).toEqual([3]);
  });

  it("applies inclusive amount bounds", () => {
    const result = applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, minCents: 5000, maxCents: 10000, sortDir: "asc" });
    expect(result.map(r => r.id)).toEqual([1, 3].sort((a, b) => {
      const ra = rows.find(r => r.id === a)!;
      const rb = rows.find(r => r.id === b)!;
      return ra.paid_at < rb.paid_at ? -1 : 1;
    }));
  });

  it("filters by method, type, and session type", () => {
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, method: "Zelle" }).map(r => r.id)).toEqual([2]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, paymentType: "full" }).map(r => r.id)).toEqual([3]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, sessionType: "graduation" }).map(r => r.id)).toEqual([3]);
  });

  it("sorts by each key in both directions", () => {
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, sortKey: "amount", sortDir: "asc" }).map(r => r.id)).toEqual([3, 1, 2]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, sortKey: "amount", sortDir: "desc" }).map(r => r.id)).toEqual([2, 1, 3]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, sortKey: "client", sortDir: "asc" }).map(r => r.id)).toEqual([3, 2, 1]);
    expect(applyPaymentFilters(rows, { ...DEFAULT_PAYMENT_FILTERS, sortKey: "date", sortDir: "desc" }).map(r => r.id)).toEqual([2, 3, 1]);
  });
});

describe("normalizePaymentMethod", () => {
  it("maps known methods and falls back to other", () => {
    expect(normalizePaymentMethod("venmo")).toBe("Venmo");
    expect(normalizePaymentMethod("cash")).toBe("Cash App");
    expect(normalizePaymentMethod("wire")).toBe("other");
    expect(normalizePaymentMethod("")).toBe("other");
  });
});

describe("paymentsToCsv", () => {
  it("escapes quotes, commas, and newlines", () => {
    const csv = paymentsToCsv([row({ client_name: 'Jane "JJ", Doe', note: "line1\nline2" })]);
    const [header, line] = csv.split("\n", 2);
    expect(header.startsWith("id,client_name,")).toBe(true);
    expect(line).toContain('"Jane ""JJ"", Doe"');
    expect(csv).toContain('"line1\nline2"');
  });
});

describe("findDuplicateSuspects", () => {
  it("groups same payer+amount within 3 days, ignoring voided rows", () => {
    const groups = findDuplicateSuspects([
      row({ id: 1, paid_at: "2026-05-01T00:00:00Z" }),
      row({ id: 2, paid_at: "2026-05-03T00:00:00Z" }),
      row({ id: 3, paid_at: "2026-05-02T00:00:00Z", status: "voided" }),
      row({ id: 4, client_email: "other@x.com", paid_at: "2026-05-01T00:00:00Z" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map(r => r.id)).toEqual([1, 2]);
  });

  it("does not group payments more than 3 days apart", () => {
    const groups = findDuplicateSuspects([
      row({ id: 1, paid_at: "2026-05-01T00:00:00Z" }),
      row({ id: 2, paid_at: "2026-05-06T00:00:00Z" }),
    ]);
    expect(groups).toHaveLength(0);
  });
});
