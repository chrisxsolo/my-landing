// Planning logic for the automatic on-open inquiry refresh. These tests pin the
// efficiency properties (query count independent of inquiry count, no fetches
// on a quiet open, cooldown) and the attribution rules.

import { describe, it, expect } from "vitest";
import {
  ADDRESSES_PER_QUERY,
  buildRefreshQueries,
  groupMessagesByInquiry,
  REFRESH_ACTIVE_WINDOW_MS,
  REFRESH_COOLDOWN_MS,
  REFRESH_MAX_LOOKBACK_MS,
  REFRESH_OVERLAP_MS,
  refreshWindowStart,
  selectRefreshCandidates,
  withinCooldown,
} from "@/lib/inquiryAutoRefresh";
import {
  computeInquiryReconciliation,
  type ReconcileInquirySnapshot,
  type ReconcileMessage,
} from "@/lib/inquiryReconcile";
import { toReconcileMessages, type GmailMetaMessage } from "@/lib/inquiryReconcileGmail";
import { inquiryConversationStatus, type AdminInquiry } from "@/lib/adminInquiries";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const ME = "soloxsnaps@gmail.com";

describe("refreshWindowStart", () => {
  it("starts a little before the stored cursor", () => {
    const cursor = NOW - 30 * 60 * 1000;
    expect(refreshWindowStart(cursor, NOW)).toBe(cursor - REFRESH_OVERLAP_MS);
  });

  it("falls back to the lookback cap with no cursor", () => {
    expect(refreshWindowStart(null, NOW)).toBe(NOW - REFRESH_MAX_LOOKBACK_MS);
  });

  it("clamps a long-stale cursor to the lookback cap", () => {
    expect(refreshWindowStart(NOW - 400 * 24 * 60 * 60 * 1000, NOW)).toBe(NOW - REFRESH_MAX_LOOKBACK_MS);
  });
});

describe("withinCooldown", () => {
  it("suppresses a repeat open inside the cooldown and allows one after", () => {
    expect(withinCooldown(NOW - 1_000, NOW)).toBe(true);
    expect(withinCooldown(NOW - REFRESH_COOLDOWN_MS - 1, NOW)).toBe(false);
    expect(withinCooldown(null, NOW)).toBe(false);
  });

  it("does not trust a cursor from the future", () => {
    expect(withinCooldown(NOW + 60_000, NOW)).toBe(false);
  });
});

describe("buildRefreshQueries", () => {
  it("scopes one windowed query to every address, in epoch seconds", () => {
    const [query, ...rest] = buildRefreshQueries(["A@Client.com", "b@client.com"], NOW - 60_000);
    expect(rest).toEqual([]);
    expect(query).toContain(`after:${Math.floor((NOW - 60_000) / 1000)}`);
    expect(query).toContain("from:a@client.com OR to:a@client.com OR cc:a@client.com");
    expect(query).toContain("b@client.com");
  });

  it("de-dupes addresses so two inquiries from one client cost nothing extra", () => {
    expect(buildRefreshQueries(["a@client.com", "A@CLIENT.COM"], NOW)).toHaveLength(1);
  });

  it("chunks large address sets instead of building one huge query", () => {
    const emails = Array.from({ length: ADDRESSES_PER_QUERY * 2 + 1 }, (_, i) => `c${i}@client.com`);
    const queries = buildRefreshQueries(emails, NOW);
    expect(queries).toHaveLength(3);
    for (const query of queries) expect(query.length).toBeLessThan(2000);
  });

  it("asks Gmail nothing when there is nothing to scan", () => {
    expect(buildRefreshQueries([], NOW)).toEqual([]);
    expect(buildRefreshQueries(["not-an-address"], NOW)).toEqual([]);
  });
});

