// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sessions/sync-sent-invoices
//
// Scans Gmail (sent + inbox) for invoice, contract, payment, and signing events
// via subject heuristics, then runs an AI pass over each active client's actual
// email thread to catch milestones the heuristics miss. Updates the inquiries
// timeline fields and advances client_sessions.current_status (never regresses).
// Also auto-sets estimated_delivery_date to 14 days after session_date when missing.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildBookedAvailabilityNote, CLIENT_SESSION_TABLE, escapeIlikePattern } from "@/lib/clientSessions";
import { advancePortalSessionForDeposit } from "@/lib/adminPortalSessionUpsert";
import { computeAdvancedStatus, scanMilestonesForClients } from "@/lib/emailTimelineScan";
import { getConnectedAccountEmails, reconcileInquiriesWithGmail } from "@/lib/inquiryReconcileGmail";
import {
  extractClientEmailFromSubject,
  extractEmail,
  fetchMessages,
  getHeader,
  isContractSignedSubject,
  isContractSubject,
  isInvoiceSubject,
  isPaymentReceivedSubject,
  matchClientNameInSubject,
  msgDate,
} from "@/lib/gmailSyncHelpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AI_SCAN_CLIENT_LIMIT = 16;
const AVAILABILITY_TABLE = "availability";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail in Studio Dashboard first." },
      { status: 400 },
    );
  }

  const auth = `Bearer ${tokens.access_token}`;
  const supabase = createSupabaseAdminClient();

  // ── 1. Fetch all sessions from DB ──────────────────────────────────────────
  const { data: allSessions, error: sessionsError } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id, client_email, client_name, invoice_status, contract_status, current_status, session_date, estimated_delivery_date");

  if (sessionsError) {
    console.error("[sync-sent-invoices] failed to load sessions:", sessionsError);
    return NextResponse.json({ error: "Failed to load client sessions" }, { status: 500 });
  }

  const sessions = allSessions ?? [];
  const allEmails = new Set(sessions.map(s => (s.client_email as string).toLowerCase()));
  // Keyed lowercase — every downstream lookup (paidEmails, signedEmails,
  // sentByEmail in step 5) uses lowercased emails, and matchClientNameInSubject
  // returns this map's key verbatim.
  const clientNames = new Map<string, string>(
    sessions.map(s => [(s.client_email as string).toLowerCase(), (s.client_name as string) ?? ""])
  );

  // ── 2. Scan sent folder: invoices + contracts ──────────────────────────────
  const sentMessages = await fetchMessages(
    auth,
    `in:sent (subject:Invoice OR subject:Contract) SoloxSnaps`,
    100,
  );

  type SentInfo = { invoiceSentAt: string | null; contractSentAt: string | null };
  const sentByEmail = new Map<string, SentInfo>();

  for (const msg of sentMessages) {
    if (!msg.payload?.headers) continue;
    const subject = getHeader(msg.payload.headers, "Subject");
    const to = getHeader(msg.payload.headers, "To");
    const recipientEmail = extractEmail(to);
    if (!recipientEmail.includes("@")) continue;

    const sentAt = msgDate(msg.internalDate);

    const existing = sentByEmail.get(recipientEmail) ?? { invoiceSentAt: null, contractSentAt: null };
    if (isInvoiceSubject(subject) && !existing.invoiceSentAt) existing.invoiceSentAt = sentAt;
    if (isContractSubject(subject) && !existing.contractSentAt) existing.contractSentAt = sentAt;
    sentByEmail.set(recipientEmail, existing);
  }

  // ── 2b. Scan sent folder: all recent emails (to detect first reply) ────────
  const allRecentSentMessages = await fetchMessages(
    auth,
    `in:sent newer_than:365d`,
    200,
  );

  const firstReplySentByEmail = new Map<string, string>(); // email → ISO timestamp of earliest sent email

  for (const msg of allRecentSentMessages) {
    if (!msg.payload?.headers) continue;
    const to = getHeader(msg.payload.headers, "To");
    const recipientEmail = extractEmail(to);
    if (!recipientEmail.includes("@")) continue;

    const sentAt = msgDate(msg.internalDate);

    const existing = firstReplySentByEmail.get(recipientEmail);
    if (!existing || sentAt < existing) {
      firstReplySentByEmail.set(recipientEmail, sentAt);
    }
  }

  // ── 3. Scan inbox: payment received ───────────────────────────────────────
  const paymentMessages = await fetchMessages(
    auth,
    `in:inbox (from:venmo.com OR from:paypal.com OR from:cash.app OR from:square.com OR from:stripe.com OR from:honeybook.com OR subject:"deposit received" OR subject:"deposit paid" OR subject:"payment received") newer_than:365d`,
    50,
  );

  const paidEmails = new Set<string>();
  const paidAtByEmail = new Map<string, string>();

  for (const msg of paymentMessages) {
    if (!msg.payload?.headers) continue;
    const subject = getHeader(msg.payload.headers, "Subject");
    const from = getHeader(msg.payload.headers, "From");
    if (!isPaymentReceivedSubject(subject, from)) continue;

    const sentAt = msgDate(msg.internalDate);

    // Try to match by client email in subject first
    let matchedEmail = extractClientEmailFromSubject(subject, allEmails);
    // Fall back to matching by client name in subject
    if (!matchedEmail) matchedEmail = matchClientNameInSubject(subject, clientNames);

    if (matchedEmail) {
      paidEmails.add(matchedEmail);
      if (!paidAtByEmail.has(matchedEmail)) paidAtByEmail.set(matchedEmail, sentAt);
    }
  }

  // ── 4. Scan inbox: contract signed / completed ────────────────────────────
  const signedMessages = await fetchMessages(
    auth,
    `in:inbox (from:docusign OR from:pandadoc OR from:honeybook.com OR from:hellosign OR subject:completed OR subject:"contract signed" OR subject:"document signed") newer_than:365d`,
    50,
  );

  const signedEmails = new Set<string>();
  const signedAtByEmail = new Map<string, string>();

  for (const msg of signedMessages) {
    if (!msg.payload?.headers) continue;
    const subject = getHeader(msg.payload.headers, "Subject");
    const from = getHeader(msg.payload.headers, "From");
    if (!isContractSignedSubject(subject, from)) continue;

    const sentAt = msgDate(msg.internalDate);

    // Try to match by client email in To header
    const to = getHeader(msg.payload.headers, "To");
    let matchedEmail = allEmails.has(extractEmail(to)) ? extractEmail(to) : null;
    // Fall back to subject matching
    if (!matchedEmail) matchedEmail = extractClientEmailFromSubject(subject, allEmails);
    if (!matchedEmail) matchedEmail = matchClientNameInSubject(subject, clientNames);

    if (matchedEmail) {
      signedEmails.add(matchedEmail);
      if (!signedAtByEmail.has(matchedEmail)) signedAtByEmail.set(matchedEmail, sentAt);
    }
  }

  // ── 4b. AI pass: read each active client's thread for missed milestones ────
  // Heuristics above only match known subject patterns; the AI pass reads the
  // actual conversation (client says "just Venmo'd you", signed PDF returned,
  // gallery link sent, …) for clients whose timeline is still incomplete.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { data: incompleteInquiries } = await supabase
    .from("inquiries")
    .select("email, name")
    .or("reply_sent_at.is.null,invoice_sent_at.is.null,contract_sent_at.is.null,deposit_paid_at.is.null,gallery_delivered_at.is.null")
    .gte("created_at", oneYearAgo)
    .order("created_at", { ascending: false })
    .limit(AI_SCAN_CLIENT_LIMIT * 2);

  const scanTargets = new Map<string, { email: string; name: string | null }>();
  for (const inq of incompleteInquiries ?? []) {
    const email = (inq.email as string).toLowerCase();
    if (!scanTargets.has(email)) scanTargets.set(email, { email, name: inq.name as string | null });
    if (scanTargets.size >= AI_SCAN_CLIENT_LIMIT) break;
  }

  const galleryByEmail = new Map<string, string>();
  const sessionDateByEmail = new Map<string, string>();
  const sessionTimeByEmail = new Map<string, string>();
  const aiScanned = await scanMilestonesForClients(auth, [...scanTargets.values()]);

  for (const [email, m] of aiScanned) {
    const sent = sentByEmail.get(email) ?? { invoiceSentAt: null, contractSentAt: null };
    if (m.invoiceSentAt && !sent.invoiceSentAt) sent.invoiceSentAt = m.invoiceSentAt;
    if (m.contractSentAt && !sent.contractSentAt) sent.contractSentAt = m.contractSentAt;
    sentByEmail.set(email, sent);

    const firstReply = firstReplySentByEmail.get(email);
    if (m.replySentAt && (!firstReply || m.replySentAt < firstReply)) {
      firstReplySentByEmail.set(email, m.replySentAt);
    }
    if (m.depositPaidAt) {
      paidEmails.add(email);
      if (!paidAtByEmail.has(email)) paidAtByEmail.set(email, m.depositPaidAt);
    }
    if (m.contractSignedAt) {
      signedEmails.add(email);
      if (!signedAtByEmail.has(email)) signedAtByEmail.set(email, m.contractSignedAt);
    }
    if (m.galleryDeliveredAt) galleryByEmail.set(email, m.galleryDeliveredAt);
    if (m.sessionDate) sessionDateByEmail.set(email, m.sessionDate);
    if (m.sessionTime) sessionTimeByEmail.set(email, m.sessionTime);
  }

  // ── 5. Apply updates to client_sessions ───────────────────────────────────
  // Milestones already stamped on the inquiry (by an earlier sync or clicked
  // manually in the timeline UI) count as evidence too — otherwise a session
  // whose deposit was stamped outside this run stays stuck at an early stage.
  const { data: allInquiries } = await supabase
    .from("inquiries")
    .select("id, email, name, session_type, session_date, preferred_time, location, reply_sent_at, invoice_sent_at, contract_sent_at, deposit_paid_at, gallery_delivered_at, booking_confirmed")
    .order("created_at", { ascending: false });

  const inquiryByEmail = new Map<string, NonNullable<typeof allInquiries>[number]>();
  for (const inq of allInquiries ?? []) {
    const email = (inq.email as string).toLowerCase();
    if (!inquiryByEmail.has(email)) inquiryByEmail.set(email, inq);
  }

  const updated: string[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const session of sessions) {
    const email = (session.client_email as string).toLowerCase();
    const sentInfo = sentByEmail.get(email);
    const inqStamps = inquiryByEmail.get(email);
    const sessionUpdates: Record<string, string> = {};
    const parts: string[] = [];

    // Invoice sent
    if (sentInfo?.invoiceSentAt && !["paid"].includes(session.invoice_status ?? "")) {
      if (!session.invoice_status) {
        sessionUpdates.invoice_status = "sent";
        parts.push("invoice → sent");
      }
    }

    // Invoice paid (deposit received)
    if (paidEmails.has(email) && !["paid"].includes(session.invoice_status ?? "")) {
      sessionUpdates.invoice_status = "paid";
      parts.push("invoice → paid");
    }

    // Contract sent
    if (sentInfo?.contractSentAt && !["signed"].includes(session.contract_status ?? "")) {
      if (!session.contract_status) {
        sessionUpdates.contract_status = "sent";
        parts.push("contract → sent");
      }
    }

    // Contract signed
    if (signedEmails.has(email) && !["signed"].includes(session.contract_status ?? "")) {
      sessionUpdates.contract_status = "signed";
      parts.push("contract → signed");
    }

    // Advance the 9-stage portal progress from detected milestones (never backward)
    const nextStatus = computeAdvancedStatus(session.current_status as string, {
      replySent: firstReplySentByEmail.has(email) || !!inqStamps?.reply_sent_at,
      invoiceSent: !!sentInfo?.invoiceSentAt || !!inqStamps?.invoice_sent_at,
      contractSent: !!sentInfo?.contractSentAt || !!inqStamps?.contract_sent_at,
      depositPaid: paidEmails.has(email) || !!inqStamps?.deposit_paid_at,
      contractSigned: signedEmails.has(email),
      sessionDatePast: !!session.session_date && (session.session_date as string) < todayStr,
      galleryDelivered: galleryByEmail.has(email) || !!inqStamps?.gallery_delivered_at,
    });
    if (nextStatus) {
      sessionUpdates.current_status = nextStatus;
      parts.push(`stage → ${nextStatus.replace(/_/g, " ")}`);
    }

    // Auto-populate delivery date if session_date exists but delivery is unset
    if (session.session_date && !session.estimated_delivery_date) {
      const shoot = new Date(session.session_date as string);
      if (!isNaN(shoot.getTime())) {
        const delivery = new Date(shoot.getTime() + 14 * 24 * 60 * 60 * 1000);
        sessionUpdates.estimated_delivery_date = delivery.toISOString().slice(0, 10);
        parts.push("delivery date set");
      }
    }

    if (Object.keys(sessionUpdates).length) {
      await supabase.from(CLIENT_SESSION_TABLE).update(sessionUpdates).eq("id", session.id);
      updated.push(`${session.client_email}: ${parts.join(", ")}`);
    }
  }

  // ── 6. Stamp inquiries table ───────────────────────────────────────────────
  const allInquiryEmails = [...new Set([
    ...sentByEmail.keys(),
    ...paidEmails,
    ...signedEmails,
    ...firstReplySentByEmail.keys(),
    ...galleryByEmail.keys(),
    ...sessionDateByEmail.keys(),
  ])];

  let timelineUpdated = 0;

  if (allInquiryEmails.length) {
    // inquiries.email is stored as typed by the client, so a case-sensitive
    // .in() with our lowercased keys would skip mixed-case rows. Filter the
    // step-5 load on the normalized address instead (the table is small).
    const emailSet = new Set(allInquiryEmails);
    const inquiries = (allInquiries ?? []).filter(
      (inq) => emailSet.has((inq.email as string).toLowerCase()),
    );

    for (const inq of inquiries) {
      const email = (inq.email as string).toLowerCase();
      const info = sentByEmail.get(email);
      const inqUpdates: Record<string, string | boolean> = {};

      if (firstReplySentByEmail.has(email) && !inq.reply_sent_at) {
        inqUpdates.reply_sent_at = firstReplySentByEmail.get(email)!;
      }
      if (info?.invoiceSentAt && !inq.invoice_sent_at) inqUpdates.invoice_sent_at = info.invoiceSentAt;
      if (info?.contractSentAt && !inq.contract_sent_at) inqUpdates.contract_sent_at = info.contractSentAt;
      if (paidEmails.has(email) && !inq.deposit_paid_at) {
        inqUpdates.deposit_paid_at = paidAtByEmail.get(email) ?? new Date().toISOString();
      }
      if (galleryByEmail.has(email) && !inq.gallery_delivered_at) {
        inqUpdates.gallery_delivered_at = galleryByEmail.get(email)!;
      }
      if (paidEmails.has(email) && inq.booking_confirmed !== true) {
        inqUpdates.booking_confirmed = true;
      }

      const depositEvidence = paidEmails.has(email) || !!inq.deposit_paid_at;
      const detectedDate = sessionDateByEmail.get(email);
      const sessionTime = (inq.preferred_time as string | null) ?? sessionTimeByEmail.get(email) ?? null;
      if (sessionTimeByEmail.has(email) && !inq.preferred_time) {
        inqUpdates.preferred_time = sessionTimeByEmail.get(email)!;
      }

      // Session date agreed over email → stamp the inquiry, mark the calendar
      // day booked (once the deposit is in), and backfill dateless portal
      // sessions — same writes as confirming the date in the conversation view.
      if (detectedDate && !inq.session_date) {
        inqUpdates.session_date = detectedDate;
        if (depositEvidence) {
          await supabase.from(AVAILABILITY_TABLE).upsert(
            { date: detectedDate, status: "booked", note: buildBookedAvailabilityNote((inq.name as string | null) ?? email, sessionTime) },
            { onConflict: "date" },
          );
        }
        await supabase.from(CLIENT_SESSION_TABLE)
          .update({ session_date: detectedDate })
          .ilike("client_email", escapeIlikePattern(email))
          .is("session_date", null);
      }

      if (Object.keys(inqUpdates).length) {
        await supabase.from("inquiries").update(inqUpdates).eq("id", inq.id);
        timelineUpdated++;
      }

      // A client who booked entirely over email may have no portal session at
      // all — step 5 can only advance existing rows. Create one at "booked".
      const galleryEvidence = galleryByEmail.has(email) || !!inq.gallery_delivered_at;
      if (depositEvidence && !galleryEvidence && !allEmails.has(email)) {
        try {
          const result = await advancePortalSessionForDeposit(supabase, {
            clientEmail: email,
            clientName: inq.name as string | null,
            sessionType: inq.session_type as string | null,
            sessionDate: (inq.session_date as string | null) ?? detectedDate ?? null,
            location: inq.location as string | null,
          });
          if (result === "created") {
            allEmails.add(email);
            updated.push(`${email}: portal session created at booked`);
          }
        } catch (error) {
          console.error(`[sync-sent-invoices] portal session create failed for ${email}:`, error);
        }
      }
    }
  }

  // ── 7. Reconcile inquiry reply status against the full Gmail history ──────
  // Timeline stamps alone left inquiries stuck on "new" even after a reply,
  // invoice, and contract went out. This pass inspects each inquiry's actual
  // conversation (sent + received, all labels) and fixes status / needs_reply.
  let reconcilePart = "";
  try {
    const connectedEmails = await getConnectedAccountEmails(auth, tokens.email);
    const recon = await reconcileInquiriesWithGmail(supabase, auth, connectedEmails);
    if (recon.updated > 0) {
      reconcilePart = ` Reply status reconciled on ${recon.updated} inquir${recon.updated === 1 ? "y" : "ies"}` +
        (recon.statusRepaired > 0 ? ` (${recon.statusRepaired} moved out of “New”)` : "") + ".";
    }
  } catch (error) {
    console.error("[sync-sent-invoices] inquiry reconciliation failed:", error);
    reconcilePart = " Reply-status reconciliation failed — see server logs.";
  }

  const scanPart = scanTargets.size > 0 ? ` (AI-scanned ${aiScanned.size}/${scanTargets.size} client thread${scanTargets.size !== 1 ? "s" : ""})` : "";
  const timelinePart = timelineUpdated > 0 ? ` + ${timelineUpdated} timeline field${timelineUpdated !== 1 ? "s" : ""} updated` : "";
  const message = (updated.length
    ? `Updated ${updated.length} client${updated.length !== 1 ? "s" : ""}: ${updated.join("; ")}${timelinePart}${scanPart}`
    : timelineUpdated > 0
    ? `Timeline synced — ${timelineUpdated} inquiry timeline field${timelineUpdated !== 1 ? "s" : ""} updated from Gmail${scanPart}.`
    : `Everything is already up to date — no new invoice, contract, payment, reply, or delivery date changes found${scanPart}.`) + reconcilePart;

  return NextResponse.json({ updated, message });
}
