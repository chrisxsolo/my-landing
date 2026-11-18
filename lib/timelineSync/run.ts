// ─────────────────────────────────────────────────────────────────────────────
// Timeline sync orchestration: discover evidence in Gmail, plan the changes it
// supports, apply them with checked writes, and report honestly what happened.
//
// Bounded work: the AI thread scan stops starting new
// clients once its budget is spent, and reply-status reconciliation is skipped
// (and reported) when too little time is left.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_TABLE, todayInClientSessionTimeZone } from "@/lib/clientSessions";
import { getConnectedAccountEmails, reconcileInquiriesWithGmail } from "@/lib/inquiryReconcileGmail";
import type { KnownClient } from "@/lib/providerEventAttribution";
import { applyInquiryPlan, applySessionPlans, INQUIRIES_TABLE, type PlannedInquiry } from "@/lib/timelineSync/apply";
import {
  collectPayments,
  collectProviderDocuments,
  collectSentDocuments,
  collectSentReplies,
  collectSignedNotices,
  collectThreadMilestones,
  type ClientDirectory,
} from "@/lib/timelineSync/collect";
import {
  createEvidenceBook,
  evidenceInWindow,
  inquiryWindows,
  OPEN_WINDOW,
  type EvidenceBook,
} from "@/lib/timelineSync/evidence";
import {
  DAY_MS,
  pairSessionsWithInquiries,
  planInquiryStamps,
  planSessionUpdates,
  selectScanTargets,
  type AgreedSession,
  type SyncInquiry,
  type SyncSession,
} from "@/lib/timelineSync/plan";
import {
  buildSyncMessage,
  deriveSyncStatus,
  emptySyncReport,
  withStageOutcomes,
  type TimelineSyncReport,
} from "@/lib/timelineSync/report";

const SESSION_COLUMNS =
  "id, client_email, client_name, session_type, session_date, invoice_status, contract_status, current_status, estimated_delivery_date";
const INQUIRY_COLUMNS =
  "id, email, name, status, created_at, last_message_at, session_type, session_date, date_in_mind, preferred_time, " +
  "location, reply_sent_at, invoice_sent_at, contract_sent_at, deposit_paid_at, gallery_delivered_at, booking_confirmed";

const AI_SCAN_CLIENT_LIMIT = 16;
const KNOWN_CLIENT_LOOKBACK_MS = 365 * DAY_MS;
/** Unattributable notices older than this are no longer worth flagging. */
const REVIEW_WINDOW_MS = 45 * DAY_MS;
const SCAN_BUDGET_MS = 34_000;
const RECONCILE_CUTOFF_MS = 44_000;

export type TimelineSyncResult = { report: TimelineSyncReport; message: string };

export class TimelineSyncLoadError extends Error {}

async function loadRows(supabase: SupabaseClient) {
  const [sessions, inquiries] = await Promise.all([
    supabase.from(CLIENT_SESSION_TABLE).select(SESSION_COLUMNS).returns<SyncSession[]>(),
    supabase.from(INQUIRIES_TABLE).select(INQUIRY_COLUMNS).order("created_at", { ascending: false }).returns<SyncInquiry[]>(),
  ]);
  if (sessions.error || inquiries.error) {
    console.error("[timeline-sync] load failed", {
      sessions: sessions.error?.message, inquiries: inquiries.error?.message,
    });
    throw new TimelineSyncLoadError("Failed to load clients for the timeline sync");
  }
  return { sessions: sessions.data ?? [], inquiries: inquiries.data ?? [] };
}

/**
 * Who a notice may be matched to. The photographer's own addresses are left
 * out everywhere: a test inquiry under the studio address must never soak up
 * mail that is merely addressed to the studio.
 */
