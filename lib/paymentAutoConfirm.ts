// Server-only: confirms detected payments without a review step.
//
// Owner decision (2026-11-18): a payment the sync can tie to exactly one
// booking is recorded straight away — including an invoicing provider's
// "payment on the way" notice — and is voided in Payments if the money never
// arrives. Anything it cannot tie to one booking, or that looks like a payment
// already recorded, stays in the review queue.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STAGING_SELECT, STAGING_TABLE, approveStagedRows, type ApprovalTally, type StagedRow,
} from "@/lib/paymentApproval";
import { CLOSED_INQUIRY_STATUSES, PAYMENT_SOURCE } from "@/lib/paymentSyncShared";

const INQUIRIES_TABLE = "inquiries";
const PAYMENTS_TABLE = "payments";
const PENDING = "pending";
const PENDING_SCAN_LIMIT = 200;
const INQUIRY_SCAN_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// A detection nobody acted on for this long was left pending on purpose (or
// never arrived); it is not confirmed behind the owner's back.
const MAX_STAGED_AGE_MS = 30 * DAY_MS;
// Sources found by reading one client's own mail: the search is the link, but
// the amount and date are a model's reading, so they get stricter ledger rules.
const CLIENT_MAIL_SOURCES: ReadonlySet<string> = new Set([PAYMENT_SOURCE.clientSweep, PAYMENT_SOURCE.clientCheck]);

export type AttributionInquiry = {
  id: number;
  name: string | null;
  email: string | null;
  status: string | null;
  created_at?: string | null;
  gallery_delivered_at?: string | null;
};

type AttributableRow = Pick<StagedRow, "inquiry_id" | "client_name" | "client_email" | "amount_cents" | "source" | "paid_at">;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

/** Still being booked or shot: not closed, and its gallery has not gone out. */
function isOpenBooking(inquiry: AttributionInquiry): boolean {
  return !CLOSED_INQUIRY_STATUSES.has(inquiry.status ?? "") && !inquiry.gallery_delivered_at;
}

/** A payment dated before the client ever inquired belongs to an earlier booking. */
function predatesInquiry(row: AttributableRow, inquiry: AttributionInquiry): boolean {
  if (!inquiry.created_at) return false;
  return new Date(row.paid_at).getTime() < new Date(inquiry.created_at).getTime() - DAY_MS;
}

/**
 * True when the staged payment belongs to its linked booking beyond
 * reasonable doubt. A provider notification must name the payer by email, or
 * by full name, matching exactly one open booking — the linked one. A first
 * name alone, a name two clients share, a delivered or closed booking, a
 * payment older than the inquiry, or an unknown source is not enough.
 */
export function isStronglyAttributed(row: AttributableRow, inquiries: readonly AttributionInquiry[]): boolean {
  if (row.inquiry_id === null || !(row.amount_cents > 0)) return false;
  const open = inquiries.filter(isOpenBooking);
  const linked = open.find(i => i.id === row.inquiry_id);
  if (!linked || predatesInquiry(row, linked)) return false;
  if (CLIENT_MAIL_SOURCES.has(row.source)) return true;
  if (row.source !== PAYMENT_SOURCE.notification) return false;

  const email = normalizeEmail(row.client_email);
  const byEmail = email.includes("@") ? open.filter(i => normalizeEmail(i.email) === email) : [];
  if (byEmail.length) return byEmail.length === 1 && byEmail[0].id === linked.id;

  const name = normalizeName(row.client_name);
  if (name.split(" ").length < 2) return false;
  const byName = open.filter(i => normalizeName(i.name) === name);
  return byName.length === 1 && byName[0].id === linked.id;
}

type LedgerPayment = { inquiry_id: number | null; client_email: string | null; client_name: string | null; amount_cents: number };

/**
 * Extra rule for payments read out of a client's mail by a model: record one
 * only as the booking's FIRST payment, and only when this client has no
 * payment of that amount on any booking. A re-check that reads a different
 * number, or last year's receipt from a repeat client, goes to review.
 */