describe("selectRefreshCandidates", () => {
  const row = (over: Partial<{ status: string; created_at: string; last_message_at: string | null }> = {}) => ({
    status: "responded", created_at: "2026-11-01T00:00:00Z", last_message_at: "2026-11-09T00:00:00Z", ...over,
  });

  it("skips closed dispositions so sync can never reopen them", () => {
    const rows = [row({ status: "archived" }), row({ status: "not_interested" }), row({ status: "manual" }), row()];
    expect(selectRefreshCandidates(rows, NOW)).toHaveLength(1);
  });

  it("skips conversations with no activity inside the active window", () => {
    const stale = row({
      created_at: new Date(NOW - REFRESH_ACTIVE_WINDOW_MS - 1000).toISOString(),
      last_message_at: new Date(NOW - REFRESH_ACTIVE_WINDOW_MS - 1000).toISOString(),
    });
    expect(selectRefreshCandidates([stale], NOW)).toEqual([]);
  });

  it("keeps an old inquiry whose latest message is recent", () => {
    const revived = row({ created_at: "2026-01-01T00:00:00Z", last_message_at: "2026-11-09T00:00:00Z" });
    expect(selectRefreshCandidates([revived], NOW)).toHaveLength(1);
  });

  it("keeps a live row with unusable dates rather than dropping it", () => {
    expect(selectRefreshCandidates([row({ created_at: "", last_message_at: null })], NOW)).toHaveLength(1);
  });
});

describe("groupMessagesByInquiry", () => {
  const inquiries = [
    { id: 1, email: "esther@client.com" },
    { id: 2, email: "noah@client.com" },
  ];
  const message = (over: Partial<ReconcileMessage>): ReconcileMessage => ({
    id: "m1", threadId: "t1", at: "2026-11-10T10:00:00Z",
    fromEmail: "esther@client.com", direction: "inbound", ...over,
  });

  it("attributes an inbound message by its sender", () => {
    const grouped = groupMessagesByInquiry(inquiries, [message({})]);
    expect([...grouped.keys()]).toEqual([1]);
  });

  it("attributes an outbound message by its recipient", () => {
    const grouped = groupMessagesByInquiry(inquiries, [message({
      direction: "outbound", fromEmail: ME, participants: [ME, "noah@client.com"],
    })]);
    expect([...grouped.keys()]).toEqual([2]);
  });

  it("drops mail that involves nobody we track", () => {
    const grouped = groupMessagesByInquiry(inquiries, [message({ fromEmail: "stranger@example.com" })]);
    expect(grouped.size).toBe(0);
  });

  it("does not attribute an outbound message with no known recipient", () => {
    const grouped = groupMessagesByInquiry(inquiries, [message({
      direction: "outbound", fromEmail: ME, participants: [ME, "someone@else.com"],
    })]);
    expect(grouped.size).toBe(0);
  });

  it("gives the message to every inquiry that client has", () => {
    const twice = [...inquiries, { id: 3, email: "Esther@Client.com" }];
    const grouped = groupMessagesByInquiry(twice, [message({})]);
    expect([...grouped.keys()].sort()).toEqual([1, 3]);
  });

  it("keeps each inquiry's messages together for reconciliation", () => {
    const grouped = groupMessagesByInquiry(inquiries, [
      message({ id: "a", at: "2026-11-10T10:00:00Z" }),
      message({ id: "b", at: "2026-11-10T11:00:00Z", direction: "outbound", fromEmail: ME, participants: [ME, "esther@client.com"] }),
      message({ id: "c", fromEmail: "noah@client.com" }),
    ]);
    expect(grouped.get(1)?.map(m => m.id)).toEqual(["a", "b"]);
    expect(grouped.get(2)?.map(m => m.id)).toEqual(["c"]);
  });
});

