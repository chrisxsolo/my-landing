import { createHash } from "crypto";

const md5 = (value: string) => createHash("md5").update(value).digest("hex");

export type FingerprintInput = {
  sourceTxnId?: string; // e.g. Gmail message id — strongest identity
  clientEmail?: string;
  clientName?: string;
  amountCents: number;
  paidAt: string; // ISO timestamp or YYYY-MM-DD
  method?: string;
  occurrence?: number; // nth same-looking payment that day (1-based)
};

// Must stay in sync with the SQL backfill in
// supabase/migrations/20260611000010_payments_accuracy.sql:
// md5('payer|cents|YYYY-MM-DD|method|occurrence')
export function paymentFingerprint(input: FingerprintInput): string {
  if (input.sourceTxnId?.trim()) {
    return md5(`txn|${input.sourceTxnId.trim().toLowerCase()}`);
  }
  const payer = (input.clientEmail?.trim() || input.clientName?.trim() || "").toLowerCase();
  const day = input.paidAt.slice(0, 10);
  const method = (input.method ?? "").trim().toLowerCase();
  return md5(`${payer}|${input.amountCents}|${day}|${method}|${input.occurrence ?? 1}`);
}
