// ─────────────────────────────────────────────────────────────────────────────
// Pure planning for the timeline sync: given what Gmail proved, which fields
// change on which inquiry and portal session. No I/O.
//
// Invariants:
//   • A stamp is only ever filled in, never replaced or cleared.
//   • Portal stages only move forward.
//   • Sent, signed and paid are separate facts. A sent invoice or a signed
//     contract never marks anything paid or booked.
// ─────────────────────────────────────────────────────────────────────────────

import { findMatchingClientSession } from "@/lib/clientSessions";
import { computeAdvancedStatus } from "@/lib/emailTimelineScan";
import { INQUIRY_STATUS } from "@/lib/inquiryReconcile";
import type { WindowEvidence } from "@/lib/timelineSync/evidence";

const DELIVERY_DAYS_AFTER_SESSION = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncInquiry = {
  id: number;
  email: string;
  name: string | null;
  status: string | null;
  created_at: string;
  last_message_at: string | null;
  session_type: string | null;
  session_date: string | null;
  date_in_mind: string | null;
  preferred_time: string | null;
  location: string | null;
  reply_sent_at: string | null;
  invoice_sent_at: string | null;
  contract_sent_at: string | null;
  deposit_paid_at: string | null;
  gallery_delivered_at: string | null;
  booking_confirmed: boolean | null;
};

export type SyncSession = {
  id: string;
  client_email: string;
  client_name: string | null;
  session_type: string | null;
  session_date: string | null;
  invoice_status: string | null;
  contract_status: string | null;
  current_status: string;
  estimated_delivery_date: string | null;
};

export type AgreedSession = { sessionDate: string | null; sessionTime: string | null };
export type InquiryStamps = Record<string, string | boolean>;

/** Fields to fill on an inquiry. Empty when the inquiry is already current. */
export function planInquiryStamps(
  inquiry: SyncInquiry,
  evidence: WindowEvidence,
  agreed: AgreedSession | null,
): InquiryStamps {
  const stamps: InquiryStamps = {};
  if (evidence.reply && !inquiry.reply_sent_at) stamps.reply_sent_at = evidence.reply;
  if (evidence.invoiceSent && !inquiry.invoice_sent_at) stamps.invoice_sent_at = evidence.invoiceSent;
  if (evidence.contractSent && !inquiry.contract_sent_at) stamps.contract_sent_at = evidence.contractSent;
  if (evidence.galleryDelivered && !inquiry.gallery_delivered_at) {
    stamps.gallery_delivered_at = evidence.galleryDelivered;
  }
  if (evidence.depositPaid) {
    if (!inquiry.deposit_paid_at) stamps.deposit_paid_at = evidence.depositPaid;
    if (inquiry.booking_confirmed !== true) stamps.booking_confirmed = true;
  }
  if (agreed?.sessionTime && !inquiry.preferred_time) stamps.preferred_time = agreed.sessionTime;
  if (agreed?.sessionDate && !inquiry.session_date) stamps.session_date = agreed.sessionDate;
  return stamps;
}

export type SessionPlan = { updates: Record<string, string>; parts: string[] };

function planDocumentStatuses(session: SyncSession, evidence: WindowEvidence): SessionPlan {
  const updates: Record<string, string> = {};
  const parts: string[] = [];
  if (evidence.depositPaid && session.invoice_status !== "paid") {
    updates.invoice_status = "paid";
    parts.push("invoice → paid");
  } else if (evidence.invoiceSent && !session.invoice_status) {
    updates.invoice_status = "sent";
    parts.push("invoice → sent");
  }
  if (evidence.contractSigned && session.contract_status !== "signed") {
    updates.contract_status = "signed";
    parts.push("contract → signed");
  } else if (evidence.contractSent && !session.contract_status) {
    updates.contract_status = "sent";
    parts.push("contract → sent");
  }
  return { updates, parts };
}

