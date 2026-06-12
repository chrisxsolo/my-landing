import { describe, expect, it } from "vitest";
import {
  amountForType,
  paymentOnlyRows,
  rebalanceAmounts,
  relatedPayments,
  rowIsReady,
  rowsFromInquiries,
  seedAmounts,
  typeAlreadyPaid,
} from "@/app/admin/manual-payments/helpers";
import type { InquiryOption, PaymentRow, SavedPayment } from "@/app/admin/manual-payments/types";

function inquiry(overrides: Partial<InquiryOption>): InquiryOption {
  return {
    id: 1, name: "Elba Sanchez Solano", email: "elba@example.com",
    session_type: "Graduation Portrait", session_date: "2026-05-20", date_in_mind: null,
    message: "", school: "SJSU", location: null, people: null,
    payment_status: null, payment_note: null, payment_detected_at: null,
    deposit_paid_at: null, created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function payment(overrides: Partial<SavedPayment>): SavedPayment {
  return {
    id: 100, inquiry_id: 1, client_name: "Elba Sanchez Solano", client_email: "elba@example.com",
    amount: "175.00", amount_cents: 17500, method: "Zelle", payment_type: "deposit_1",
    invoice: "", note: "", source: "auto", status: "active",
    paid_at: "2026-04-28T19:00:00Z", session_date: "2026-05-20",
    ...overrides,
  };
}

describe("seedAmounts — mirror of the database", () => {
  it("both deposits saved → exact amounts, full = sum, everything paid", () => {
    const seed = seedAmounts(inquiry({}), [
      payment({ id: 1, payment_type: "deposit_1", amount_cents: 17500 }),
      payment({ id: 2, payment_type: "deposit_2", amount_cents: 17500 }),
    ]);
    expect(seed).toMatchObject({ d1: "175.00", d2: "175.00", full: "350.00", d1Paid: true, d2Paid: true });
    expect(seed.totalSource).toBe("both deposits on record");
    expect(seed.nextType).toBe("full");
  });

  it("uneven deposit pair keeps the saved figures (Karina: 175 + 300 = 475)", () => {
    const seed = seedAmounts(inquiry({}), [
      payment({ id: 1, payment_type: "deposit_1", amount_cents: 17500, amount: "175.00" }),
      payment({ id: 2, payment_type: "deposit_2", amount_cents: 30000, amount: "300.00" }),
    ]);
    expect(seed.d1).toBe("175.00");
    expect(seed.d2).toBe("300.00");
    expect(seed.full).toBe("475.00");
  });

  it("only deposit 1 saved → D1 verbatim, total from retainer policy, D2 = remainder", () => {
    const seed = seedAmounts(inquiry({}), [payment({ id: 1, payment_type: "deposit_1", amount_cents: 17500 })]);
    expect(seed.d1).toBe("175.00");
    expect(seed.d1Paid).toBe(true);
    expect(seed.d2Paid).toBe(false);
    expect(seed.totalSource).toBe("retainer policy estimate");
    const d2 = parseFloat(seed.d2);
    const full = parseFloat(seed.full);
    expect(full).toBeGreaterThan(175);
    expect(d2).toBeCloseTo(full - 175, 2);
    expect(seed.nextType).toBe("deposit_2");
  });

  it("full payment saved → total verbatim, both halves marked paid", () => {
    const seed = seedAmounts(inquiry({}), [payment({ id: 1, payment_type: "full", amount_cents: 35000, amount: "350.00" })]);
    expect(seed.full).toBe("350.00");
    expect(seed.d1Paid).toBe(true);
    expect(seed.d2Paid).toBe(true);
    expect(parseFloat(seed.d1) + parseFloat(seed.d2)).toBeCloseTo(350, 2);
  });

  it("nothing saved → suggestion from session pricing, split per schedule, nothing paid", () => {
    const seed = seedAmounts(inquiry({ message: "grad photos at SJSU please" }), []);
    expect(seed.d1Paid).toBe(false);
    expect(seed.d2Paid).toBe(false);
    expect(seed.totalSource).toBe("session pricing");
    expect(parseFloat(seed.d1) + parseFloat(seed.d2)).toBeCloseTo(parseFloat(seed.full), 2);
    expect(seed.nextType).toBe("deposit_1");
  });

  it("matches payments by email when inquiry_id is missing", () => {
    const seed = seedAmounts(inquiry({}), [payment({ id: 1, inquiry_id: null })]);
    expect(seed.d1Paid).toBe(true);
  });

  it("ignores voided payments", () => {
    const seed = seedAmounts(inquiry({ message: "", session_type: null, school: null }), [
      payment({ id: 1, status: "voided" }),
    ]);
    expect(seed.d1Paid).toBe(false);
  });
});

describe("payment-only clients (no inquiry on record)", () => {
  // Alexa: one $700 retainer in the ledger, no inquiry, no email.
  const alexa = payment({
    id: 132, inquiry_id: null, client_name: "Alexa Lee Cottrell", client_email: "",
    amount: "700.00", amount_cents: 70000, payment_type: "deposit_1", method: "Zelle",
  });

  it("creates a searchable row seeded from the ledger", () => {
    const [row] = paymentOnlyRows([alexa], []);
    expect(row).toBeDefined();
    expect(row.client_name).toBe("Alexa Lee Cottrell");
    expect(row.d1).toBe("700.00");
    expect(row.d1Paid).toBe(true);
    expect(row.d2).toBe("700.00"); // retainer policy: total 1400 − 700 paid
    expect(row.full).toBe("1400.00");
    expect(row.payment_type).toBe("deposit_2"); // next unpaid step
    expect(row.method).toBe("Zelle");
  });

  it("matches name-only ledger rows so the paid flag can't be lost", () => {
    expect(relatedPayments([alexa], null, "", "alexa lee cottrell")).toHaveLength(1);
    // but never name-matches when either side has an email
    expect(relatedPayments([alexa], null, "someone@else.com", "Alexa Lee Cottrell")).toHaveLength(0);
  });

  it("skips clients already represented by an inquiry row", () => {
    const linked = payment({ id: 2, inquiry_id: null, client_email: "elba@example.com" });
    expect(paymentOnlyRows([linked], [inquiry({})])).toHaveLength(0);
  });

  it("ignores voided ledger rows and payments linked to inquiries", () => {
    expect(paymentOnlyRows([{ ...alexa, status: "voided" }], [])).toHaveLength(0);
    expect(paymentOnlyRows([payment({ id: 3, inquiry_id: 7 })], [])).toHaveLength(0);
  });
});

describe("rebalanceAmounts", () => {
  it("clear-payments flow: with nothing paid anymore, the corrected full re-splits both deposits", () => {
    // Gabriel: stale row still shows old amounts, but his rows were voided.
    const stale = { d1: "217.50", d2: "217.50", full: "435.00" };
    const next = rebalanceAmounts(stale, "full", "850.00", { d1Paid: false, d2Paid: false });
    expect(next.d1).toBe("425.00");
    expect(next.d2).toBe("425.00");
    expect(next.full).toBe("850.00");
  });

  it("with deposit 1 recorded, editing full only moves the open balance", () => {
    const row = { d1: "425.00", d2: "425.00", full: "850.00" };
    const next = rebalanceAmounts(row, "full", "950.00", { d1Paid: true, d2Paid: false });
    expect(next.d1).toBe("425.00");
    expect(next.d2).toBe("525.00");
  });

  it("editing one open deposit rebalances the other against the fixed total", () => {
    const row = { d1: "425.00", d2: "425.00", full: "850.00" };
    const next = rebalanceAmounts(row, "d1", "300.00", { d1Paid: false, d2Paid: false });
    expect(next.d2).toBe("550.00");
    expect(next.full).toBe("850.00");
  });

  it("extends the total when the partner deposit is already recorded", () => {
    const row = { d1: "425.00", d2: "425.00", full: "850.00" };
    const next = rebalanceAmounts(row, "d2", "500.00", { d1Paid: true, d2Paid: false });
    expect(next.full).toBe("925.00");
  });
});

describe("save guards", () => {
  const seededRow = (): PaymentRow =>
    rowsFromInquiries([inquiry({})], [payment({ id: 1, payment_type: "deposit_1", amount_cents: 17500 })])[0];

  it("amount saved follows the selected payment type", () => {
    const row = seededRow();
    expect(amountForType({ ...row, payment_type: "deposit_1" })).toBe(row.d1);
    expect(amountForType({ ...row, payment_type: "deposit_2" })).toBe(row.d2);
    expect(amountForType({ ...row, payment_type: "full" })).toBe(row.full);
  });

  it("a type that is already recorded can never be re-saved", () => {
    const row = seededRow();
    expect(typeAlreadyPaid({ ...row, payment_type: "deposit_1" })).toBe(true);
    expect(rowIsReady({ ...row, payment_type: "deposit_1" })).toBe(false);
    expect(rowIsReady({ ...row, payment_type: "deposit_2" })).toBe(true);
  });

  it("seeded rows default to the next unpaid step", () => {
    expect(seededRow().payment_type).toBe("deposit_2");
  });
});
