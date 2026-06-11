// Deterministic data-quality rules for the ledger. Every rule explains why a
// row was flagged and which rows are involved; nothing is ever auto-deleted
// or auto-merged — review actions live in the UI.

import { findDuplicateSuspects } from "@/lib/paymentFilters";
import type { LedgerRow } from "./enrich";

export type IssueSeverity = "high" | "medium" | "low";

export type QualityIssue = {
  id: string;
  rule: string;
  severity: IssueSeverity;
  title: string;
  reason: string;
  paymentIds: number[];
  /** Rows already marked reconciled are review-dismissed and stay hidden. */
  dismissible: boolean;
};

const PERSONAL_TRANSFER_RE = /\b(rent|personal|loan|reimburse|venmo me back|not (a )?session|family transfer)\b/i;
const BACKFILL_GAP_DAYS = 45;

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(db - da) / 86400000;
}

export function findQualityIssues(rows: LedgerRow[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const active = rows.filter(r => r.status === "active");

  // 1. Possible duplicates: same payer + amount within 3 days (shared rule).
  for (const group of findDuplicateSuspects(rows)) {
    issues.push({
      id: `dup-${group.map(p => p.id).join("-")}`,
      rule: "duplicate",
      severity: "high",
      title: `Possible duplicate — ${group[0].client_name}`,
      reason: `${group.length} active payments with the same payer and amount within 3 days of each other. Legitimate split deposits should be dismissed with “keep both”.`,
      paymentIds: group.map(p => p.id),
      dismissible: true,
    });
  }

  for (const p of active) {
    if (p.amount_cents <= 0) {
      issues.push({
        id: `amount-${p.id}`,
        rule: "nonPositiveAmount",
        severity: "high",
        title: `Zero or negative amount — ${p.client_name}`,
        reason: `Active ledger row has amount_cents = ${p.amount_cents}. Revenue rows must be positive; refunds belong on status=refunded.`,
        paymentIds: [p.id],
        dismissible: false,
      });
    }
    if (!p.paid_at && !p.session_date) {
      issues.push({
        id: `nodate-${p.id}`,
        rule: "missingDate",
        severity: "high",
        title: `No payment date — ${p.client_name}`,
        reason: "Row has neither paid_at nor session_date, so it can't be placed in any period and is excluded from time-based charts.",
        paymentIds: [p.id],
        dismissible: false,
      });
    }
    if (!p.method) {
      issues.push({
        id: `nomethod-${p.id}`,
        rule: "missingMethod",
        severity: "low",
        title: `Missing payment platform — ${p.client_name}`,
        reason: "No payment method recorded; platform-mix analytics count this row as “Other”.",
        paymentIds: [p.id],
        dismissible: true,
      });
    }
    if (PERSONAL_TRANSFER_RE.test(p.note ?? "")) {
      issues.push({
        id: `personal-${p.id}`,
        rule: "personalTransfer",
        severity: "high",
        title: `Possible personal transfer — ${p.client_name}`,
        reason: `Note mentions “${(p.note.match(PERSONAL_TRANSFER_RE) ?? [""])[0]}”. Non-business transfers must be voided so they never count as revenue.`,
        paymentIds: [p.id],
        dismissible: true,
      });
    }
    const gap = daysBetween(p.paid_at, p.imported_at);
    if (gap !== null && gap > BACKFILL_GAP_DAYS && p.reconciliation_status === "unreviewed") {
      issues.push({
        id: `backfill-${p.id}`,
        rule: "backfilledImport",
        severity: "low",
        title: `Backfilled import — ${p.client_name}`,
        reason: `Imported ${Math.round(gap)} days after the payment date and never reviewed. Verify the paid date is the real transfer date.`,
        paymentIds: [p.id],
        dismissible: true,
      });
    }
  }

  // 2. Unlinked payments grouped into a single issue per payer.
  const unlinkedByPayer = new Map<string, LedgerRow[]>();
  for (const p of active) {
    if (p.inquiry_id != null) continue;
    const key = (p.client_email || p.client_name).toLowerCase().trim();
    const list = unlinkedByPayer.get(key);
    if (list) list.push(p);
    else unlinkedByPayer.set(key, [p]);
  }
  for (const [, group] of unlinkedByPayer) {
    issues.push({
      id: `unlinked-${group.map(p => p.id).join("-")}`,
      rule: "unlinkedClient",
      severity: "medium",
      title: `No linked inquiry — ${group[0].client_name}`,
      reason: `${group.length} payment${group.length === 1 ? "" : "s"} not linked to any inquiry: service, school and receivables analytics can't see ${group.length === 1 ? "it" : "them"}.`,
      paymentIds: group.map(p => p.id),
      dismissible: false,
    });
  }

  // 3. Balance payment without a retainer on record for the same payer.
  const payerTypes = new Map<string, Set<string>>();
  for (const p of active) {
    const key = (p.client_email || p.client_name).toLowerCase().trim();
    const set = payerTypes.get(key) ?? new Set<string>();
    set.add(p.payment_type);
    payerTypes.set(key, set);
  }
  for (const p of active) {
    if (p.payment_type !== "deposit_2") continue;
    const key = (p.client_email || p.client_name).toLowerCase().trim();
    if (!payerTypes.get(key)?.has("deposit_1")) {
      issues.push({
        id: `orphanbalance-${p.id}`,
        rule: "balanceWithoutRetainer",
        severity: "medium",
        title: `Balance without retainer — ${p.client_name}`,
        reason: "A final/balance payment exists but no retainer (deposit 1) is on record for this payer. The retainer may be missing from the ledger.",
        paymentIds: [p.id],
        dismissible: true,
      });
    }
  }

  const order: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export type QualityCounts = { high: number; medium: number; low: number };

export function countBySeverity(issues: QualityIssue[]): QualityCounts {
  return issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: acc[i.severity] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
}