export function clientMailRowIsNew(
  row: Pick<StagedRow, "inquiry_id" | "client_name" | "client_email" | "amount_cents" | "source">,
  ledger: readonly LedgerPayment[],
): boolean {
  if (!CLIENT_MAIL_SOURCES.has(row.source)) return true;
  const email = normalizeEmail(row.client_email);
  const name = normalizeName(row.client_name);
  return !ledger.some(p =>
    p.inquiry_id === row.inquiry_id ||
    (p.amount_cents === row.amount_cents &&
      ((!!email && normalizeEmail(p.client_email) === email) || (!!name && normalizeName(p.client_name) === name))));
}

export type AutoConfirmed = { stagingId: number; inquiryId: number; clientName: string; amountCents: number };

export type AutoConfirmOutcome = Pick<ApprovalTally, "incomplete" | "failed" | "portalAmbiguous"> & {
  confirmed: AutoConfirmed[];
};

const NOTHING: AutoConfirmOutcome = { confirmed: [], incomplete: [], failed: [], portalAmbiguous: [] };

async function loadEligibleRows(supabase: SupabaseClient, inquiryId: number | undefined): Promise<StagedRow[]> {
  let pendingQuery = supabase.from(STAGING_TABLE).select(STAGING_SELECT)
    .eq("status", PENDING)
    .not("inquiry_id", "is", null)
    .gte("created_at", new Date(Date.now() - MAX_STAGED_AGE_MS).toISOString());
  if (inquiryId) pendingQuery = pendingQuery.eq("inquiry_id", inquiryId);
  // Newest first, so held rows piling up can never crowd out new detections.
  const { data, error } = await pendingQuery.order("created_at", { ascending: false }).limit(PENDING_SCAN_LIMIT);
  if (error) throw error;
  const pending = (data ?? []) as unknown as StagedRow[];
  if (!pending.length) return [];

  const [inquiries, ledger] = await Promise.all([
    supabase.from(INQUIRIES_TABLE).select("id,name,email,status,created_at,gallery_delivered_at")
      .order("id", { ascending: false }).limit(INQUIRY_SCAN_LIMIT),
    supabase.from(PAYMENTS_TABLE).select("inquiry_id,client_email,client_name,amount_cents")
      .eq("status", "active").in("amount_cents", [...new Set(pending.map(r => r.amount_cents))]),
  ]);
  const bookingLedger = await supabase.from(PAYMENTS_TABLE).select("inquiry_id,client_email,client_name,amount_cents")
    .eq("status", "active").in("inquiry_id", [...new Set(pending.map(r => r.inquiry_id))]);
  if (inquiries.error || ledger.error || bookingLedger.error) throw inquiries.error ?? ledger.error ?? bookingLedger.error;

  const known = [...(ledger.data ?? []), ...(bookingLedger.data ?? [])] as LedgerPayment[];
  return pending
    .filter(row => isStronglyAttributed(row, (inquiries.data ?? []) as AttributionInquiry[]))
    .filter(row => clientMailRowIsNew(row, known))
    // Oldest payment first, so a deposit is applied before a later installment.
    .sort((a, b) => a.paid_at.localeCompare(b.paid_at));
}

/** Confirms every pending staged payment that is safely attributable; `inquiryId` narrows it to one booking. */
export async function autoConfirmStaged(
  supabase: SupabaseClient, scope: { inquiryId?: number } = {},
): Promise<AutoConfirmOutcome> {
  const eligible = await loadEligibleRows(supabase, scope.inquiryId);
  if (!eligible.length) return NOTHING;

  const tally = await approveStagedRows(supabase, eligible);
  const approved = new Set(tally.approvedIds);
  return {
    confirmed: eligible.filter(row => approved.has(row.id)).map(row => ({
      stagingId: row.id, inquiryId: row.inquiry_id as number, clientName: row.client_name, amountCents: row.amount_cents,
    })),
    incomplete: tally.incomplete,
    failed: tally.failed,
    portalAmbiguous: tally.portalAmbiguous,
  };
}

/** Folds a second run's result into the first (Sync All confirms after each pass). */
export function mergeAutoConfirm(a: AutoConfirmOutcome, b: AutoConfirmOutcome): AutoConfirmOutcome {
  return {
    confirmed: [...a.confirmed, ...b.confirmed],
    incomplete: [...a.incomplete, ...b.incomplete],
    failed: [...a.failed, ...b.failed],
    portalAmbiguous: [...a.portalAmbiguous, ...b.portalAmbiguous],
  };
}
