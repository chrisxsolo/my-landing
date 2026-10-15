// Gmail metadata → conversation messages. Drafts, trashed mail and unrelated
// third parties must never register as a side of the conversation, and the same
// message id seen twice (search hit + linked thread) must count once.

import { describe, it, expect } from "vitest";
import { toReconcileMessages, type GmailMetaMessage } from "@/lib/inquiryReconcileGmail";

const ME = "soloxsnaps@gmail.com";
const ALIAS = "chris@soloxsnaps.com";
const CLIENT = "esterchan059@gmail.com";

const meta = (over: Partial<GmailMetaMessage> & { from: string; at: string }): GmailMetaMessage => ({
  id: over.id ?? `m-${over.at}`,
  threadId: over.threadId ?? "t1",
  internalDate: String(Date.parse(over.at)),
  labelIds: over.labelIds,
  payload: { headers: [{ name: "From", value: over.from }, { name: "To", value: CLIENT }] },
});

describe("toReconcileMessages", () => {
  it("classifies the client as inbound and the account (and aliases) as outbound", () => {
    const messages = toReconcileMessages([
      meta({ id: "a", from: `Esther <${CLIENT}>`, at: "2026-11-01T18:00:00Z", labelIds: ["INBOX"] }),
      meta({ id: "b", from: `Solo x Snaps <${ME}>`, at: "2026-11-01T19:00:00Z", labelIds: ["SENT"] }),
      meta({ id: "c", from: ALIAS, at: "2026-11-01T20:00:00Z", labelIds: ["SENT"] }),
    ], CLIENT, [ME, ALIAS]);
    expect(messages.map(m => `${m.id}:${m.direction}`)).toEqual(["a:inbound", "b:outbound", "c:outbound"]);
  });

  it("drops unsent drafts so a composed-but-never-sent reply is not a response", () => {
    const messages = toReconcileMessages([
      meta({ id: "a", from: CLIENT, at: "2026-11-01T18:00:00Z", labelIds: ["INBOX"] }),
      meta({ id: "draft", from: ME, at: "2026-11-01T19:00:00Z", labelIds: ["DRAFT"] }),
    ], CLIENT, [ME]);
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe("inbound");
  });

  it("drops trashed and spam messages", () => {
    const messages = toReconcileMessages([
      meta({ id: "t", from: ME, at: "2026-11-01T19:00:00Z", labelIds: ["TRASH"] }),
      meta({ id: "s", from: CLIENT, at: "2026-11-01T18:00:00Z", labelIds: ["SPAM"] }),
    ], CLIENT, [ME]);
    expect(messages).toEqual([]);
  });

  it("ignores unrelated third parties in the thread", () => {
    const messages = toReconcileMessages([
      meta({ id: "p", from: "receipts@stripe.com", at: "2026-11-01T19:30:00Z", labelIds: ["INBOX"] }),
      meta({ id: "a", from: CLIENT, at: "2026-11-01T18:00:00Z", labelIds: ["INBOX"] }),
    ], CLIENT, [ME]);
    expect(messages.map(m => m.id)).toEqual(["a"]);
  });

  it("keeps a duplicated message id once", () => {
    const messages = toReconcileMessages([
      meta({ id: "a", from: CLIENT, at: "2026-11-01T18:00:00Z" }),
      meta({ id: "a", from: CLIENT, at: "2026-11-01T18:00:00Z" }),
    ], CLIENT, [ME]);
    expect(messages).toHaveLength(1);
  });

  it("skips metadata with no sender or no timestamp", () => {
    const noDate: GmailMetaMessage = { id: "x", threadId: "t1", payload: { headers: [{ name: "From", value: CLIENT }] } };
    const noFrom: GmailMetaMessage = { id: "y", threadId: "t1", internalDate: "1762020000000", payload: { headers: [] } };
    expect(toReconcileMessages([noDate, noFrom], CLIENT, [ME])).toEqual([]);
  });
});
