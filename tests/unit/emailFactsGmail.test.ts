import { describe, expect, it } from "vitest";
import { toConversationMessage } from "@/lib/contentEngine/emailFacts/gmailThreads";
import { knownFactsFor, todayInSessionTimezone } from "@/lib/contentEngine/emailFacts/run";

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64url");

const gmailMessage = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  threadId: "t1",
  internalDate: String(Date.UTC(2026, 9, 8, 17, 0, 0)),
  labelIds: ["INBOX"],
  payload: {
    mimeType: "text/plain",
    body: { data: b64("Palace of Fine Arts works perfectly!") },
    headers: [
      { name: "From", value: "Chris <chris@soloxsnaps.com>" },
      { name: "Subject", value: "Couples photos" },
    ],
  },
  ...over,
});

const CONNECTED = ["chris@soloxsnaps.com"];

describe("toConversationMessage", () => {
  it("reads the photographer's own message as outbound", () => {
    const message = toConversationMessage(gmailMessage(), "dana@example.com", CONNECTED);
    expect(message).toMatchObject({
      gmailMessageId: "m1", threadId: "t1", direction: "photographer",
      subject: "Couples photos", body: "Palace of Fine Arts works perfectly!",
      at: "2026-10-08T17:00:00.000Z",
    });
  });

  it("reads the client's message as inbound", () => {
    const message = toConversationMessage(
      gmailMessage({
        payload: {
          mimeType: "text/plain",
          body: { data: b64("Let's confirm October 25th at 5:30 pm.") },
          headers: [{ name: "From", value: "Dana <dana@example.com>" }],
        },
      }),
      "dana@example.com", CONNECTED,
    );
    expect(message?.direction).toBe("client");
  });

  it("ignores a third party in the thread", () => {
    // A payment or e-sign notification is not either side of the conversation
    // and must never be read as the client's word.
    const message = toConversationMessage(
      gmailMessage({
        payload: {
          mimeType: "text/plain",
          body: { data: b64("Dana paid you $200") },
          headers: [{ name: "From", value: "venmo@venmo.com" }],
        },
      }),
      "dana@example.com", CONNECTED,
    );
    expect(message).toBeNull();
  });

  it("ignores drafts, binned and junked mail", () => {
    for (const label of ["DRAFT", "TRASH", "SPAM"]) {
      expect(toConversationMessage(gmailMessage({ labelIds: [label] }), "dana@example.com", CONNECTED))
        .toBeNull();
    }
  });

  it("strips the quoted reply out of the body", () => {
    const message = toConversationMessage(
      gmailMessage({
        payload: {
          mimeType: "text/plain",
          body: {
            data: b64("Sounds good!\n\nOn Mon, Oct 5, 2026 at 9:00 AM Dana <dana@example.com> wrote:\n> Baker Beach?"),
          },
          headers: [{ name: "From", value: "chris@soloxsnaps.com" }],
        },
      }),
      "dana@example.com", CONNECTED,
    );
    expect(message?.body).toBe("Sounds good!");
  });

  it("skips a message with no readable text and no timestamp", () => {
    expect(toConversationMessage(gmailMessage({ internalDate: undefined }), "dana@example.com", CONNECTED))
      .toBeNull();
    expect(toConversationMessage(
      gmailMessage({ payload: { headers: [{ name: "From", value: "chris@soloxsnaps.com" }] } }),
      "dana@example.com", CONNECTED,
    )).toBeNull();
  });
});

describe("knownFactsFor", () => {
  it("passes public facts to the prompt and keeps the private ones out", () => {
    const known = knownFactsFor({
      primary_location: "Palace of Fine Arts",
      secondary_locations: ["Lovers Lane", "Baker Beach"],
      session_date: "2026-10-25",
      internal_client_name: "Dana Whitfield",
      internal_notes: "Paid deposit in cash; prefers morning calls.",
      vibe: "",
    });
    expect(known).toEqual({
      primary_location: "Palace of Fine Arts",
      secondary_locations: "Lovers Lane, Baker Beach",
      session_date: "2026-10-25",
    });
    expect(known).not.toHaveProperty("internal_notes");
    expect(known).not.toHaveProperty("internal_client_name");
  });
});

describe("todayInSessionTimezone", () => {
  it("uses the Bay Area date, not UTC", () => {
    // 2026-10-26T05:30:00Z is still the 25th in California.
    expect(todayInSessionTimezone(new Date("2026-10-26T05:30:00.000Z"))).toBe("2026-10-25");
  });
});
