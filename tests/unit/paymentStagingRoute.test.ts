import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeSupabase, type FakeOptions, type FakeSupabase } from "./support/fakeSupabase";

const state = vi.hoisted(() => ({
  fake: null as unknown as { client: unknown },
  deny: null as unknown,
  portal: vi.fn(),
}));
vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => state.deny }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServerClient: () => state.fake.client }));
vi.mock("@/lib/paymentLedgerMatches", () => ({ loadNearbyLedger: async () => [] }));
vi.mock("@/lib/adminPortalSessionUpsert", () => ({ advancePortalSessionForDeposit: state.portal }));

import { GET, POST } from "@/app/api/admin/payment-staging/route";

const PAID_AT = "2026-11-10T19:00:00.000Z";

function stagedRow(over: Record<string, unknown> = {}) {
  return {
    id: 1, fingerprint: "fp-1", inquiry_id: 10, client_name: "Alex Example", client_email: "alex@example.test",
    amount: "$100", amount_cents: 10000, method: "Zelle", payment_type: "deposit_1", invoice: "9001", note: "",
    source: "pass1", source_txn_id: "gmail:abc", paid_at: PAID_AT, session_date: "2027-04-24",
    evidence: "synthetic", status: "pending", created_at: PAID_AT, ...over,
  };
}

function inquiryRow(over: Record<string, unknown> = {}) {
  return {
    id: 10, session_type: "Graduation", session_date: "2027-04-24", preferred_time: null,
    status: "responded", payment_status: "unpaid", payment_note: null, payment_detected_at: null, deposit_paid_at: null,
    booking_confirmed: false, ...over,
  };
}

let fake: FakeSupabase;
let opts: FakeOptions;

function setup(tables: Record<string, Record<string, unknown>[]>) {
  opts = {};
  fake = fakeSupabase({ payments_staging: [], payments: [], inquiries: [], availability: [], ...tables }, opts);
  state.fake = fake;
}

