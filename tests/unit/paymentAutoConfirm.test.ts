import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeSupabase } from "./support/fakeSupabase";

const portal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/adminPortalSessionUpsert", () => ({ advancePortalSessionForDeposit: portal }));

import { autoConfirmStaged, clientMailRowIsNew, isStronglyAttributed } from "@/lib/paymentAutoConfirm";

const PAID_AT = "2026-11-10T19:00:00.000Z";
const RECENT = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function staged(over: Record<string, unknown> = {}) {
  return {
    id: 1, fingerprint: "fp-1", inquiry_id: 10, client_name: "Alex Example", client_email: "",
    amount: "$100", amount_cents: 10000, method: "Zelle", payment_type: "deposit_1", invoice: "9001", note: "",
    source: "pass1", source_txn_id: "gmail:abc", paid_at: PAID_AT, session_date: "2027-04-24",
    evidence: "Payment on the way for Alex Example's invoice #9001.", status: "pending", created_at: RECENT, ...over,
  };
}

function inquiry(over: Record<string, unknown> = {}) {
  return {
    id: 10, name: "Alex Example", email: "alex@example.test", status: "responded", session_type: "Graduation",
    created_at: "2026-11-01T00:00:00.000Z", gallery_delivered_at: null,
    session_date: "2027-04-24", preferred_time: null, payment_status: "unpaid", payment_note: null,
    payment_detected_at: null, deposit_paid_at: null, booking_confirmed: false, ...over,
  };
}

let fake: FakeSupabase;
function setup(tables: Record<string, Record<string, unknown>[]>) {
  fake = fakeSupabase({ payments_staging: [], payments: [], inquiries: [], availability: [], ...tables });
}

