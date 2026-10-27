import { describe, expect, it } from "vitest";
import {
  findLedgerMatches,
  groupLikelyDuplicates,
  identitiesCompatible,
  likelySamePayment,
  suggestDuplicateToVoid,
  type MatchablePayment,
} from "@/lib/paymentMatching";
import { findDuplicateSuspects, type PaymentRow } from "@/lib/paymentFilters";

function pay(overrides: Partial<MatchablePayment>): MatchablePayment {
  return {
    id: 1,
    inquiry_id: null,
    client_name: "Jane Doe",
    client_email: "",
    amount_cents: 19000,
    method: "Venmo",
    paid_at: "2026-02-05T20:00:00Z",
    source: "auto",
    source_txn_id: "",
    invoice: "",
    ...overrides,
  };
}

// Shapes taken from the production ledger: a date-only "reconciled ledger
// import" row (noon PT, no email, no txn id) and the Gmail-detected record of
// the same transfer (exact time, email, txn id, invoice).
const importRow = pay({ id: 177, client_name: "Allen Mata", paid_at: "2026-02-05T20:00:00Z" });
const gmailRow = pay({
  id: 222, client_name: "Allen Mata", client_email: "allen@example.com",
  paid_at: "2026-02-05T17:27:27Z", source: "pass1", source_txn_id: "gmail:abc", invoice: "1336",
});

describe("likelySamePayment", () => {
  it("matches the same transfer recorded by two imports with different evidence", () => {
    expect(likelySamePayment(importRow, gmailRow)).toBe(true);
  });

  it("matches a nickname record through a shared surname", () => {
    const a = pay({ id: 180, client_name: "Dee Dee Lopez", amount_cents: 21250, paid_at: "2026-02-26T20:00:00Z" });
    const b = pay({ id: 212, client_name: "Delia Lopez", client_email: "d@example.com", amount_cents: 21250, paid_at: "2026-02-26T23:04:13Z" });
    expect(likelySamePayment(a, b)).toBe(true);
  });

  it("does not match different payers who paid the same amount the same day", () => {
    const other = pay({ id: 9, client_name: "Farnaz K", paid_at: "2026-02-05T21:00:00Z" });
    expect(likelySamePayment(importRow, other)).toBe(false);
  });

  it("does not match the same payer's deposit and balance weeks apart", () => {
    const balance = pay({ id: 178, client_name: "Allen Mata", paid_at: "2026-02-21T20:00:00Z" });
    expect(likelySamePayment(importRow, balance)).toBe(false);
  });

  it("does not match across payment platforms", () => {
    expect(likelySamePayment(importRow, { ...gmailRow, method: "Zelle" })).toBe(false);
  });

  it("does not match two invoices with different numbers", () => {
    const a = { ...gmailRow, id: 1, invoice: "#1339" };
    const b = { ...gmailRow, id: 2, invoice: "#1340", source_txn_id: "gmail:other" };
    expect(likelySamePayment(a, b)).toBe(false);
  });

  it("keeps the legacy same-payer rule with its 3-day window", () => {
    const a = pay({ id: 1, client_email: "x@example.com", paid_at: "2026-05-01T00:00:00Z" });
    const b = pay({ id: 2, client_email: "x@example.com", paid_at: "2026-05-03T12:00:00Z", method: "Zelle" });
    expect(likelySamePayment(a, b)).toBe(true);
  });
});

describe("identitiesCompatible", () => {
  it("treats two different emails as different payers", () => {
    expect(identitiesCompatible(
      pay({ client_name: "Kim Hoang", client_email: "a@example.com" }),
      pay({ client_name: "Kim Hoang", client_email: "b@example.com" }),
    )).toBe(false);
  });

  it("treats the same linked inquiry as the same payer despite a name typo", () => {
    expect(identitiesCompatible(
      pay({ client_name: "Chantal Le", inquiry_id: 59, client_email: "c@example.com" }),
      pay({ client_name: "Chantal Lee", inquiry_id: 59 }),
    )).toBe(true);
  });
});

describe("groupLikelyDuplicates + suggestDuplicateToVoid", () => {
  it("groups the pair and suggests voiding the row with less transaction evidence", () => {
    const groups = groupLikelyDuplicates([importRow, gmailRow, pay({ id: 178, client_name: "Allen Mata", paid_at: "2026-02-21T20:00:00Z" })]);
    expect(groups.map(g => g.map(r => r.id))).toEqual([[222, 177]]);
    expect(suggestDuplicateToVoid(groups[0])).toBe(177);
  });

  it("declines to suggest when both rows carry the same evidence", () => {
    expect(suggestDuplicateToVoid([pay({ id: 1 }), pay({ id: 2 })])).toBeNull();
  });
});

describe("findLedgerMatches (staged approval guard)", () => {
  it("finds the ledger row a staged Gmail payment would double-count", () => {
    const staged = pay({ id: 6, client_name: "Vanshika Sharma", client_email: "v@example.com", amount_cents: 17500, paid_at: "2026-04-01T02:00:00Z", source: "pass1" });
    const ledger = [
      pay({ id: 182, client_name: "Vanshika Sharma", amount_cents: 17500, paid_at: "2026-03-31T19:00:00Z" }),
      pay({ id: 190, client_name: "Vanshika Sharma", amount_cents: 17500, paid_at: "2026-06-05T19:00:00Z" }),
    ];
    expect(findLedgerMatches(staged, ledger).map(r => r.id)).toEqual([182]);
  });
});

describe("findDuplicateSuspects", () => {
  const ledgerRow = (p: MatchablePayment, extra: Partial<PaymentRow> = {}): PaymentRow => ({
    ...p,
    amount: "",
    payment_type: "deposit_1",
    note: "",
    source: p.source ?? "auto",
    source_txn_id: p.source_txn_id ?? "",
    invoice: p.invoice ?? "",
    status: "active",
    session_date: null,
    fee_cents: 0,
    refund_cents: 0,
    imported_at: null,
    reconciliation_status: "confirmed",
    ...extra,
  });

  it("now flags cross-import duplicates that the email-or-name key missed", () => {
    const groups = findDuplicateSuspects([ledgerRow(importRow), ledgerRow(gmailRow)]);
    expect(groups).toHaveLength(1);
  });

  it("ignores voided rows and fully reviewed groups", () => {
    expect(findDuplicateSuspects([ledgerRow(importRow), ledgerRow(gmailRow, { status: "voided" })])).toHaveLength(0);
    expect(findDuplicateSuspects([
      ledgerRow(importRow, { reconciliation_status: "reconciled" }),
      ledgerRow(gmailRow, { reconciliation_status: "reconciled" }),
    ])).toHaveLength(0);
  });
});
