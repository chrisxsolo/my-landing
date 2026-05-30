// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sessions/sync-sent-invoices
//
// Scans Gmail (sent + inbox) for invoice, contract, payment, and signing events.
// Updates client_sessions and inquiries tables accordingly.
// Also auto-sets estimated_delivery_date to 14 days after session_date when missing.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { CLIENT_SESSION_TABLE } from "@/lib/clientSessions";

export const dynamic = "force-dynamic";

type GmailHeader = { name: string; value: string };
type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return headerValue.toLowerCase().trim();
}

function isInvoiceSubject(subject: string): boolean {
  return /invoice/i.test(subject) && /soloxsnaps/i.test(subject);
}

function isContractSubject(subject: string): boolean {
  return /contract/i.test(subject) && /soloxsnaps/i.test(subject);
}

function isPaymentReceivedSubject(subject: string, from: string): boolean {
  const sub = subject.toLowerCase();
  const frm = from.toLowerCase();
  if (frm.includes("venmo.com") && (sub.includes("paid you") || sub.includes("sent you"))) return true;
  if (frm.includes("paypal.com") && (sub.includes("payment received") || sub.includes("you received"))) return true;
  if (frm.includes("cash.app") && sub.includes("received")) return true;
  if (frm.includes("square.com") && sub.includes("payment")) return true;
  if (frm.includes("stripe.com") && sub.includes("payment")) return true;
  if (frm.includes("honeybook.com") && (sub.includes("paid") || sub.includes("payment"))) return true;
  if (sub.includes("deposit received") || sub.includes("deposit paid")) return true;
  return false;
}

function isContractSignedSubject(subject: string, from: string): boolean {
  const sub = subject.toLowerCase();
  const frm = from.toLowerCase();
  if (frm.includes("docusign") && sub.includes("completed")) return true;
  if (frm.includes("pandadoc") && (sub.includes("signed") || sub.includes("completed"))) return true;
  if (frm.includes("honeybook.com") && (sub.includes("signed") || sub.includes("contract"))) return true;
  if (frm.includes("hellosign") && sub.includes("completed")) return true;
  if ((sub.includes("contract") || sub.includes("document")) && (sub.includes("signed") || sub.includes("completed"))) return true;
  return false;
}

function msgDate(internalDate?: string): string {
  return internalDate
    ? new Date(parseInt(internalDate, 10)).toISOString()
    : new Date().toISOString();
}

function extractClientEmailFromSubject(subject: string, clientEmails: Set<string>): string | null {
  const lower = subject.toLowerCase();
  for (const email of clientEmails) {
    if (lower.includes(email.toLowerCase())) return email;
  }
  return null;
}

function matchClientNameInSubject(subject: string, clientNames: Map<string, string>): string | null {
  const lower = subject.toLowerCase();
  for (const [email, name] of clientNames) {
    if (!name) continue;
    const parts = name.toLowerCase().split(/\s+/);
    if (parts.some(p => p.length > 2 && lower.includes(p))) return email;
  }
  return null;
}

async function fetchMessages(auth: string, query: string, maxResults = 50): Promise<GmailMessage[]> {
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: auth } },
  );
  if (!searchRes.ok) return [];
  const data = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (data.messages ?? []).map(m => m.id);
  if (!ids.length) return [];

  return Promise.all(
    ids.map(async id => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
          `?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: auth } },
        );
        if (!r.ok) return null;
        return await r.json() as GmailMessage;
      } catch { return null; }
    }),
  ).then(msgs => msgs.filter((m): m is GmailMessage => m !== null));
}

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
  const { data: allSessions } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id, client_email, client_name, invoice_status, contract_status, session_date, estimated_delivery_date");

  const sessions = allSessions ?? [];
  const allEmails = new Set(sessions.map(s => (s.client_email as string).toLowerCase()));
  const clientNames = new Map<string, string>(
    sessions.map(s => [s.client_email as string, (s.client_name as string) ?? ""])
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

  // ── 5. Apply updates to client_sessions ───────────────────────────────────
  const updated: string[] = [];

  for (const session of sessions) {
    const email = (session.client_email as string).toLowerCase();
    const sentInfo = sentByEmail.get(email);
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
  ])];

  let timelineUpdated = 0;

  if (allInquiryEmails.length) {
    const { data: inquiries } = await supabase
      .from("inquiries")
      .select("id, email, reply_sent_at, invoice_sent_at, contract_sent_at, deposit_paid_at")
      .in("email", allInquiryEmails);

    for (const inq of inquiries ?? []) {
      const email = (inq.email as string).toLowerCase();
      const info = sentByEmail.get(email);
      const inqUpdates: Record<string, string> = {};

      if (firstReplySentByEmail.has(email) && !inq.reply_sent_at) {
        inqUpdates.reply_sent_at = firstReplySentByEmail.get(email)!;
      }
      if (info?.invoiceSentAt && !inq.invoice_sent_at) inqUpdates.invoice_sent_at = info.invoiceSentAt;
      if (info?.contractSentAt && !inq.contract_sent_at) inqUpdates.contract_sent_at = info.contractSentAt;
      if (paidEmails.has(email) && !inq.deposit_paid_at) {
        inqUpdates.deposit_paid_at = paidAtByEmail.get(email) ?? new Date().toISOString();
      }

      if (Object.keys(inqUpdates).length) {
        await supabase.from("inquiries").update(inqUpdates).eq("id", inq.id);
        timelineUpdated++;
      }
    }
  }

  const timelinePart = timelineUpdated > 0 ? ` + ${timelineUpdated} timeline field${timelineUpdated !== 1 ? "s" : ""} updated` : "";
  const message = updated.length
    ? `Updated ${updated.length} client${updated.length !== 1 ? "s" : ""}: ${updated.join("; ")}${timelinePart}`
    : timelineUpdated > 0
    ? `Timeline synced — ${timelineUpdated} inquiry timeline field${timelineUpdated !== 1 ? "s" : ""} updated from Gmail.`
    : "Everything is already up to date — no new invoice, contract, payment, reply, or delivery date changes found.";

  return NextResponse.json({ updated, message });
}
