// Subject/sender heuristics for the timeline sync. All fixtures are synthetic.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchMessages,
  isContractSignedSubject,
  isPaymentReceivedSubject,
  matchClientNameInSubject,
  msgDate,
  parseSenderAddress,
} from "@/lib/gmailSyncHelpers";

const PIXIESET_NOTICE = "Pixieset <no-reply@notifications.pixiesetmail.com>";

describe("parseSenderAddress", () => {
  it("reads the real address, not one planted in the display name", () => {
    expect(parseSenderAddress('"no-reply@notifications.pixiesetmail.com" <evil@example.com>'))
      .toBe("evil@example.com");
    expect(parseSenderAddress("Someone <A@Example.com>")).toBe("a@example.com");
    expect(parseSenderAddress("plain@example.com")).toBe("plain@example.com");
    expect(parseSenderAddress("not an address")).toBeNull();
  });
});

describe("isContractSignedSubject", () => {
  it("accepts the Pixieset 'contract is complete' notice", () => {
    expect(isContractSignedSubject("Alex Example's contract is complete", PIXIESET_NOTICE)).toBe(true);
  });

  it("still accepts legacy e-sign provider shapes", () => {
    expect(isContractSignedSubject("Completed: Photography Agreement", "DocuSign <dse@docusign.net>")).toBe(true);
    expect(isContractSignedSubject("Document signed by Alex", "PandaDoc <docs@pandadoc.com>")).toBe(true);
    expect(isContractSignedSubject("Contract signed", "HoneyBook <no-reply@honeybook.com>")).toBe(true);
  });

  it("rejects a look-alike sender domain", () => {
    expect(isContractSignedSubject(
      "Alex Example's contract is complete",
      "Pixieset <no-reply@notifications.pixiesetmail.com.evil.example>",
    )).toBe(false);
    expect(isContractSignedSubject(
      "Alex Example's contract is complete",
      '"no-reply@notifications.pixiesetmail.com" <someone@example.com>',
    )).toBe(false);
  });

  it("rejects ordinary discussion of a contract from a non-provider", () => {
    expect(isContractSignedSubject("Re: will the contract be signed by Friday?", "Alex <alex@example.com>")).toBe(false);
    expect(isContractSignedSubject("Contract signed", "Alex <alex@example.com>")).toBe(false);
  });
});

describe("isPaymentReceivedSubject", () => {
  it("does not treat a Pixieset payment-on-the-way notice as received funds", () => {
    expect(isPaymentReceivedSubject("Payment on the way for Alex Example's invoice #9001", PIXIESET_NOTICE)).toBe(false);
  });
});

describe("matchClientNameInSubject", () => {
  const clients = new Map([
    ["alex@example.com", "Alex Example"],
    ["alexa@example.com", "Alexa Sample"],
    ["sam@example.com", "Sam"],
  ]);

  it("matches only a whole full name", () => {
    expect(matchClientNameInSubject("Alex Example paid you $50.00", clients)).toBe("alex@example.com");
  });

  it("does not match on a shared or partial name token", () => {
    expect(matchClientNameInSubject("Alex Other paid you $50.00", clients)).toBeNull();
    expect(matchClientNameInSubject("Alexander Examples paid you", clients)).toBeNull();
    expect(matchClientNameInSubject("Sam paid you $50.00", clients)).toBeNull();
  });

  it("returns nothing when two clients share the full name", () => {
    const twins = new Map([["a@example.com", "Alex Example"], ["b@example.com", "alex example"]]);
    expect(matchClientNameInSubject("Alex Example paid you", twins)).toBeNull();
  });
});

describe("msgDate", () => {
  it("never invents a timestamp for a message without one", () => {
    expect(msgDate(undefined)).toBeNull();
    expect(msgDate("not-a-number")).toBeNull();
    expect(msgDate("1795000000000")).toBe(new Date(1795000000000).toISOString());
  });
});

describe("fetchMessages", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubGmail(handler: (url: string) => { status: number; body?: unknown }) {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const { status, body } = handler(String(input));
      return new Response(JSON.stringify(body ?? {}), { status });
    }));
  }

  it("reports a failed search instead of an empty success", async () => {
    stubGmail(() => ({ status: 401 }));
    const result = await fetchMessages("Bearer x", "anything", 50);
    expect(result).toMatchObject({ messages: [], listFailed: true });
  });

  it("counts unreadable messages and drops drafts, trash and spam", async () => {
    stubGmail((url) => {
      if (url.includes("/messages?")) {
        return { status: 200, body: { messages: [{ id: "ok" }, { id: "draft" }, { id: "boom" }, { id: "spam" }] } };
      }
      if (url.includes("/messages/boom")) return { status: 429 };
      const id = url.split("/messages/")[1].split("?")[0];
      const labelIds = id === "draft" ? ["DRAFT"] : id === "spam" ? ["SPAM"] : ["INBOX"];
      return { status: 200, body: { id, labelIds, internalDate: "1795000000000", payload: { headers: [] } } };
    });
    const result = await fetchMessages("Bearer x", "anything", 50);
    expect(result.messages.map(m => m.id)).toEqual(["ok"]);
    expect(result.failedReads).toBe(1);
    expect(result.listFailed).toBe(false);
  });

  it("follows pagination up to the cap and says when more remain", async () => {
    stubGmail((url) => {
      if (url.includes("/messages?")) {
        const page = url.includes("pageToken=p2") ? 2 : 1;
        return {
          status: 200,
          body: { messages: [{ id: `m${page}a` }, { id: `m${page}b` }], nextPageToken: page === 1 ? "p2" : "p3" },
        };
      }
      const id = url.split("/messages/")[1].split("?")[0];
      return { status: 200, body: { id, labelIds: ["INBOX"], internalDate: "1795000000000" } };
    });
    const result = await fetchMessages("Bearer x", "anything", 4);
    expect(result.messages).toHaveLength(4);
    expect(result.truncated).toBe(true);
  });
});