function post(body: unknown) {
  return POST(new NextRequest("http://localhost/api/admin/payment-staging", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.deny = null;
  state.portal.mockResolvedValue("created");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("payment-staging auth", () => {
  it("rejects unauthorized requests without touching the database", async () => {
    setup({ payments_staging: [stagedRow()] });
    state.deny = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    expect((await post({ action: "approve", ids: [1] })).status).toBe(401);
    expect((await GET(new NextRequest("http://localhost/api/admin/payment-staging"))).status).toBe(401);
    expect(fake.ops).toEqual([]);
  });
});

describe("approving a staged payment", () => {
  it("leaves a pending detection untouched until it is approved", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    const res = await GET(new NextRequest("http://localhost/api/admin/payment-staging"));
    const json = await res.json();
    expect(json.staged).toHaveLength(1);
    expect(fake.tables.payments).toHaveLength(0);
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "unpaid", deposit_paid_at: null, booking_confirmed: false });
    expect(fake.tables.availability).toHaveLength(0);
  });

  it("books an inquiry-only client: ledger row, deposit date from the payment, calendar, portal session", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json).toMatchObject({ ok: true, approved: 1, incomplete: [] });
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "paid", deposit_paid_at: PAID_AT, booking_confirmed: true });
    expect(fake.tables.availability[0]).toMatchObject({ date: "2027-04-24", status: "booked" });
    expect(state.portal).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      clientEmail: "alex@example.test", sessionType: "Graduation", sessionDate: "2027-04-24",
    }));
    expect(fake.tables.payments_staging[0].status).toBe("approved");
  });

  it("reports an incomplete approval when the inquiry update fails, and repair finishes it without a second ledger row", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    opts.failWrite = { table: "inquiries", kind: "update" };
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json.approved).toBe(1);
    expect(json.incomplete).toEqual([{ id: 1, paymentId: expect.any(Number), failed: ["inquiry"] }]);
    expect(fake.tables.inquiries[0].payment_status).toBe("unpaid");

    opts.failWrite = null;
    const listed = await (await GET(new NextRequest("http://localhost/api/admin/payment-staging"))).json();
    expect(listed.unprojected).toEqual([expect.objectContaining({ inquiryId: 10, paymentId: json.incomplete[0].paymentId })]);

    const repaired = await (await post({ action: "repair", ids: [json.incomplete[0].paymentId] })).json();
    expect(repaired).toMatchObject({ ok: true, repaired: 1, incomplete: [] });
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "paid", deposit_paid_at: PAID_AT });

    const after = await (await GET(new NextRequest("http://localhost/api/admin/payment-staging"))).json();
    expect(after.unprojected).toEqual([]);
  });

  it("reports a failed calendar write with the payment id needed to finish it", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    opts.failWrite = { table: "availability", kind: "upsert" };
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json.incomplete).toEqual([{ id: 1, paymentId: expect.any(Number), failed: ["availability"] }]);

    opts.failWrite = null;
    const repaired = await (await post({ action: "repair", ids: [json.incomplete[0].paymentId] })).json();
    expect(repaired).toMatchObject({ repaired: 1, incomplete: [] });
    expect(fake.tables.availability[0]).toMatchObject({ date: "2027-04-24", status: "booked" });
    expect(fake.tables.payments).toHaveLength(1);
  });

  it("books the inquiry's current session date, not the stale copy on the payment", async () => {
    setup({ payments_staging: [stagedRow({ session_date: "2027-04-24" })], inquiries: [inquiryRow({ session_date: "2027-05-01" })] });
    await post({ action: "approve", ids: [1] });
    expect(fake.tables.availability.map(a => a.date)).toEqual(["2027-05-01"]);
  });

  it("still records the payment when its inquiry no longer exists", async () => {
    setup({ payments_staging: [stagedRow({ inquiry_id: 99 })], inquiries: [] });
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json).toMatchObject({ approved: 1, incomplete: [] });
  });

  it("reports a failed portal update and an ambiguous portal match separately", async () => {
    setup({ payments_staging: [stagedRow(), stagedRow({ id: 2, fingerprint: "fp-2", inquiry_id: 11, client_name: "Blair Sample", client_email: "blair@example.test", amount: "$250", amount_cents: 25000, paid_at: "2026-09-01T19:00:00.000Z" })],
      inquiries: [inquiryRow(), inquiryRow({ id: 11 })] });
    state.portal.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ambiguous");
    const json = await (await post({ action: "approve", ids: [1, 2] })).json();
    expect(json.incomplete).toEqual([expect.objectContaining({ id: 1, failed: ["portal"] })]);
    expect(json.portalAmbiguous).toEqual([2]);
  });

  it("keeps a row pending and reports it when the ledger insert fails for a reason other than a duplicate", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    opts.failWrite = { table: "payments", kind: "insert", message: "connection reset" };
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json).toMatchObject({ approved: 0, skippedDuplicates: 0, failed: [1] });
    expect(fake.tables.payments_staging[0].status).toBe("pending");
    expect(fake.tables.inquiries[0].payment_status).toBe("unpaid");
  });

  it("treats a unique-fingerprint conflict as a duplicate", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    opts.failWrite = { table: "payments", kind: "insert", code: "23505" };
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json).toMatchObject({ approved: 0, skippedDuplicates: 1, failed: [] });
    expect(fake.tables.payments_staging[0].status).toBe("duplicate");
    expect(fake.tables.inquiries[0].payment_status).toBe("unpaid");
  });

  it("does not rewrite an already-paid booking when a duplicate detection is approved", async () => {
    setup({
      payments_staging: [stagedRow()],
      payments: [{ id: 7, inquiry_id: 10, status: "active", fingerprint: "fp-1", client_name: "Alex Example",
        client_email: "alex@example.test", amount: "$100", method: "Zelle", payment_type: "deposit_1", paid_at: PAID_AT, session_date: null }],
      inquiries: [inquiryRow({ payment_status: "paid", payment_note: "Manually confirmed", deposit_paid_at: PAID_AT })],
    });
    const json = await (await post({ action: "approve", ids: [1] })).json();
    expect(json).toMatchObject({ skippedDuplicates: 1, incomplete: [] });
    expect(fake.tables.inquiries[0].payment_note).toBe("Manually confirmed");
    expect(state.portal).not.toHaveBeenCalled();
  });

  it("recovers when the ledger row was written but the staged row could not be marked approved", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    opts.failWrite = { table: "payments_staging", kind: "update" };
    const first = await (await post({ action: "approve", ids: [1] })).json();
    expect(first.incomplete).toEqual([expect.objectContaining({ id: 1, failed: ["staging"] })]);
    expect(fake.tables.payments).toHaveLength(1);

    opts.failWrite = null;
    const retry = await (await post({ action: "approve", ids: [1] })).json();
    expect(retry).toMatchObject({ ok: true, approved: 0, skippedDuplicates: 1, incomplete: [] });
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.payments_staging[0].status).toBe("duplicate");
    expect(fake.tables.inquiries[0].payment_status).toBe("paid");
  });

  it("books the inquiry's client, not an alternate payer", async () => {
    setup({
      payments_staging: [stagedRow({ client_name: "Pat Payer", client_email: "pat@example.test" })],
      inquiries: [inquiryRow({ name: "Alex Example", email: "alex@example.test" })],
    });
    await post({ action: "approve", ids: [1] });
    expect(state.portal).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      clientEmail: "alex@example.test", clientName: "Alex Example",
    }));
    expect(String(fake.tables.availability[0].note)).toContain("Alex Example");
  });

  it.each(["deposit_2", "full", "other"])("does not move an earlier deposit date when a later %s payment is approved", async type => {
    const first = "2026-10-01T19:00:00.000Z";
    setup({
      payments_staging: [stagedRow({ payment_type: type })],
      inquiries: [inquiryRow({ payment_status: "paid", deposit_paid_at: first, booking_confirmed: true })],
    });
    await post({ action: "approve", ids: [1] });
    expect(fake.tables.inquiries[0].deposit_paid_at).toBe(first);
  });

  it("replaces a later inferred deposit date with the earlier confirmed payment date", async () => {
    setup({
      payments_staging: [stagedRow()],
      inquiries: [inquiryRow({ deposit_paid_at: "2026-11-18T08:00:00.000Z", booking_confirmed: true })],
    });
    await post({ action: "approve", ids: [1] });
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "paid", deposit_paid_at: PAID_AT });
  });

  it("holds a manual approval when the booking already has that amount, until it is confirmed as separate", async () => {
    setup({
      payments_staging: [stagedRow()],
      payments: [{ id: 7, inquiry_id: 10, status: "active", fingerprint: "older", amount_cents: 10000, client_name: "Alex Example",
        client_email: "alex@example.test", amount: "$100", method: "Zelle", payment_type: "deposit_1", paid_at: "2026-09-01T00:00:00.000Z", session_date: null }],
      inquiries: [inquiryRow({ payment_status: "paid", deposit_paid_at: "2026-09-01T00:00:00.000Z" })],
    });
    const held = await (await post({ action: "approve", ids: [1] })).json();
    expect(held).toMatchObject({ approved: 0, held: [{ id: 1, matches: [7] }] });
    expect(fake.tables.payments).toHaveLength(1);

    const confirmed = await (await post({ action: "approve", ids: [1], confirmIds: [1] })).json();
    expect(confirmed.approved).toBe(1);
    expect(fake.tables.payments).toHaveLength(2);
  });

  it("rejecting a staged row changes nothing on the booking", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    const json = await (await post({ action: "reject", ids: [1] })).json();
    expect(json.ok).toBe(true);
    expect(fake.tables.payments).toHaveLength(0);
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "unpaid", deposit_paid_at: null });
    expect(state.portal).not.toHaveBeenCalled();
  });
});

