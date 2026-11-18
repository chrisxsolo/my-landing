// Pixieset document notifications → attributed timeline evidence.
// Every name, address and number here is synthetic.
import { describe, expect, it } from "vitest";
import { classifyProviderMessage, type ProviderEvent } from "@/lib/providerDocumentEvents";
import { attributeProviderEvents } from "@/lib/providerEventAttribution";
import type { GmailMessage } from "@/lib/gmailSyncHelpers";

const SHARE = "SoloxSnaps <mailer@share.pixiesetmail.com>";
const NOTICE = "Pixieset <no-reply@notifications.pixiesetmail.com>";
const OWNER = "studio@example.com";

function msg(over: { id?: string; from: string; subject: string; snippet?: string; at?: string; labelIds?: string[] }): GmailMessage {
  return {
    id: over.id ?? over.subject,
    internalDate: String(Date.parse(over.at ?? "2026-11-10T18:00:00Z")),
    labelIds: over.labelIds ?? ["INBOX"],
    snippet: over.snippet ?? "",
    payload: { headers: [
      { name: "From", value: over.from },
      { name: "To", value: OWNER },
      { name: "Subject", value: over.subject },
    ] },
  };
}

const invoiceCopy = (first: string, number = "9001", at?: string) => msg({
  id: `inv-${number}`, from: SHARE, subject: `Invoice #${number} from SoloxSnaps`, at,
  snippet: `SoloxSnaps Invoice #${number} $100.00 Due by January 1, 2027 Hi ${first}, Here&#39;s your invoice`,
});
const contractCopy = (full: string, at?: string) => msg({
  id: `con-${full}-${at ?? ""}`, from: SHARE, subject: "Contract from SoloxSnaps", at,
  snippet: `SoloxSnaps Your contract to review and sign ${full} Contract Hi, Your contract is ready for review.`,
});
const completion = (full: string, at?: string, labelIds?: string[]) => msg({
  id: `done-${full}`, from: NOTICE, subject: `${full}'s contract is complete`, at, labelIds,
});
const paymentOnTheWay = (full: string, number = "9001", at?: string) => msg({
  id: `pay-${number}`, from: NOTICE, subject: `Payment on the way for ${full}'s invoice #${number}`, at,
});

describe("classifyProviderMessage", () => {
  it("classifies the owner-addressed invoice and contract copies", () => {
    expect(classifyProviderMessage(invoiceCopy("Alex"))).toMatchObject({
      kind: "invoice_sent", invoiceNumber: "9001", firstName: "Alex",
    });
    expect(classifyProviderMessage(contractCopy("Alex Example"))).toMatchObject({
      kind: "contract_sent", fullName: "Alex Example",
    });
  });

  it("classifies a completion notice, including an archived one", () => {
    expect(classifyProviderMessage(completion("Alex Example", undefined, []))).toMatchObject({
      kind: "contract_signed", fullName: "Alex Example",
    });
  });

  it("classifies payment-on-the-way as pending, never as paid", () => {
    expect(classifyProviderMessage(paymentOnTheWay("Alex Example"))).toMatchObject({
      kind: "payment_pending", fullName: "Alex Example", invoiceNumber: "9001",
    });
  });

  it("rejects spoofed senders, drafts, trash and unrelated mail", () => {
    const spoofed = msg({ from: "Pixieset <no-reply@notifications.pixiesetmail.com.evil.example>", subject: "Alex Example's contract is complete" });
    const displayName = msg({ from: '"mailer@share.pixiesetmail.com" <x@example.com>', subject: "Contract from SoloxSnaps" });
    const client = msg({ from: "Alex <alex@example.com>", subject: "Re: Invoice #9001 from SoloxSnaps" });
    const gallery = msg({ from: SHARE, subject: "Photos of your graduation are ready!" });
    expect([spoofed, displayName, client, gallery].map(classifyProviderMessage)).toEqual([null, null, null, null]);
    expect(classifyProviderMessage(completion("Alex Example", undefined, ["DRAFT"]))).toBeNull();
    expect(classifyProviderMessage(completion("Alex Example", undefined, ["TRASH"]))).toBeNull();
  });

  it("drops a message with no timestamp rather than dating it now", () => {
    const undated = { ...completion("Alex Example"), internalDate: undefined };
    expect(classifyProviderMessage(undated)).toBeNull();
  });
});

const events = (...messages: GmailMessage[]) =>
  messages.map(classifyProviderMessage).filter((e): e is ProviderEvent => e !== null);

