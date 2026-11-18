// AI thread scan: output validation and visible failures. Synthetic fixtures.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeGmail, type FakeMail } from "./fakes";

const ai = vi.hoisted(() => ({ text: "{}", error: null as Error | null, calls: 0 }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => {
        ai.calls++;
        if (ai.error) throw ai.error;
        return { content: [{ type: "text", text: ai.text }] };
      },
    };
  },
}));

import {
  parseMilestoneIndices,
  scanMilestonesForClients,
  toThreadEntries,
  type GmailFullMessage,
} from "@/lib/emailTimelineScan";

const CLIENT = "alex@example.com";
const OWNER = "studio@example.com";
const client = { email: CLIENT, name: "Alex Example" };

const thread: FakeMail[] = [
  { id: "t1", box: `thread:${CLIENT}`, from: CLIENT, to: OWNER, subject: "Graduation photos", at: "2026-11-01T10:00:00Z", body: "Hi, are you available?" },
  { id: "t2", box: `thread:${CLIENT}`, from: OWNER, to: CLIENT, subject: "Re: Graduation photos", at: "2026-11-02T10:00:00Z", body: "I just sent over the invoice and contract." },
];

afterEach(() => {
  vi.unstubAllGlobals();
  ai.text = "{}"; ai.error = null; ai.calls = 0;
});

describe("parseMilestoneIndices", () => {
  it("keeps valid email numbers and discards everything else", () => {
    const parsed = parseMilestoneIndices(JSON.stringify({
      reply_sent: 2, invoice_sent: "2", contract_sent: 9, deposit_paid: 0, contract_signed: 1.5,
      gallery_delivered: null, session_date: "next Friday", session_time: "16:00",
    }), 3);
    expect(parsed).toEqual({
      reply_sent: 2, invoice_sent: null, contract_sent: null, deposit_paid: null, contract_signed: null,
      gallery_delivered: null, session_date: null, session_time: "16:00",
    });
  });

  it("throws on output that is not a JSON object", () => {
    expect(() => parseMilestoneIndices("I could not find anything", 3)).toThrow();
    expect(() => parseMilestoneIndices("[1,2,3]", 3)).toThrow();
  });
});

describe("toThreadEntries", () => {
  const full = (id: string, at: string | undefined, labelIds: string[]): GmailFullMessage => ({
    internalDate: at ? String(Date.parse(at)) : undefined,
    labelIds,
    snippet: `body of ${id}`,
    payload: { headers: [{ name: "From", value: OWNER }, { name: "Subject", value: id }] },
  });

  it("drops drafts, trash and undated mail so they can never be evidence", () => {
    const entries = toThreadEntries([
      full("sent", "2026-11-02T10:00:00Z", ["SENT"]),
      full("draft", "2026-11-03T10:00:00Z", ["DRAFT"]),
      full("trashed", "2026-11-04T10:00:00Z", ["TRASH"]),
      full("undated", undefined, ["SENT"]),
    ], CLIENT);
    expect(entries.map(e => e.subject)).toEqual(["sent"]);
  });
});

describe("scanMilestonesForClients", () => {
  it("dates milestones from the email itself, whatever its subject", async () => {
    vi.stubGlobal("fetch", vi.fn(createFakeGmail(thread)));
    ai.text = JSON.stringify({ reply_sent: 2, invoice_sent: 2, contract_sent: 2 });
    const outcome = await scanMilestonesForClients("Bearer x", [client]);
    expect(outcome.results.get(CLIENT)).toMatchObject({
      invoiceSentAt: "2026-11-02T10:00:00.000Z",
      contractSentAt: "2026-11-02T10:00:00.000Z",
      depositPaidAt: null,
    });
    expect(outcome.failed).toEqual([]);
  });

  it("reports a model failure instead of dropping the client silently", async () => {
    vi.stubGlobal("fetch", vi.fn(createFakeGmail(thread)));
    ai.error = new Error("model unavailable");
    const outcome = await scanMilestonesForClients("Bearer x", [client]);
    expect(outcome.results.size).toBe(0);
    expect(outcome.failed).toEqual([CLIENT]);
  });

  it("reports malformed model output as a failed scan", async () => {
    vi.stubGlobal("fetch", vi.fn(createFakeGmail(thread)));
    ai.text = "Sure! Here is what I found:";
    const outcome = await scanMilestonesForClients("Bearer x", [client]);
    expect(outcome.failed).toEqual([CLIENT]);
  });

  it("reports a Gmail failure (expired token, rate limit) as a failed scan", async () => {
    vi.stubGlobal("fetch", vi.fn(createFakeGmail(thread, { [`thread:${CLIENT}`]: 429 })));
    const outcome = await scanMilestonesForClients("Bearer x", [client]);
    expect(outcome.failed).toEqual([CLIENT]);
    expect(ai.calls).toBe(0);
  });

  it("treats a client with no mail as scanned-and-empty, not failed", async () => {
    vi.stubGlobal("fetch", vi.fn(createFakeGmail([])));
    const outcome = await scanMilestonesForClients("Bearer x", [client]);
    expect(outcome).toMatchObject({ failed: [], notScanned: [] });
    expect(outcome.results.size).toBe(0);
  });

  it("stops at the deadline and names who was left unscanned", async () => {
    vi.stubGlobal("fetch", vi.fn(createFakeGmail(thread)));
    const outcome = await scanMilestonesForClients(
      "Bearer x", [client, { email: "Later@Example.com", name: null }], { deadlineAt: Date.now() - 1 },
    );
    expect(outcome.notScanned).toEqual([CLIENT, "later@example.com"]);
    expect(ai.calls).toBe(0);
  });
});
