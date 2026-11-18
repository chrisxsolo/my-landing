// End-to-end tests for POST /api/admin/sessions/sync-sent-invoices against an
// in-memory Gmail and database. Every client, number and message is synthetic.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createFakeDb, createFakeGmail, type FakeMail, type Row } from "./fakes";

const OWNER = "studio@example.com";
const CLIENT = "alex@example.com";
const SHARE = "SoloxSnaps <mailer@share.pixiesetmail.com>";
const NOTICE = "Pixieset <no-reply@notifications.pixiesetmail.com>";

const state = vi.hoisted(() => ({
  reconcileUpdated: 0,
  authorized: true,
  db: null as unknown,
  aiText: "{}",
  aiError: null as Error | null,
  reconcileCalls: 0,
}));

vi.mock("@/lib/requireAdmin", () => ({
  requireAdmin: () => (state.authorized ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 })),
}));
vi.mock("@/lib/gmailTokens", () => ({
  getValidTokens: async () => ({ access_token: "test-token", email: OWNER }),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: () => state.db }));
vi.mock("@/lib/inquiryReconcileGmail", () => ({
  getConnectedAccountEmails: async () => [OWNER],
  reconcileInquiriesWithGmail: async () => {
    state.reconcileCalls++;
    return { processed: 0, updated: state.reconcileUpdated, unchanged: 0, statusRepaired: 0, failed: 0, changes: [] };
  },
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => {
        if (state.aiError) throw state.aiError;
        return { content: [{ type: "text", text: state.aiText }] };
      },
    };
  },
}));

import { POST } from "@/app/api/admin/sessions/sync-sent-invoices/route";
import type { TimelineSyncReport } from "@/lib/timelineSync/report";

const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const inquiryRow = (over: Row = {}): Row => ({
  id: 1, email: CLIENT, name: "Alex Example", status: "responded", created_at: recent(10),
  last_message_at: null, session_type: "Graduation", session_date: null, date_in_mind: null,
  preferred_time: null, location: null, reply_sent_at: recent(9), invoice_sent_at: null,
  contract_sent_at: null, deposit_paid_at: null, gallery_delivered_at: null, booking_confirmed: false, ...over,
});

const sessionRow = (over: Row = {}): Row => ({
  id: "s1", client_email: CLIENT, client_name: "Alex Example", session_type: "Graduation", session_date: null,
  invoice_status: null, contract_status: null, current_status: "inquiry_received",
  estimated_delivery_date: null, ...over,
});

const INVOICE_AT = recent(3);
const CONTRACT_AT = new Date(Date.parse(INVOICE_AT) - 5_000).toISOString();
const SIGNED_AT = recent(2);

const invoiceCopy: FakeMail = {
  id: "p-inv", box: "provider", from: SHARE, to: OWNER, subject: "Invoice #9001 from SoloxSnaps", at: INVOICE_AT,
  snippet: "SoloxSnaps Invoice #9001 $100.00 Due by January 1, 2027 Hi Alex, Here&#39;s your invoice",
};
const contractCopy: FakeMail = {
  id: "p-con", box: "provider", from: SHARE, to: OWNER, subject: "Contract from SoloxSnaps", at: CONTRACT_AT,
  snippet: "SoloxSnaps Your contract to review and sign Alex Example Contract Hi, Your contract is ready for review.",
};
const completion: FakeMail = {
  id: "p-done", box: "provider", from: NOTICE, to: OWNER, subject: "Alex Example's contract is complete",
  at: SIGNED_AT, labelIds: [], // archived
};
const paymentOnTheWay: FakeMail = {
  id: "p-pay", box: "provider", from: NOTICE, to: OWNER,
  subject: "Payment on the way for Alex Example's invoice #9001", at: recent(1),
};
const PIXIESET_MAIL = [invoiceCopy, contractCopy, completion, paymentOnTheWay];

type Body = { report: TimelineSyncReport; message?: string; error?: string };