const CLIENTS = [
  { email: "alex@example.com", name: "Alex Example" },
  { email: "jordan@example.com", name: "Jordan Sample" },
  { email: OWNER, name: "Studio Owner" },
];

describe("attributeProviderEvents", () => {
  it("attributes contract events by an unambiguous full name", () => {
    const result = attributeProviderEvents(
      events(contractCopy("Alex Example"), completion("alex  EXAMPLE", "2026-11-11T18:00:00Z")),
      CLIENTS, [OWNER],
    );
    expect(result.attributed.map(e => `${e.email}:${e.kind}`)).toEqual([
      "alex@example.com:contract_sent", "alex@example.com:contract_signed",
    ]);
    expect(result).toMatchObject({ ambiguous: 0, unmatched: 0 });
  });

  it("reports a first-name-only invoice as ambiguous without corroboration", () => {
    const result = attributeProviderEvents(events(invoiceCopy("Alex")), CLIENTS, [OWNER]);
    expect(result.attributed).toEqual([]);
    expect(result.ambiguous).toBe(1);
  });

  it("attributes the invoice when the same client's contract went out alongside it", () => {
    const result = attributeProviderEvents(
      events(invoiceCopy("Alex", "9001", "2026-11-10T18:00:05Z"), contractCopy("Alex Example", "2026-11-10T18:00:00Z")),
      CLIENTS, [OWNER],
    );
    expect(result.attributed.map(e => `${e.email}:${e.kind}`).sort()).toEqual([
      "alex@example.com:contract_sent", "alex@example.com:invoice_sent",
    ]);
  });

  it("attributes the invoice through its number when a provider notice names the client", () => {
    const result = attributeProviderEvents(
      events(invoiceCopy("Alex", "9001", "2026-10-01T18:00:00Z"), paymentOnTheWay("Alex Example", "9001", "2026-11-10T18:00:00Z")),
      CLIENTS, [OWNER],
    );
    expect(result.attributed).toEqual([
      { email: "alex@example.com", kind: "invoice_sent", at: "2026-10-01T18:00:00.000Z" },
    ]);
  });

  it("never turns a payment-on-the-way notice into evidence of its own", () => {
    const result = attributeProviderEvents(events(paymentOnTheWay("Alex Example")), CLIENTS, [OWNER]);
    expect(result.attributed).toEqual([]);
  });

  it("keeps the invoice ambiguous whenever two clients share the first name", () => {
    const clients = [...CLIENTS, { email: "alex2@example.com", name: "Alex Other" }];
    // Both contracts on record, or only one of them — timing never decides.
    for (const contracts of [[contractCopy("Alex Example"), contractCopy("Alex Other")], [contractCopy("Alex Example")]]) {
      const result = attributeProviderEvents(events(invoiceCopy("Alex"), ...contracts), clients, [OWNER]);
      expect(result.attributed.filter(e => e.kind === "invoice_sent")).toEqual([]);
      expect(result.ambiguous).toBe(1);
    }
  });

  it("counts a single-name client when deciding whether a first name is unique", () => {
    const clients = [...CLIENTS, { email: "alex3@example.com", name: "Alex" }];
    const result = attributeProviderEvents(events(invoiceCopy("Alex"), contractCopy("Alex Example")), clients, [OWNER]);
    expect(result.attributed.filter(e => e.kind === "invoice_sent")).toEqual([]);
  });

  it("does not let a completion notice stand in for the contract going out", () => {
    const result = attributeProviderEvents(events(invoiceCopy("Alex"), completion("Alex Example")), CLIENTS, [OWNER]);
    expect(result.attributed.filter(e => e.kind === "invoice_sent")).toEqual([]);
  });

  it("reports a full name shared by two clients as ambiguous", () => {
    const clients = [...CLIENTS, { email: "other-alex@example.com", name: "Alex Example" }];
    const result = attributeProviderEvents(events(completion("Alex Example")), clients, [OWNER]);
    expect(result.attributed).toEqual([]);
    expect(result.ambiguous).toBe(1);
  });

  it("reports an unknown name as unmatched and never falls back to a first name", () => {
    const result = attributeProviderEvents(events(completion("Alex Stranger")), CLIENTS, [OWNER]);
    expect(result.attributed).toEqual([]);
    expect(result.unmatched).toBe(1);
  });

  it("never assigns an owner-addressed copy to the photographer", () => {
    const result = attributeProviderEvents(events(completion("Studio Owner")), CLIENTS, [OWNER]);
    expect(result.attributed).toEqual([]);
  });
});