function buildDirectory(sessions: SyncSession[], inquiries: SyncInquiry[], ownerEmails: string[], nowMs: number) {
  const owners = new Set(ownerEmails.map(e => e.toLowerCase()));
  const isClient = (email: string) => !owners.has(email.toLowerCase());
  const clientSessions = sessions.filter(s => isClient(s.client_email));
  const recent = inquiries
    .filter(i => isClient(i.email))
    .filter(i => Date.parse(i.created_at) >= nowMs - KNOWN_CLIENT_LOOKBACK_MS);
  const sessionClientNames = new Map(clientSessions.map(s => [s.client_email.toLowerCase(), s.client_name ?? ""]));
  const knownClients: KnownClient[] = [
    ...clientSessions.map(s => ({ email: s.client_email, name: s.client_name })),
    ...recent.map(i => ({ email: i.email, name: i.name })),
  ];
  const allClientNames = new Map(recent.map(i => [i.email.toLowerCase(), i.name ?? ""]));
  for (const [email, name] of sessionClientNames) if (name) allClientNames.set(email, name);
  const directory: ClientDirectory = {
    emails: new Set(knownClients.map(c => c.email.toLowerCase())),
    sessionClientNames,
    allClientNames,
  };
  return { directory, knownClients };
}

async function discover(
  auth: string,
  book: EvidenceBook,
  directory: ClientDirectory,
  knownClients: KnownClient[],
  ownerEmails: string[],
  reviewSince: string,
) {
  // Sequential on purpose: these are full-mailbox searches against one quota.
  const sentDocuments = await collectSentDocuments(auth, book);
  const sentReplies = await collectSentReplies(auth, book);
  const payments = await collectPayments(auth, book, directory);
  const signed = await collectSignedNotices(auth, book, directory);
  const provider = await collectProviderDocuments(auth, book, knownClients, ownerEmails, reviewSince);
  // Mail the studio sent to itself is not client activity.
  for (const owner of ownerEmails) book.delete(owner.toLowerCase());
  return { stages: [sentDocuments, sentReplies, payments, signed, provider], provider };
}

function planSessions(sessions: SyncSession[], inquiries: SyncInquiry[], book: EvidenceBook, today: string) {
  const pairing = pairSessionsWithInquiries(sessions, inquiries);
  const ambiguous = new Set(pairing.ambiguousSessionIds);
  let skippedChanges = 0;
  const planned = sessions.map(session => {
    const email = session.client_email.toLowerCase();
    if (ambiguous.has(session.id)) {
      // Count it only when there was something to apply — otherwise it is noise.
      const wouldChange = planSessionUpdates({ ...session, estimated_delivery_date: "set" },
        evidenceInWindow(book, email, OPEN_WINDOW), null, today);
      if (Object.keys(wouldChange.updates).length) skippedChanges++;
      return { session, plan: planSessionUpdates(session, null, null, today) };
    }
    const inquiry = pairing.inquiryBySession.get(session.id) ?? null;
    const window = inquiry
      ? inquiryWindows(inquiries.filter(i => i.email.toLowerCase() === email)).get(inquiry.id) ?? OPEN_WINDOW
      : OPEN_WINDOW;
    return { session, plan: planSessionUpdates(session, evidenceInWindow(book, email, window), inquiry, today) };
  });
  return { planned, skippedChanges };
}

function planInquiries(
  sessions: SyncSession[],
  inquiries: SyncInquiry[],
  book: EvidenceBook,
  agreed: Map<string, AgreedSession>,
  reviewSince: string,
) {
  const planned: PlannedInquiry[] = [];
  let signedWithoutSession = 0;
  const emails = new Set(inquiries.map(i => i.email.toLowerCase()));
  for (const email of emails) {
    const clientInquiries = inquiries.filter(i => i.email.toLowerCase() === email);
    const clientSessions = sessions.filter(s => s.client_email.toLowerCase() === email);
    const windows = inquiryWindows(clientInquiries);
    const newestId = clientInquiries[0].id; // loaded newest first
    for (const inquiry of clientInquiries) {
      const evidence = evidenceInWindow(book, email, windows.get(inquiry.id) ?? OPEN_WINDOW);
      // The thread scan reads the latest conversation, so an agreed date
      // belongs to the client's newest inquiry only.
      const stamps = planInquiryStamps(inquiry, evidence, inquiry.id === newestId ? agreed.get(email) ?? null : null);
      if (evidence.contractSigned && evidence.contractSigned >= reviewSince && !clientSessions.length) {
        signedWithoutSession++;
      }
      planned.push({
        inquiry, stamps, clientSessions,
        activeThisRun: book.has(email),
        depositEvidence: !!evidence.depositPaid || !!inquiry.deposit_paid_at,
        galleryEvidence: !!evidence.galleryDelivered || !!inquiry.gallery_delivered_at,
      });
    }
  }
  return { planned, signedWithoutSession };
}

