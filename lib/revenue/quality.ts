// Deterministic data-quality rules for the ledger. Every rule explains why a
// row was flagged and which rows are involved; nothing is ever auto-deleted
// or auto-merged — review actions live in the UI.

import type { AdminInquiry } from "@/lib/adminInquiries";
import { findDuplicateSuspects } from "@/lib/paymentFilters";
import { suggestDuplicateToVoid } from "@/lib/paymentMatching";
import type { LedgerRow } from "./enrich";
import { findPaidInquiriesWithoutLedger, namesAgree, suggestInquiryLinks, type LinkAction } from "./linking";

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
  /** Duplicate groups: the row with the least transaction evidence, if one stands out. */
  suggestedVoidId?: number | null;
  /** Confirm-to-apply links between payments and an inquiry. */
  linkActions?: LinkAction[];
  /** Inquiry-level findings (no ledger row to point at). */
  inquiryId?: number;
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

export function findQualityIssues(rows: LedgerRow[], inquiries: AdminInquiry[] = []): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const active = rows.filter(r => r.status === "active");

  // 1. Possible duplicates: same payer + amount within 3 days (shared rule).
  for (const group of findDuplicateSuspects(rows)) {
    const suggestedVoidId = suggestDuplicateToVoid(group);
    const names = [...new Set(group.map(p => p.client_name))].join(" / ");
    issues.push({
      id: `dup-${group.map(p => p.id).join("-")}`,
      rule: "duplicate",
      severity: "high",
      title: `Possible duplicate — ${names}`,
      reason: `${group.length} active payments for the same amount on the same platform within days of each other, from a compatible payer — likely one transfer recorded by two imports, counted twice.`
        + (suggestedVoidId ? ` #${suggestedVoidId} carries the least transaction evidence (no transaction id / email).` : "")
        + " Legitimate split deposits should be dismissed with “keep both”.",
      paymentIds: group.map(p => p.id),
      dismissible: true,
      suggestedVoidId,
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
  for (const group of groupUnlinkedByPayer(active)) {
    const linkActions = suggestInquiryLinks(group, inquiries);
    issues.push({
      id: `unlinked-${group.map(p => p.id).join("-")}`,
      rule: "unlinkedClient",
      severity: "medium",
      title: `No linked inquiry — ${group[0].client_name}`,
      reason: `${group.length} payment${group.length === 1 ? "" : "s"} not linked to any inquiry: service, school and receivables analytics can't see ${group.length === 1 ? "it" : "them"}.`,
      paymentIds: group.map(p => p.id),
      dismissible: false,
      linkActions,
    });
  }

  issues.push(...paidWithoutLedgerIssues(rows, inquiries));

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

// One group per payer. Rows with an email group by email; a row with no email
// joins the first group whose payer name agrees with it (an import that
// dropped the email must not look like a second client).
function groupUnlinkedByPayer(active: LedgerRow[]): LedgerRow[][] {
  const groups: { key: string; name: string; rows: LedgerRow[] }[] = [];
  const unlinked = active.filter(p => p.inquiry_id == null);
  for (const p of [...unlinked].sort((a, b) => (b.client_email ? 1 : 0) - (a.client_email ? 1 : 0))) {
    const email = p.client_email.toLowerCase().trim();
    const match = email
      ? groups.find(g => g.key === email)
      : groups.find(g => namesAgree(g.name, p.client_name));
    if (match) match.rows.push(p);
    else groups.push({ key: email || p.client_name.toLowerCase().trim(), name: p.client_name, rows: [p] });
  }
  return groups.map(g => g.rows);
}

function paidWithoutLedgerIssues(rows: LedgerRow[], inquiries: AdminInquiry[]): QualityIssue[] {
  return findPaidInquiriesWithoutLedger(inquiries, rows).map(({ inquiry, candidates }) => {
    const unlinked = candidates.filter(c => c.inquiry_id == null);
    const elsewhere = [...new Set(candidates.filter(c => c.inquiry_id != null).map(c => c.inquiry_id))];
    const hint = unlinked.length
      ? ` ${unlinked.length} unlinked payment${unlinked.length === 1 ? "" : "s"} from this client can be linked below.`
      : elsewhere.length
        ? ` This client's payments are linked to inquiry ${elsewhere.map(id => `#${id}`).join(", ")} — this inquiry may be a duplicate.`
        : " No matching ledger payment exists: approve it from the review queue, record it as a manual payment, or correct the inquiry's payment status.";
    return {
      id: `paidnoledger-${inquiry.id}`,
      rule: "paidInquiryWithoutLedger",
      severity: "high" as const,
      title: `Marked paid, not in revenue — ${inquiry.name}`,
      reason: `Inquiry #${inquiry.id} (${inquiry.session_type ?? "session"}) is marked paid${inquiry.payment_note ? ` (“${inquiry.payment_note.slice(0, 80)}”)` : ""} but no active ledger payment is linked to it, so revenue does not include it.${hint}`,
      paymentIds: candidates.map(c => c.id),
      dismissible: false,
      inquiryId: inquiry.id,
      linkActions: unlinked.length
        ? [{
          inquiryId: inquiry.id,
          paymentIds: unlinked.map(c => c.id),
          evidence: unlinked.some(c => c.client_email.trim().toLowerCase() === inquiry.email.trim().toLowerCase())
            ? "email" as const : "name" as const,
          label: `#${inquiry.id} ${inquiry.name}`,
        }]
        : [],
    };
  });
}

export type QualityCounts = { high: number; medium: number; low: number };

export function countBySeverity(issues: QualityIssue[]): QualityCounts {
  return issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: acc[i.severity] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
}