beforeEach(() => {
  vi.clearAllMocks();
  portal.mockResolvedValue("created");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("isStronglyAttributed", () => {
  const people = [
    { id: 10, name: "Alex Example", email: "alex@example.test", status: "responded" },
    { id: 11, name: "Alex Other", email: "other@example.test", status: "responded" },
  ];

  it("accepts a full-name match to exactly one open inquiry", () => {
    expect(isStronglyAttributed(staged(), people)).toBe(true);
  });

  it("accepts an exact email match", () => {
    expect(isStronglyAttributed(staged({ client_name: "A.", client_email: "ALEX@example.test" }), people)).toBe(true);
  });

  it("rejects a first-name-only payer", () => {
    expect(isStronglyAttributed(staged({ client_name: "Alex" }), people)).toBe(false);
  });

  it("rejects a name shared by two open inquiries", () => {
    const twins = [...people, { id: 12, name: "alex  example", email: "twin@example.test", status: "new" }];
    expect(isStronglyAttributed(staged(), twins)).toBe(false);
  });

  it("rejects a row linked to a different inquiry than the one its payer matches", () => {
    expect(isStronglyAttributed(staged({ inquiry_id: 11 }), people)).toBe(false);
  });

  it("rejects closed inquiries, unlinked rows and rows without an amount", () => {
    expect(isStronglyAttributed(staged(), [{ ...people[0], status: "archived" }])).toBe(false);
    expect(isStronglyAttributed(staged({ inquiry_id: null }), people)).toBe(false);
    expect(isStronglyAttributed(staged({ amount_cents: 0 }), people)).toBe(false);
  });

  it("accepts a row found in that client's own mail, and nothing from an unknown source", () => {
    expect(isStronglyAttributed(staged({ source: "pass2", client_name: "Alex" }), people)).toBe(true);
    expect(isStronglyAttributed(staged({ source: "gmail" }), people)).toBe(false);
  });

  it("rejects a delivered booking and a payment dated before the client inquired", () => {
    expect(isStronglyAttributed(staged(), [{ ...people[0], gallery_delivered_at: "2026-11-05T00:00:00.000Z" }])).toBe(false);
    expect(isStronglyAttributed(staged({ paid_at: "2025-11-10T19:00:00.000Z" }),
      [{ ...people[0], created_at: "2026-11-01T00:00:00.000Z" }])).toBe(false);
  });
});

describe("clientMailRowIsNew", () => {
  const row = staged({ source: "auto", client_email: "alex@example.test" });

  it("allows the booking's first payment", () => {
    expect(clientMailRowIsNew(row, [])).toBe(true);
  });

  it("holds a re-check that reads a different amount on an already-paid booking", () => {
    expect(clientMailRowIsNew(row, [{ inquiry_id: 10, client_email: "", client_name: "Alex Example", amount_cents: 42500 }])).toBe(false);
  });

  it("holds last year's payment from a repeat client found on a new booking", () => {
    expect(clientMailRowIsNew(row, [{ inquiry_id: 3, client_email: "ALEX@example.test", client_name: "", amount_cents: 10000 }])).toBe(false);
    expect(clientMailRowIsNew(row, [{ inquiry_id: 3, client_email: "", client_name: "alex example", amount_cents: 10000 }])).toBe(false);
  });

  it("does not apply to provider notifications", () => {
    expect(clientMailRowIsNew(staged(), [{ inquiry_id: 10, client_email: "", client_name: "", amount_cents: 500 }])).toBe(true);
  });
});

describe("autoConfirmStaged", () => {
  it("confirms a payment-on-the-way notice for a clearly matched client with no review step", async () => {
    setup({ payments_staging: [staged()], inquiries: [inquiry()] });
    const out = await autoConfirmStaged(fake.client);
    expect(out.confirmed).toEqual([{ stagingId: 1, inquiryId: 10, clientName: "Alex Example", amountCents: 10000 }]);
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.payments_staging[0].status).toBe("approved");
    expect(fake.tables.inquiries[0]).toMatchObject({ payment_status: "paid", deposit_paid_at: PAID_AT, booking_confirmed: true });
    expect(fake.tables.availability[0]).toMatchObject({ date: "2027-04-24", status: "booked" });
    expect(portal).toHaveBeenCalled();
  });

  it("is safe to run again: nothing is confirmed or counted twice", async () => {
    setup({ payments_staging: [staged()], inquiries: [inquiry()] });
    await autoConfirmStaged(fake.client);
    const again = await autoConfirmStaged(fake.client);
    expect(again.confirmed).toEqual([]);
    expect(fake.tables.payments).toHaveLength(1);
  });

  it("leaves unlinked and weakly matched payments in the review queue", async () => {
    setup({
      payments_staging: [staged({ inquiry_id: null }), staged({ id: 2, fingerprint: "fp-2", client_name: "Alex" })],
      inquiries: [inquiry()],
    });
    const out = await autoConfirmStaged(fake.client);
    expect(out.confirmed).toEqual([]);
    expect(fake.tables.payments_staging.map(r => r.status)).toEqual(["pending", "pending"]);
    expect(fake.tables.payments).toHaveLength(0);
    expect(fake.tables.inquiries[0].payment_status).toBe("unpaid");
  });

  it("holds a detection when the booking already has a payment of the same amount", async () => {
    setup({
      payments_staging: [staged()],
      payments: [{ id: 5, inquiry_id: 10, status: "active", fingerprint: "other", amount_cents: 10000,
        client_name: "Alex Example", client_email: "alex@example.test", method: "Zelle", paid_at: "2026-10-01T00:00:00.000Z" }],
      inquiries: [inquiry({ payment_status: "paid", deposit_paid_at: "2026-10-01T00:00:00.000Z" })],
    });
    const out = await autoConfirmStaged(fake.client);
    expect(out.confirmed).toEqual([]);
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.payments_staging[0].status).toBe("pending");
  });

  it("confirms a different-amount second payment without moving the deposit date", async () => {
    const first = "2026-10-01T00:00:00.000Z";
    setup({
      payments_staging: [staged({ amount: "$300", amount_cents: 30000, payment_type: "deposit_2" })],
      payments: [{ id: 5, inquiry_id: 10, status: "active", fingerprint: "other", amount_cents: 10000,
        client_name: "Alex Example", client_email: "alex@example.test", method: "Zelle", paid_at: first }],
      inquiries: [inquiry({ payment_status: "paid", deposit_paid_at: first })],
    });
    const out = await autoConfirmStaged(fake.client);
    expect(out.confirmed).toHaveLength(1);
    expect(fake.tables.inquiries[0].deposit_paid_at).toBe(first);
  });

  it("leaves a detection nobody acted on for over a month alone", async () => {
    setup({ payments_staging: [staged({ created_at: "2026-06-12T00:00:00.000Z" })], inquiries: [inquiry()] });
    expect((await autoConfirmStaged(fake.client)).confirmed).toEqual([]);
    expect(fake.tables.payments).toHaveLength(0);
  });

  it("holds an AI-read payment when the booking already has one, whatever the amount", async () => {
    setup({
      payments_staging: [staged({ source: "auto", amount: "$425", amount_cents: 42500 })],
      payments: [{ id: 5, inquiry_id: 10, status: "active", fingerprint: "other", amount_cents: 10000,
        client_name: "Alex Example", client_email: "alex@example.test", method: "Zelle", paid_at: PAID_AT }],
      inquiries: [inquiry({ payment_status: "paid", deposit_paid_at: PAID_AT })],
    });
    expect((await autoConfirmStaged(fake.client)).confirmed).toEqual([]);
    expect(fake.tables.payments).toHaveLength(1);
  });

  it("holds a look-alike transfer recorded under other evidence", async () => {
    setup({
      payments_staging: [staged()],
      payments: [{ id: 5, inquiry_id: null, status: "active", fingerprint: "other", amount_cents: 10000,
        client_name: "Alex Example", client_email: "", method: "Zelle", paid_at: "2026-11-10T12:00:00.000Z", source: "manual", source_txn_id: "", invoice: "" }],
      inquiries: [inquiry()],
    });
    expect((await autoConfirmStaged(fake.client)).confirmed).toEqual([]);
    expect(fake.tables.payments).toHaveLength(1);
  });

  it("never brings back a rejected detection", async () => {
    setup({ payments_staging: [staged({ status: "rejected" })], inquiries: [inquiry()] });
    expect((await autoConfirmStaged(fake.client)).confirmed).toEqual([]);
    expect(fake.tables.payments).toHaveLength(0);
  });

  it("limits a per-client check to that client's payments", async () => {
    setup({
      payments_staging: [staged(), staged({ id: 2, fingerprint: "fp-2", inquiry_id: 11, client_name: "Blair Sample" })],
      inquiries: [inquiry(), inquiry({ id: 11, name: "Blair Sample", email: "blair@example.test" })],
    });
    const out = await autoConfirmStaged(fake.client, { inquiryId: 11 });
    expect(out.confirmed.map(c => c.inquiryId)).toEqual([11]);
    expect(fake.tables.inquiries.find(i => i.id === 10)?.payment_status).toBe("unpaid");
  });

  it("reports a booking update that failed instead of calling it confirmed and done", async () => {
    setup({ payments_staging: [staged()], inquiries: [inquiry()] });
    portal.mockRejectedValueOnce(new Error("boom"));
    const out = await autoConfirmStaged(fake.client);
    expect(out.incomplete).toEqual([expect.objectContaining({ id: 1, failed: ["portal"] })]);
  });
});