async function reconcileReplies(supabase: SupabaseClient, auth: string, ownerEmails: string[], startedAt: number) {
  if (Date.now() - startedAt > RECONCILE_CUTOFF_MS) return { updated: 0, failed: false, skipped: true };
  try {
    const summary = await reconcileInquiriesWithGmail(supabase, auth, ownerEmails);
    return { updated: summary.updated, failed: summary.failed > 0, skipped: false };
  } catch (error) {
    console.error("[timeline-sync] inquiry reconciliation failed:", error instanceof Error ? error.message : "unknown error");
    return { updated: 0, failed: true, skipped: false };
  }
}

async function applyPlans(
  supabase: SupabaseClient,
  sessionPlans: ReturnType<typeof planSessions>,
  inquiryPlans: ReturnType<typeof planInquiries>,
) {
  const sessionWrites = await applySessionPlans(supabase, sessionPlans.planned);
  let inquiries = 0;
  let sessionsCreated = 0;
  let failedWrites = sessionWrites.failed;
  for (const planned of inquiryPlans.planned) {
    const result = await applyInquiryPlan(supabase, planned);
    if (result.stamped) inquiries++;
    if (result.sessionCreated) sessionsCreated++;
    failedWrites += result.failed;
  }
  return { inquiries, sessions: sessionWrites.applied, sessionsCreated, failedWrites };
}

export async function runTimelineSync(
  supabase: SupabaseClient,
  auth: string,
  accountEmail: string | null | undefined,
): Promise<TimelineSyncResult> {
  const startedAt = Date.now();
  const { sessions, inquiries } = await loadRows(supabase);
  const ownerEmails = await getConnectedAccountEmails(auth, accountEmail);
  const { directory, knownClients } = buildDirectory(sessions, inquiries, ownerEmails, startedAt);
  const reviewSince = new Date(startedAt - REVIEW_WINDOW_MS).toISOString();

  const book = createEvidenceBook();
  const { stages, provider } = await discover(auth, book, directory, knownClients, ownerEmails, reviewSince);
  let report = withStageOutcomes(emptySyncReport(), stages);
  if (deriveSyncStatus(report) === "failed") {
    report = { ...report, status: "failed" };
    return { report, message: buildSyncMessage(report) };
  }

  const scanPlan = selectScanTargets(inquiries, startedAt, AI_SCAN_CLIENT_LIMIT);
  const scan = await collectThreadMilestones(auth, book, scanPlan.targets, startedAt + SCAN_BUDGET_MS);

  const sessionPlans = planSessions(sessions, inquiries, book, todayInClientSessionTimeZone());
  const inquiryPlans = planInquiries(sessions, inquiries, book, scan.agreed, reviewSince);
  const writes = await applyPlans(supabase, sessionPlans, inquiryPlans);
  const reconcile = await reconcileReplies(supabase, auth, ownerEmails, startedAt);

  report = {
    ...report,
    applied: {
      inquiries: writes.inquiries, sessions: writes.sessions,
      sessionsCreated: writes.sessionsCreated, replyStatuses: reconcile.updated,
    },
    failed: { ...report.failed, scans: scan.failed, writes: writes.failedWrites, reconcile: reconcile.failed },
    ambiguous: { providerNotices: provider.ambiguous, sessions: sessionPlans.skippedChanges },
    skipped: { providerNotices: provider.unmatched, signedWithoutSession: inquiryPlans.signedWithoutSession },
    remaining: {
      ...report.remaining,
      scans: scan.notScanned,
      scansOverLimit: scanPlan.overLimit,
      reconcile: reconcile.skipped,
    },
  };
  report = { ...report, status: deriveSyncStatus(report) };
  return { report, message: buildSyncMessage(report) };
}
