// Decides whether two payment records describe the same money transfer.
//
// The ledger is fed by several imports that carry different evidence for the
// same transfer: the June 2026 "Reconciled ledger import" rows have a name and
// a noon timestamp but no email or transaction id, while Gmail-detected rows
// carry the payer email, a transaction id and an invoice number. Matching on
// `email || name` misses those pairs, so the same deposit was counted twice.
//
// Nothing here voids or merges anything: callers surface matches for review.

export type MatchablePayment = {
  id: number;
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount_cents: number;
  method: string;
  paid_at: string;
  source?: string;
  source_txn_id?: string;
  invoice?: string;
};

const HOUR_MS = 60 * 60 * 1000;
/** Same payer key + amount: legacy rule, chained within 3 days. */
export const SAME_PAYER_WINDOW_MS = 72 * HOUR_MS;
/** Different records of one transfer: date-only imports land at noon, so allow 36h. */
export const CROSS_SOURCE_WINDOW_MS = 36 * HOUR_MS;

const MIN_NAME_TOKEN = 3;

export function payerKey(row: Pick<MatchablePayment, "client_email" | "client_name">): string {
  return (row.client_email || row.client_name).toLowerCase().trim();
}

export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-zÀ-ɏ]+/)
      .filter(token => token.length >= MIN_NAME_TOKEN),
  );
}

function normalizedMethod(method: string): string {
  return (method || "").trim().toLowerCase();
}

function methodsCompatible(a: string, b: string): boolean {
  const ma = normalizedMethod(a);
  const mb = normalizedMethod(b);
  return !ma || !mb || ma === mb;
}

/**
 * Could these two records belong to the same payer? Conflicting hard evidence
 * (two different emails, two different linked inquiries) says no; otherwise a
 * shared name token ("Dee Dee Lopez" / "Delia Lopez") says yes.
 */
export function identitiesCompatible(a: MatchablePayment, b: MatchablePayment): boolean {
  const ea = a.client_email.trim().toLowerCase();
  const eb = b.client_email.trim().toLowerCase();
  if (a.inquiry_id != null && b.inquiry_id != null) {
    if (a.inquiry_id === b.inquiry_id) return true;
    if (!ea || !eb || ea !== eb) return false;
  }
  if (ea && eb) return ea === eb;
  const ta = nameTokens(a.client_name);
  for (const token of nameTokens(b.client_name)) {
    if (ta.has(token)) return true;
  }
  return false;
}

function timeGapMs(a: MatchablePayment, b: MatchablePayment): number {
  const ta = new Date(a.paid_at).getTime();
  const tb = new Date(b.paid_at).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb);
}

function invoicesConflict(a: MatchablePayment, b: MatchablePayment): boolean {
  const ia = (a.invoice ?? "").replace(/\D/g, "");
  const ib = (b.invoice ?? "").replace(/\D/g, "");
  return Boolean(ia && ib && ia !== ib);
}

export function likelySamePayment(a: MatchablePayment, b: MatchablePayment): boolean {
  if (a.id === b.id) return false;
  if (a.amount_cents <= 0 || a.amount_cents !== b.amount_cents) return false;
  if (a.source_txn_id && b.source_txn_id && a.source_txn_id === b.source_txn_id) return true;
  if (invoicesConflict(a, b)) return false;
  const gap = timeGapMs(a, b);
  if (payerKey(a) === payerKey(b)) return gap <= SAME_PAYER_WINDOW_MS;
  return gap <= CROSS_SOURCE_WINDOW_MS
    && methodsCompatible(a.method, b.method)
    && identitiesCompatible(a, b);
}

/** Union-find grouping of rows that pairwise look like the same transfer. */
export function groupLikelyDuplicates<T extends MatchablePayment>(rows: T[]): T[][] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].amount_cents !== rows[j].amount_cents) continue;
      if (likelySamePayment(rows[i], rows[j])) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, T[]>();
  rows.forEach((row, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), row]);
  });
  return [...groups.values()]
    .filter(group => group.length >= 2)
    .map(group => [...group].sort((a, b) => a.paid_at.localeCompare(b.paid_at)));
}

/** Ledger rows a not-yet-approved payment would duplicate if it were approved. */
export function findLedgerMatches<T extends MatchablePayment>(candidate: MatchablePayment, ledger: T[]): T[] {
  return ledger.filter(row => likelySamePayment(candidate, row));
}

function evidenceScore(row: MatchablePayment): number {
  return (row.source_txn_id ? 4 : 0) + (row.client_email ? 2 : 0) + (row.invoice ? 1 : 0);
}

/**
 * In a duplicate group, the row carrying the least transaction evidence is the
 * one to void. Returns null when the rows are equally well evidenced, so the
 * admin decides instead of a guess.
 */
export function suggestDuplicateToVoid(group: MatchablePayment[]): number | null {
  if (group.length < 2) return null;
  const scored = [...group].sort((a, b) => evidenceScore(a) - evidenceScore(b));
  return evidenceScore(scored[0]) < evidenceScore(scored[1]) ? scored[0].id : null;
}