function estimatedDelivery(sessionDate: string): string | null {
  const shoot = new Date(sessionDate);
  if (Number.isNaN(shoot.getTime())) return null;
  return new Date(shoot.getTime() + DELIVERY_DAYS_AFTER_SESSION * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Updates for one portal session. `evidence` is null when the session could
 * not be tied to a single booking — then only the delivery date is filled.
 * Milestones already stamped on the paired inquiry count as evidence too, so a
 * stage set by an earlier sync or by hand still advances the portal.
 */
export function planSessionUpdates(
  session: SyncSession,
  evidence: WindowEvidence | null,
  inquiry: SyncInquiry | null,
  today: string,
): SessionPlan {
  const plan: SessionPlan = evidence ? planDocumentStatuses(session, evidence) : { updates: {}, parts: [] };

  if (evidence) {
    const nextStatus = computeAdvancedStatus(session.current_status, {
      replySent: !!evidence.reply || !!inquiry?.reply_sent_at,
      invoiceSent: !!evidence.invoiceSent || !!inquiry?.invoice_sent_at,
      contractSent: !!evidence.contractSent || !!inquiry?.contract_sent_at,
      depositPaid: !!evidence.depositPaid || !!inquiry?.deposit_paid_at,
      contractSigned: !!evidence.contractSigned,
      sessionDatePast: !!session.session_date && session.session_date < today,
      galleryDelivered: !!evidence.galleryDelivered || !!inquiry?.gallery_delivered_at,
    });
    if (nextStatus) {
      plan.updates.current_status = nextStatus;
      plan.parts.push(`stage → ${nextStatus.replace(/_/g, " ")}`);
    }
  }

  if (session.session_date && !session.estimated_delivery_date) {
    const delivery = estimatedDelivery(session.session_date);
    if (delivery) {
      plan.updates.estimated_delivery_date = delivery;
      plan.parts.push("delivery date set");
    }
  }
  return plan;
}

const byNewest = (a: SyncInquiry, b: SyncInquiry) => Date.parse(b.created_at) - Date.parse(a.created_at);

/**
 * Ties each portal session to one inquiry. A client with a single session
 * pairs with their newest inquiry; a client with several sessions pairs only
 * where session type and date match exactly — the rest are ambiguous and get
 * no evidence, rather than every booking sharing one client's milestones.
 */
export function pairSessionsWithInquiries(sessions: SyncSession[], inquiries: SyncInquiry[]) {
  // Session id → the inquiry whose evidence it may use (null: no inquiry on file).
  const inquiryBySession = new Map<string, SyncInquiry | null>();
  // Sessions sharing an address with others and matching no inquiry by type + date.
  const ambiguousSessionIds: string[] = [];
  const emails = new Set(sessions.map(s => s.client_email.toLowerCase()));

  for (const email of emails) {
    const clientSessions = sessions.filter(s => s.client_email.toLowerCase() === email);
    const clientInquiries = inquiries.filter(i => i.email.toLowerCase() === email).sort(byNewest);
    if (clientSessions.length === 1) {
      inquiryBySession.set(clientSessions[0].id, clientInquiries[0] ?? null);
      continue;
    }
    for (const inquiry of clientInquiries) {
      const match = findMatchingClientSession(clientSessions, {
        clientEmail: email,
        sessionType: inquiry.session_type,
        sessionDate: inquiry.session_date ?? inquiry.date_in_mind,
      });
      if (match && !inquiryBySession.has(match.id)) inquiryBySession.set(match.id, inquiry);
    }
    ambiguousSessionIds.push(...clientSessions.filter(s => !inquiryBySession.has(s.id)).map(s => s.id));
  }
  return { inquiryBySession, ambiguousSessionIds };
}

const CLOSED_STATUSES = new Set<string>([INQUIRY_STATUS.ARCHIVED, INQUIRY_STATUS.NOT_INTERESTED]);
const SCAN_ACTIVE_WINDOW_MS = 120 * DAY_MS;

function isTimelineIncomplete(inquiry: SyncInquiry): boolean {
  return !inquiry.reply_sent_at || !inquiry.invoice_sent_at || !inquiry.contract_sent_at ||
    !inquiry.deposit_paid_at || !inquiry.gallery_delivered_at;
}

const lastActivityMs = (inquiry: SyncInquiry) =>
  Math.max(Date.parse(inquiry.last_message_at ?? "") || 0, Date.parse(inquiry.created_at) || 0);

/**
 * Which clients the (slow, bounded) thread scan reads this run: live inquiries
 * with an unfinished timeline and recent activity, most recently active first.
 * Returns how many eligible clients did not fit so the run can say so.
 */
export function selectScanTargets(inquiries: SyncInquiry[], nowMs: number, limit: number) {
  const floor = nowMs - SCAN_ACTIVE_WINDOW_MS;
  const eligible = inquiries
    .filter(i => isTimelineIncomplete(i) && !CLOSED_STATUSES.has(i.status ?? ""))
    .filter(i => lastActivityMs(i) >= floor)
    .sort((a, b) => lastActivityMs(b) - lastActivityMs(a));

  const byEmail = new Map<string, { email: string; name: string | null }>();
  for (const inquiry of eligible) {
    const email = inquiry.email.toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, { email, name: inquiry.name });
  }
  const all = [...byEmail.values()];
  return { targets: all.slice(0, limit), overLimit: Math.max(0, all.length - limit) };
}