async function runSync(mailbox: FakeMail[], tables: Record<string, Row[]>, failBoxes: Record<string, number> = {}, dbOptions = {}) {
  const db = createFakeDb(tables, dbOptions);
  state.db = db.client;
  vi.stubGlobal("fetch", vi.fn(createFakeGmail(mailbox, failBoxes)));
  const res = await POST(new NextRequest("http://localhost/api/admin/sessions/sync-sent-invoices", { method: "POST" }));
  return { res, body: await res.json() as Body, db };
}

beforeEach(() => {
  state.reconcileUpdated = 0; state.authorized = true; state.aiText = "{}"; state.aiError = null; state.reconcileCalls = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("POST /api/admin/sessions/sync-sent-invoices", () => {
  it("rejects an unauthorized request before touching Gmail or the database", async () => {
    state.authorized = false;
    const { res, db } = await runSync(PIXIESET_MAIL, { inquiries: [inquiryRow()], client_sessions: [] });
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });

  it("stamps an inquiry-only client from Pixieset's owner-addressed copies", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [], availability: [] };
    const { res, body, db } = await runSync(PIXIESET_MAIL, tables);
    expect(res.status).toBe(200);
    expect(tables.inquiries[0]).toMatchObject({
      invoice_sent_at: INVOICE_AT, contract_sent_at: CONTRACT_AT,
      deposit_paid_at: null, booking_confirmed: false, session_date: null,
    });
    // Sent + signed + "payment on the way" is not a booking.
    expect(tables.client_sessions).toEqual([]);
    expect(db.writes.filter(w => w.table !== "inquiries")).toEqual([]);
    expect(body.report).toMatchObject({
      status: "complete",
      applied: { inquiries: 1, sessions: 0, sessionsCreated: 0, replyStatuses: 0 },
      skipped: { signedWithoutSession: 1 },
    });
  });

  it("is idempotent: a second run writes nothing and says so", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [] };
    await runSync(PIXIESET_MAIL, tables);
    const second = await runSync(PIXIESET_MAIL, tables);
    expect(second.db.writes).toEqual([]);
    expect(second.body.report.applied).toEqual({ inquiries: 0, sessions: 0, sessionsCreated: 0, replyStatuses: 0 });
    expect(second.body.message).toMatch(/already up to date/);
    expect(tables.client_sessions).toEqual([]);
  });

  it("keeps dates that were already recorded", async () => {
    const original = recent(8);
    const tables = { inquiries: [inquiryRow({ invoice_sent_at: original })], client_sessions: [] };
    await runSync(PIXIESET_MAIL, tables);
    expect(tables.inquiries[0].invoice_sent_at).toBe(original);
    expect(tables.inquiries[0].contract_sent_at).toBe(CONTRACT_AT);
  });

  it("records signing on the matched portal session without booking it", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [sessionRow()] };
    const { body } = await runSync(PIXIESET_MAIL, tables);
    expect(tables.client_sessions[0]).toMatchObject({
      invoice_status: "sent", contract_status: "signed", current_status: "booking_in_progress",
    });
    expect(tables.inquiries[0]).toMatchObject({ deposit_paid_at: null, booking_confirmed: false });
    expect(body.report.applied.sessions).toBe(1);
  });

  it("a completion notice alone records signing but never invents a sent date", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [sessionRow()] };
    await runSync([completion], tables);
    expect(tables.inquiries[0].contract_sent_at).toBeNull();
    expect(tables.client_sessions[0]).toMatchObject({ contract_status: "signed", invoice_status: null });
  });

  it("never regresses a paid, later-stage session", async () => {
    const later = sessionRow({ invoice_status: "paid", contract_status: "signed", current_status: "editing" });
    const tables = { inquiries: [inquiryRow({ deposit_paid_at: recent(5), booking_confirmed: true })], client_sessions: [later] };
    await runSync(PIXIESET_MAIL, tables);
    expect(tables.client_sessions[0]).toMatchObject({
      invoice_status: "paid", contract_status: "signed", current_status: "editing",
    });
  });

  it("does not stamp an earlier booking that shares the client's address", async () => {
    const lastYear = inquiryRow({ id: 7, created_at: recent(400), reply_sent_at: recent(399) });
    const tables = { inquiries: [inquiryRow({ id: 8 }), lastYear], client_sessions: [] };
    await runSync(PIXIESET_MAIL, tables);
    expect(tables.inquiries[0].invoice_sent_at).toBe(INVOICE_AT);
    expect(tables.inquiries[1]).toMatchObject({ invoice_sent_at: null, contract_sent_at: null });
  });

  it("reports a first-name-only invoice as needing review instead of guessing", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [] };
    const { body } = await runSync([invoiceCopy], tables);
    expect(tables.inquiries[0].invoice_sent_at).toBeNull();
    expect(body.report.ambiguous.providerNotices).toBe(1);
    expect(body.message).toMatch(/Needs review/);
  });

  it("ignores a look-alike Pixieset sender", async () => {
    const spoof = { ...completion, from: "Pixieset <no-reply@notifications.pixiesetmail.com.evil.example>" };
    const tables = { inquiries: [inquiryRow()], client_sessions: [sessionRow()] };
    await runSync([spoof], tables);
    expect(tables.client_sessions[0].contract_status).toBeNull();
  });

  it("stamps both sent milestones from an ordinary outgoing confirmation", async () => {
    const thread: FakeMail[] = [
      { id: "t1", box: `thread:${CLIENT}`, from: CLIENT, to: OWNER, subject: "Graduation photos", at: recent(9), body: "Are you available?" },
      { id: "t2", box: `thread:${CLIENT}`, from: OWNER, to: CLIENT, subject: "Re: Graduation photos", at: recent(4), body: "I just sent the invoice and contract." },
    ];
    state.aiText = JSON.stringify({ reply_sent: 2, invoice_sent: 2, contract_sent: 2 });
    const tables = { inquiries: [inquiryRow()], client_sessions: [] };
    const { body } = await runSync(thread, tables);
    expect(tables.inquiries[0]).toMatchObject({ invoice_sent_at: thread[1].at, contract_sent_at: thread[1].at });
    expect(body.report.status).toBe("complete");
  });

  it("makes a failed thread scan visible", async () => {
    state.aiError = new Error("model unavailable");
    const thread: FakeMail[] = [
      { id: "t1", box: `thread:${CLIENT}`, from: OWNER, to: CLIENT, subject: "Re: hi", at: recent(4), body: "Invoice sent." },
    ];
    const { res, body } = await runSync(thread, { inquiries: [inquiryRow()], client_sessions: [] });
    expect(res.status).toBe(200);
    expect(body.report).toMatchObject({ status: "partial", failed: { scans: 1 } });
    expect(body.message).not.toMatch(/already up to date/);
  });

  it("returns 502 and writes nothing when Gmail rejects every search", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [sessionRow()] };
    const { res, body, db } = await runSync(PIXIESET_MAIL, tables, { "*": 401 });
    expect(res.status).toBe(502);
    expect(body.report.status).toBe("failed");
    expect(db.writes).toEqual([]);
    expect(state.reconcileCalls).toBe(0);
  });

  it("reports a rate-limited search as partial while applying what it did find", async () => {
    const sent: FakeMail = { id: "s1", box: "sent", from: OWNER, to: "new@example.com", subject: "Re: hello", at: recent(1) };
    const tables = {
      inquiries: [inquiryRow(), inquiryRow({ id: 2, email: "new@example.com", name: "New Person", reply_sent_at: null })],
      client_sessions: [],
    };
    const { res, body } = await runSync([...PIXIESET_MAIL, sent], tables, { provider: 429 });
    expect(res.status).toBe(200);
    expect(body.report).toMatchObject({ status: "partial", failed: { discovery: ["provider_documents"] } });
    expect(tables.inquiries[0].invoice_sent_at).toBeNull();
    expect(tables.inquiries[1].reply_sent_at).toBe(sent.at);
  });

  it("counts only confirmed writes when the database refuses an update", async () => {
    const tables = { inquiries: [inquiryRow()], client_sessions: [] };
    const { body } = await runSync(PIXIESET_MAIL, tables, {}, { failUpdatesOn: ["inquiries"] });
    expect(tables.inquiries[0].invoice_sent_at).toBeNull();
    expect(body.report).toMatchObject({ status: "partial", applied: { inquiries: 0 }, failed: { writes: 1 } });
    expect(body.message).toMatch(/did not save/);
  });

  it("never credits an invoice to a different client who shares the first name", async () => {
    const other = inquiryRow({ id: 2, email: "alex.other@example.com", name: "Alex Other" });
    const tables = { inquiries: [inquiryRow(), other], client_sessions: [] };
    // Only Alex Example's contract is on record; the invoice could be either Alex's.
    const { body } = await runSync([invoiceCopy, contractCopy], tables);
    expect(tables.inquiries.map(i => i.invoice_sent_at)).toEqual([null, null]);
    expect(tables.inquiries[0].contract_sent_at).toBe(CONTRACT_AT);
    expect(body.report.ambiguous.providerNotices).toBe(1);
  });

  it("stamps both copies of a form the client submitted twice", async () => {
    const duplicate = inquiryRow({ id: 2, created_at: recent(10.01) });
    const tables = { inquiries: [inquiryRow(), duplicate], client_sessions: [] };
    await runSync(PIXIESET_MAIL, tables);
    expect(tables.inquiries.map(i => i.invoice_sent_at)).toEqual([INVOICE_AT, INVOICE_AT]);
  });

  it("never treats the studio's own address as a client", async () => {
    const selfSent: FakeMail = { id: "self", box: "sent", from: OWNER, to: OWNER, subject: "note to self", at: recent(1) };
    const tables = { inquiries: [inquiryRow({ id: 9, email: OWNER, name: "Studio Test", reply_sent_at: null })], client_sessions: [] };
    const { db } = await runSync([selfSent], tables);
    expect(db.writes).toEqual([]);
  });

  it("creates a booked portal session only from deposit evidence found this run", async () => {
    const venmo: FakeMail = { id: "v1", box: "payments", from: "Venmo <venmo@venmo.com>", to: OWNER, subject: "Alex Example paid you $50.00", at: recent(1) };
    // Old paid inquiry, no mail this run: nothing is created for it.
    const dormant = { inquiries: [inquiryRow({ deposit_paid_at: recent(300), booking_confirmed: true, created_at: recent(320) })], client_sessions: [] };
    await runSync([], dormant);
    expect(dormant.client_sessions).toEqual([]);

    // Deposit receipt for a client with a session: session is marked paid and booked.
    const active = { inquiries: [inquiryRow()], client_sessions: [sessionRow()] };
    const { body } = await runSync([venmo], active);
    expect(active.client_sessions[0]).toMatchObject({ invoice_status: "paid", current_status: "booked" });
    expect(active.inquiries[0]).toMatchObject({ deposit_paid_at: venmo.at, booking_confirmed: true });
    expect(body.report.applied.sessionsCreated).toBe(0);
  });

  it("retries the calendar write next run when it fails", async () => {
    const thread: FakeMail[] = [
      { id: "t1", box: `thread:${CLIENT}`, from: OWNER, to: CLIENT, subject: "Re: hi", at: recent(4), body: "Confirmed for the 5th." },
    ];
    state.aiText = JSON.stringify({ session_date: "2027-01-05" });
    const tables = { inquiries: [inquiryRow({ deposit_paid_at: recent(5), booking_confirmed: true })], client_sessions: [sessionRow({ current_status: "booked", invoice_status: "paid" })] };
    const failed = await runSync(thread, tables, {}, { failUpdatesOn: ["client_sessions"] });
    expect(tables.inquiries[0].session_date).toBeNull();
    expect(failed.body.report.failed.writes).toBeGreaterThan(0);
    await runSync(thread, tables);
    expect(tables.inquiries[0].session_date).toBe("2027-01-05");
    expect(tables.client_sessions[0].session_date).toBe("2027-01-05");
  });

  it("reports repaired reply statuses instead of 'up to date'", async () => {
    state.reconcileUpdated = 2;
    const { body } = await runSync([], { inquiries: [inquiryRow()], client_sessions: [] });
    expect(body.report.applied.replyStatuses).toBe(2);
    expect(body.message).toMatch(/2 reply statuses/);
  });
});
