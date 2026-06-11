import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { paymentFingerprint } from "@/lib/paymentFingerprint";

const md5 = (value: string) => createHash("md5").update(value).digest("hex");

describe("paymentFingerprint", () => {
  it("prefers the source transaction id over field hashing", () => {
    const fp = paymentFingerprint({
      sourceTxnId: "ABC123",
      clientEmail: "a@b.com",
      amountCents: 100,
      paidAt: "2026-05-01",
    });
    expect(fp).toBe(md5("txn|abc123"));
  });

  it("matches the SQL backfill format for field-based fingerprints", () => {
    const fp = paymentFingerprint({
      clientEmail: "Trang.Hoang764@gmail.com",
      clientName: "Trang Hoang",
      amountCents: 19250,
      paidAt: "2026-05-23T18:04:00.000Z",
      method: "Venmo",
      occurrence: 1,
    });
    expect(fp).toBe(md5("trang.hoang764@gmail.com|19250|2026-05-23|venmo|1"));
  });

  it("distinguishes same-day duplicates by occurrence", () => {
    const base = {
      clientEmail: "a@b.com",
      amountCents: 19250,
      paidAt: "2026-05-23",
      method: "Venmo",
    };
    const first = paymentFingerprint({ ...base, occurrence: 1 });
    const second = paymentFingerprint({ ...base, occurrence: 2 });
    expect(first).not.toBe(second);
  });

  it("falls back to client name when email is missing", () => {
    const fp = paymentFingerprint({
      clientEmail: "",
      clientName: " Jane Doe ",
      amountCents: 5000,
      paidAt: "2026-01-15",
      method: "Zelle",
    });
    expect(fp).toBe(md5("jane doe|5000|2026-01-15|zelle|1"));
  });

  it("is case- and whitespace-insensitive", () => {
    const a = paymentFingerprint({ clientEmail: "A@B.com ", amountCents: 1, paidAt: "2026-01-01", method: " VENMO" });
    const b = paymentFingerprint({ clientEmail: "a@b.com", amountCents: 1, paidAt: "2026-01-01", method: "venmo" });
    expect(a).toBe(b);
  });
});