describe("repairing a confirmed payment's booking", () => {
  const ledgerRow = (over: Record<string, unknown>) => ({
    id: 7, inquiry_id: 10, status: "active", fingerprint: "fp-7", client_name: "Alex Example", client_email: "alex@example.test",
    amount: "$100", method: "Zelle", payment_type: "deposit_1", paid_at: PAID_AT, session_date: null, ...over,
  });

  it.each([
    ["a refunded payment", ledgerRow({ status: "refunded" }), inquiryRow()],
    ["a final installment", ledgerRow({ payment_type: "deposit_2" }), inquiryRow()],
    ["a closed inquiry", ledgerRow({}), inquiryRow({ status: "archived" })],
    ["a booking already showing a deposit date", ledgerRow({}), inquiryRow({ deposit_paid_at: PAID_AT })],
  ])("does not list %s as needing a booking update", async (_label, payment, inquiry) => {
    setup({ payments: [payment], inquiries: [inquiry] });
    const listed = await (await GET(new NextRequest("http://localhost/api/admin/payment-staging"))).json();
    expect(listed.unprojected).toEqual([]);
  });

  it("still serves the review queue when the repair scan fails", async () => {
    setup({ payments_staging: [stagedRow()], inquiries: [inquiryRow()] });
    opts.failRead = { table: "payments" };
    const res = await GET(new NextRequest("http://localhost/api/admin/payment-staging"));
    expect(res.status).toBe(200);
    expect((await res.json()).staged).toHaveLength(1);
  });

  it("rejects more ids than one request may carry", async () => {
    setup({});
    const res = await post({ action: "repair", ids: Array.from({ length: 51 }, (_, i) => i + 1) });
    expect(res.status).toBe(400);
  });

  it("ignores voided payments", async () => {
    setup({
      payments: [
        { id: 7, inquiry_id: 10, status: "voided", fingerprint: "fp-7", client_name: "Alex Example", client_email: "alex@example.test",
          amount: "$100", method: "Zelle", payment_type: "deposit_1", paid_at: PAID_AT, session_date: null },
      ],
      inquiries: [inquiryRow(), inquiryRow({ id: 11 })],
    });
    const listed = await (await GET(new NextRequest("http://localhost/api/admin/payment-staging"))).json();
    expect(listed.unprojected).toEqual([]);
    const json = await (await post({ action: "repair", ids: [7] })).json();
    expect(json).toMatchObject({ ok: true, repaired: 0 });
    expect(fake.tables.inquiries.every(i => i.payment_status === "unpaid")).toBe(true);
  });

  it("is idempotent and never stamps the repair time as the deposit date", async () => {
    setup({
      payments: [
        { id: 7, inquiry_id: 10, status: "active", fingerprint: "fp-7", client_name: "Alex Example", client_email: "alex@example.test",
          amount: "$100", method: "Zelle", payment_type: "deposit_1", paid_at: PAID_AT, session_date: null },
      ],
      inquiries: [inquiryRow()],
    });
    await post({ action: "repair", ids: [7] });
    await post({ action: "repair", ids: [7] });
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "paid", deposit_paid_at: PAID_AT });
  });
});