// ─── The whole on-open path, with only the Gmail HTTP calls left out ─────────
describe("on-open refresh end to end", () => {
  const CLIENT = "esther@client.com";

  const meta = (from: string, at: string, over: Partial<GmailMetaMessage> = {}): GmailMetaMessage => ({
    id: `g-${at}`, threadId: "t1", internalDate: String(Date.parse(at)), labelIds: ["INBOX"],
    payload: { headers: [
      { name: "From", value: from },
      { name: "To", value: from === ME ? CLIENT : ME },
    ] },
    ...over,
  });

  /** An inquiry already answered once, as the DB holds it. */
  const answeredRow = {
    id: 7, email: CLIENT, status: "responded", statusSource: "automatic",
    createdAt: "2026-11-08T18:00:00Z", replySentAt: "2026-11-08T19:00:00Z",
    invoiceSentAt: null, contractSentAt: null, depositPaidAt: null, confirmationSentAt: null,
    galleryDeliveredAt: null, bookingConfirmed: false, paymentStatus: "unpaid",
    needsReply: false, needsReplyDismissedAt: null,
    lastInboundAt: "2026-11-08T18:00:00Z", lastOutboundAt: "2026-11-08T19:00:00Z",
    lastMessageAt: "2026-11-08T19:00:00Z", lastMessageDirection: "outbound",
    gmailThreadIds: ["t1"],
  } satisfies ReconcileInquirySnapshot;

  /** Runs the pure pipeline the route runs, then derives what the card shows. */
  const refresh = (row: ReconcileInquirySnapshot, metas: GmailMetaMessage[]) => {
    const messages = toReconcileMessages(metas, [row.email], [ME]);
    const grouped = groupMessagesByInquiry([{ id: row.id, email: row.email }], messages);
    const result = computeInquiryReconciliation(row, grouped.get(row.id) ?? []);
    const card = inquiryConversationStatus({
      status: result.nextStatus,
      created_at: row.createdAt,
      needs_reply: result.needsReply,
      needs_reply_dismissed_at: row.needsReplyDismissedAt,
      reply_sent_at: (result.updates.reply_sent_at as string) ?? row.replySentAt,
      invoice_sent_at: row.invoiceSentAt, contract_sent_at: row.contractSentAt,
      deposit_paid_at: row.depositPaidAt, confirmation_sent_at: row.confirmationSentAt,
      gallery_delivered_at: row.galleryDeliveredAt, booking_confirmed: row.bookingConfirmed,
      payment_status: row.paymentStatus,
      last_inbound_at: (result.updates.last_inbound_at as string) ?? row.lastInboundAt,
      last_outbound_at: (result.updates.last_outbound_at as string) ?? row.lastOutboundAt,
      last_message_direction: (result.updates.last_message_direction as string) ?? row.lastMessageDirection,
    } as AdminInquiry);
    return { result, card };
  };

  it("turns the card amber when only the client's new reply is in the window", () => {
    const { result, card } = refresh(answeredRow, [meta(CLIENT, "2026-11-10T09:00:00Z")]);
    expect(result.needsReply).toBe(true);
    expect(card).toBe("needs_reply");
  });

  it("turns the card blue when only a reply sent from Gmail is in the window", () => {
    const waiting = { ...answeredRow, needsReply: true, lastInboundAt: "2026-11-10T09:00:00Z", lastMessageAt: "2026-11-10T09:00:00Z", lastMessageDirection: "inbound" };
    const { result, card } = refresh(waiting, [meta(ME, "2026-11-10T10:00:00Z")]);
    expect(result.needsReply).toBe(false);
    expect(card).toBe("responded");
  });

  it("ignores a draft reply sitting in the window", () => {
    const waiting = { ...answeredRow, needsReply: true, lastInboundAt: "2026-11-10T09:00:00Z", lastMessageAt: "2026-11-10T09:00:00Z", lastMessageDirection: "inbound" };
    const { result, card } = refresh(waiting, [meta(ME, "2026-11-10T10:00:00Z", { labelIds: ["DRAFT"] })]);
    expect(result.needsReply).toBe(true);
    expect(card).toBe("needs_reply");
  });

  it("does not regress state when the window happens to be empty", () => {
    const { result, card } = refresh(answeredRow, []);
    expect(result.changed).toBe(false);
    expect(card).toBe("responded");
  });

  it("keeps alternating across consecutive refreshes", () => {
    let row: ReconcileInquirySnapshot = answeredRow;
    const steps: { from: string; at: string; card: string }[] = [
      { from: CLIENT, at: "2026-11-10T09:00:00Z", card: "needs_reply" },
      { from: ME, at: "2026-11-10T10:00:00Z", card: "responded" },
      { from: CLIENT, at: "2026-11-10T11:00:00Z", card: "needs_reply" },
      { from: ME, at: "2026-11-10T12:00:00Z", card: "responded" },
    ];
    for (const step of steps) {
      const { result, card } = refresh(row, [meta(step.from, step.at)]);
      expect(card, step.at).toBe(step.card);
      row = {
        ...row,
        status: result.nextStatus,
        needsReply: result.needsReply,
        lastInboundAt: (result.updates.last_inbound_at as string) ?? row.lastInboundAt,
        lastOutboundAt: (result.updates.last_outbound_at as string) ?? row.lastOutboundAt,
        lastMessageAt: (result.updates.last_message_at as string) ?? row.lastMessageAt,
        lastMessageDirection: (result.updates.last_message_direction as string) ?? row.lastMessageDirection,
      };
    }
  });
});
