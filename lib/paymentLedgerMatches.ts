// Server-only: finds the active ledger payments a not-yet-saved payment would
// duplicate. Used by staged-import approval and manual entry so a transfer
// already in the ledger under other evidence is never counted a second time.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CROSS_SOURCE_WINDOW_MS, SAME_PAYER_WINDOW_MS, findLedgerMatches, type MatchablePayment,
} from "@/lib/paymentMatching";

const PAYMENTS_TABLE = "payments";
const LEDGER_MATCH_SELECT = "id,inquiry_id,client_name,client_email,amount_cents,method,paid_at,source,source_txn_id,invoice";

/** A candidate without a ledger id yet; `id` is a negative placeholder so it never matches itself. */
export type NewPayment = Omit<MatchablePayment, "id"> & { id?: number };

export type DuplicateCandidate = {
  index: number;
  client_name: string;
  amount_cents: number;
  paid_at: string;
  matches: MatchablePayment[];
};

/** Active ledger rows with the same amounts, within the matching windows around the candidates' dates. */
export async function loadNearbyLedger(client: SupabaseClient, candidates: readonly NewPayment[]): Promise<MatchablePayment[]> {
  const times = candidates.map(c => new Date(c.paid_at).getTime()).filter(t => !Number.isNaN(t));
  if (!times.length) return [];
  const pad = Math.max(SAME_PAYER_WINDOW_MS, CROSS_SOURCE_WINDOW_MS);
  const { data, error } = await client
    .from(PAYMENTS_TABLE)
    .select(LEDGER_MATCH_SELECT)
    .eq("status", "active")
    .in("amount_cents", [...new Set(candidates.map(c => c.amount_cents))])
    .gte("paid_at", new Date(Math.min(...times) - pad).toISOString())
    .lte("paid_at", new Date(Math.max(...times) + pad).toISOString());
  if (error) throw new Error(`could not read nearby payments: ${error.message}`);
  return (data ?? []) as unknown as MatchablePayment[];
}

/** Pure: which candidates look like a payment already in `ledger`. */
export function findDuplicateCandidates(candidates: readonly NewPayment[], ledger: readonly MatchablePayment[]): DuplicateCandidate[] {
  return candidates.flatMap((c, index) => {
    const matches = findLedgerMatches({ ...c, id: -(index + 1) }, ledger as MatchablePayment[]);
    return matches.length
      ? [{ index, client_name: c.client_name, amount_cents: c.amount_cents, paid_at: c.paid_at, matches }]
      : [];
  });
}
