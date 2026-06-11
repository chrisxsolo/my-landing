// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sync-payments
//
// Two-pass payment detection with full Gmail access. Detected payments are
// written to `payments_staging` (status "pending") — NEVER directly into
// `payments`. The ledger only changes when staged rows are approved via
// /api/admin/payment-staging, which also applies inquiry/availability side
// effects. Dedup is fingerprint-based (see lib/paymentFingerprint.ts).
//
// Pass 1 — Known payment senders: Searches Pixieset, Venmo, Zelle, PayPal,
//           Cash App notification emails and extracts client info via Claude.
//           Fingerprint = Gmail message id (true source transaction identity).
//
// Pass 2 — Per-client sweep: For every unpaid inquiry, searches ALL of Gmail
//           for emails to/from that client and asks Claude if any contains
//           payment evidence. Fingerprint = payer|amount|date|method.
//
// Returns: { staged: [...], total: number }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { parsePaymentSyncMonth, withGmailMonthFilter } from "@/lib/paymentSyncShared";
import { paymentFingerprint } from "@/lib/paymentFingerprint";

export const dynamic = "force-dynamic";

const STAGING_TABLE = "payments_staging";
const PAYMENTS_TABLE = "payments";
const EVIDENCE_MAX_CHARS = 500;

type MimePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: MimePart[];
  headers?: { name: string; value: string }[];
};

type GmailMessage = {
  payload?: MimePart;
  snippet?: string;
  internalDate?: string; // epoch ms string
};

function decodeBody(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return decodeURIComponent(
      Array.from(atob(padded))
        .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch { return ""; }
}

function extractContent(part: MimePart): { text: string; html: string } {
  let text = "";
  let html  = "";
  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !text) text = decodeBody(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html) html = decodeBody(p.body.data);
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return { text, html };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Parse "$200", "200.00", "$1,200" → cents integer
function parseCents(amount: string): number {
  if (!amount) return 0;
  const digits = amount.replace(/[^0-9.]/g, "");
  const n = parseFloat(digits);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

type PaymentInfo = {
  clientEmail:  string;
  clientName:   string;
  amount:       string;
  method:       string;
  invoice:      string;
  paymentType:  string; // "deposit_1" | "deposit_2" | "full" | "other"
};

async function searchMessageIds(query: string, auth: string, maxResults: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { messages?: { id: string }[] };
    return (data.messages ?? []).map(m => m.id);
  } catch { return []; }
}

// Returns body text AND the actual email send date from the Date header / internalDate
async function fetchMessage(id: string, auth: string): Promise<{ id: string; content: string; sentAt: string }> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return { id, content: "", sentAt: "" };
    const msg = await res.json() as GmailMessage;

    // Extract body
    const { text, html } = extractContent(msg.payload ?? {});
    const content = text || stripHtml(html) || msg.snippet || "";

    // Real send date: prefer the Date header, fall back to internalDate (epoch ms)
    const headers = msg.payload?.headers ?? [];
    const dateHeader = headers.find(h => h.name.toLowerCase() === "date")?.value ?? "";
    let sentAt = "";
    if (dateHeader) {
      const parsed = new Date(dateHeader);
      if (!isNaN(parsed.getTime())) sentAt = parsed.toISOString();
    }
    if (!sentAt && msg.internalDate) {
      sentAt = new Date(parseInt(msg.internalDate, 10)).toISOString();
    }

    return { id, content, sentAt };
  } catch { return { id, content: "", sentAt: "" }; }
}

// Pass 1: extract structured payment info from a known payment notification email
async function extractPaymentFromNotification(
  content: string, anthropic: Anthropic
): Promise<PaymentInfo | null> {
  try {
    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 300,
      system: `Extract payment info from this payment notification email (Pixieset, Venmo, Zelle, PayPal, or Cash App).
Respond ONLY with valid JSON, no markdown:
{"clientEmail":"","clientName":"","amount":"","method":"","invoice":"","paymentType":"deposit_1"}
- clientEmail: payer's email if present, else empty string
- clientName: the person who paid (the payer, NOT the recipient). Include first and last name if available.
- amount: dollar amount e.g. "$200"
- method: "Venmo", "Zelle", "PayPal", "Cash App", or "Pixieset"
- invoice: invoice number if present, else empty string
- paymentType: "deposit_1" if it looks like a first/only deposit, "deposit_2" if it looks like a second/final payment, "full" if described as full payment, "other" if unclear
Use empty string for any missing field. Never return null for clientName — use whatever name is available.`,
      messages: [{ role: "user", content: content.slice(0, 3000) }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonStr) as PaymentInfo;
    if (!parsed.clientName?.trim()) return null;
    if (!["deposit_1","deposit_2","full","other"].includes(parsed.paymentType)) parsed.paymentType = "deposit_1";
    return parsed;
  } catch { return null; }
}

// Pass 2: ask Claude if any email thread for a specific client shows payment evidence
async function detectPaymentForClient(
  clientName: string, clientEmail: string, emailContext: string, anthropic: Anthropic
): Promise<{ paid: boolean; amount: string; method: string; note: string; paymentType: string } | null> {
  try {
    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 300,
      system: `You are a payment detection assistant for a photographer named Chris.
Analyze these emails and determine if client "${clientName}" has paid a deposit or session fee.

Payment evidence: Venmo/Zelle/PayPal/Cash App transfer confirmations, client saying "I sent it" / "I paid" / "just sent" / "deposit sent", bank receipts, amount mentions in payment context.

paymentType: "deposit_1" for a first/only deposit, "deposit_2" for a second/final payment, "full" for a stated full payment, "other" if unclear.

Respond ONLY with valid JSON, no markdown:
{"paid":false,"amount":"","method":"","note":"","paymentType":"deposit_1"}`,
      messages: [{
        role: "user",
        content: `Client: ${clientName} (${clientEmail})\n\nEmails:\n\n${emailContext.slice(0, 3000)}`,
      }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");
    const result = JSON.parse(jsonStr) as { paid: boolean; amount: string; method: string; note: string; paymentType: string };
    if (!["deposit_1","deposit_2","full","other"].includes(result.paymentType)) result.paymentType = "deposit_1";
    return result;
  } catch { return null; }
}

type StagedSummary = {
  name: string; email: string; amount: string; method: string;
  invoice: string; paymentType: string; paidAt: string;
  pass: number; orphan: boolean;
};

async function syncPayments(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null);
  const syncMonth = parsePaymentSyncMonth(body);
  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const auth = `Bearer ${tokens.access_token}`;
  const anthropic = new Anthropic();

  // ── Load all inquiries upfront ────────────────────────────────────────────
  const supabase = createSupabaseServerClient();
  const { data: allInquiries } = await supabase
    .from("inquiries")
    .select("id, name, email, status, payment_status, session_date, deposit_paid_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const inquiries = allInquiries ?? [];

  // Never touch inquiries that are closed/rejected — these statuses mean the
  // client didn't book, so any matching payment notification is a false positive.
  const SKIP_STATUSES = new Set(["not_interested", "archived", "declined", "cancelled", "ghosted"]);
  const activeInquiries = inquiries.filter(inq => !SKIP_STATUSES.has(inq.status));
  const unpaid = activeInquiries.filter(inq => inq.payment_status !== "paid");

  // Fingerprint dedup set: everything already in the ledger or awaiting review.
  const [{ data: ledgerFps }, { data: stagedFps }] = await Promise.all([
    supabase.from(PAYMENTS_TABLE).select("fingerprint"),
    supabase.from(STAGING_TABLE).select("fingerprint").eq("status", "pending"),
  ]);
  const knownFingerprints = new Set<string>(
    [...(ledgerFps ?? []), ...(stagedFps ?? [])]
      .map(row => row.fingerprint as string)
      .filter(Boolean)
  );

  // Inquiries already handled by a staged pass-1 row this run (skip in pass 2).
  const handledInquiries = new Set<number>();
  const staged: StagedSummary[] = [];

  // Returns false when the fingerprint was already known (nothing staged).
  async function stageRow(row: {
    fingerprint: string; inquiry_id: number | null;
    client_name: string; client_email: string;
    amount: string; amount_cents: number; method: string;
    payment_type: string; invoice: string; note: string;
    source: string; source_txn_id: string;
    paid_at: string; session_date: string | null; evidence: string;
  }): Promise<boolean> {
    if (knownFingerprints.has(row.fingerprint)) return false;
    const { error } = await supabase.from(STAGING_TABLE).insert({ ...row, status: "pending" });
    if (error) {
      console.error("[sync-payments] staging insert failed:", error);
      return false;
    }
    knownFingerprints.add(row.fingerprint);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 1 — Known payment sender notification emails
  // ═══════════════════════════════════════════════════════════════════════════

  const [pixiesetIds, venmoIds, zelleIds, paypalIds, cashIds] = await Promise.all([
    searchMessageIds(withGmailMonthFilter(`subject:"Payment on the way" "invoice"`, syncMonth), auth, 50),
    searchMessageIds(withGmailMonthFilter(`from:venmo@venmo.com "paid you"`, syncMonth), auth, 50),
    searchMessageIds(withGmailMonthFilter(`from:no-reply@zelle.com "sent you"`, syncMonth), auth, 50),
    searchMessageIds(withGmailMonthFilter(`from:service@paypal.com "sent you"`, syncMonth), auth, 50),
    searchMessageIds(withGmailMonthFilter(`(from:cash@square.com OR from:no-reply@cash.app) "sent you"`, syncMonth), auth, 50),
  ]);

  const pass1Ids = [...new Set([...pixiesetIds, ...venmoIds, ...zelleIds, ...paypalIds, ...cashIds])];
  const pass1Messages = await Promise.all(pass1Ids.map(id => fetchMessage(id, auth)));

  // Extract payment info in batches of 5
  type Pass1Entry = { payment: PaymentInfo; messageId: string; sentAt: string; evidence: string };
  const pass1Entries: Pass1Entry[] = [];
  for (let i = 0; i < pass1Messages.length; i += 5) {
    const batch = pass1Messages.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(m => m.content ? extractPaymentFromNotification(m.content, anthropic) : null)
    );
    results.forEach((r, j) => {
      if (r) pass1Entries.push({
        payment: r,
        messageId: batch[j].id,
        sentAt: batch[j].sentAt,
        evidence: batch[j].content.slice(0, EVIDENCE_MAX_CHARS),
      });
    });
  }

  for (const { payment, messageId, sentAt, evidence } of pass1Entries) {
    const clientEmail = payment.clientEmail?.toLowerCase();
    const clientName  = payment.clientName?.toLowerCase().trim();
    if (!payment.clientName?.trim()) continue;

    let matching = clientEmail?.includes("@")
      ? activeInquiries.filter(inq => inq.email?.toLowerCase() === clientEmail)
      : [];

    if (!matching.length && clientName) {
      const nameParts = clientName.split(" ");
      const firstName = nameParts[0];
      const lastName  = nameParts[nameParts.length - 1];
      const hasLastName = nameParts.length >= 2;
      matching = activeInquiries.filter(inq => {
        const n = inq.name?.toLowerCase().trim() ?? "";
        if (n === clientName) return true;
        if (hasLastName) {
          const nParts = n.split(" ");
          return nParts[0] === firstName && nParts[nParts.length - 1] === lastName;
        }
        return n === firstName;
      });
    }

    const amountCents = parseCents(payment.amount);
    const paidAt = sentAt || new Date().toISOString();
    // Gmail message id is the true transaction identity…
    const txnFingerprint = paymentFingerprint({ sourceTxnId: `gmail:${messageId}`, amountCents, paidAt });
    // …but legacy ledger rows were backfilled with field hashes, so check both.
    const fieldFingerprint = paymentFingerprint({
      clientEmail: payment.clientEmail,
      clientName: payment.clientName,
      amountCents,
      paidAt,
      method: payment.method,
    });
    if (knownFingerprints.has(fieldFingerprint)) continue;

    const inq = matching[0] ?? null;
    const note = [
      payment.amount && `${payment.method || "Payment"}: ${payment.amount}`,
      payment.invoice && `Invoice ${payment.invoice}`,
    ].filter(Boolean).join(" · ");

    const didStage = await stageRow({
      fingerprint: txnFingerprint,
      inquiry_id: inq?.id ?? null,
      client_name: payment.clientName,
      client_email: payment.clientEmail,
      amount: payment.amount,
      amount_cents: amountCents,
      method: payment.method,
      payment_type: payment.paymentType,
      invoice: payment.invoice,
      note,
      source: "pass1",
      source_txn_id: `gmail:${messageId}`,
      paid_at: paidAt,
      session_date: inq?.session_date ?? null,
      evidence,
    });

    matching.forEach(m => handledInquiries.add(m.id));

    if (didStage) {
      staged.push({
        name: payment.clientName, email: payment.clientEmail,
        amount: payment.amount, method: payment.method,
        invoice: payment.invoice, paymentType: payment.paymentType,
        paidAt, pass: 1, orphan: !inq,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 2 — Per-client full Gmail sweep for remaining unpaid inquiries
  // ═══════════════════════════════════════════════════════════════════════════

  const clientSweepInquiries = syncMonth ? activeInquiries : unpaid;
  const stillUnpaid = clientSweepInquiries.filter(inq => !handledInquiries.has(inq.id));

  for (const inq of stillUnpaid) {
    const [threadIds, paymentMentionIds] = await Promise.all([
      searchMessageIds(withGmailMonthFilter(`from:${inq.email} OR to:${inq.email}`, syncMonth), auth, 10),
      searchMessageIds(
        withGmailMonthFilter(`"${inq.name}" (paid OR payment OR deposit OR venmo OR zelle OR "cash app" OR sent)`, syncMonth),
        auth, 5
      ),
    ]);

    const ids = [...new Set([...threadIds, ...paymentMentionIds])].slice(0, 12);
    if (!ids.length) continue;

    const messages = await Promise.all(ids.map(id => fetchMessage(id, auth)));
    const context = messages
      .filter(m => m.content)
      .map((m, idx) => `--- Email ${idx + 1} ---\n${m.content}`)
      .join("\n\n");
    if (!context) continue;

    const result = await detectPaymentForClient(inq.name ?? "", inq.email ?? "", context, anthropic);
    if (!result?.paid) continue;

    const amountCents = parseCents(result.amount);
    if (amountCents <= 0) continue;

    // Use earliest message date that has content as the paid_at approximation
    const paidAt = messages.find(m => m.content && m.sentAt)?.sentAt || new Date().toISOString();
    const note = [
      result.note,
      result.amount && `${result.amount}`,
      result.method && `via ${result.method}`,
    ].filter(Boolean).join(" · ");

    const fingerprint = paymentFingerprint({
      clientEmail: inq.email ?? "",
      clientName: inq.name ?? "",
      amountCents,
      paidAt,
      method: result.method,
    });

    const didStage = await stageRow({
      fingerprint,
      inquiry_id: inq.id,
      client_name: inq.name ?? "",
      client_email: inq.email ?? "",
      amount: result.amount,
      amount_cents: amountCents,
      method: result.method,
      payment_type: result.paymentType,
      invoice: "",
      note,
      source: "pass2",
      source_txn_id: "",
      paid_at: paidAt,
      session_date: inq.session_date ?? null,
      evidence: context.slice(0, EVIDENCE_MAX_CHARS),
    });

    if (didStage) {
      handledInquiries.add(inq.id);
      staged.push({
        name: inq.name ?? "", email: inq.email ?? "",
        amount: result.amount, method: result.method,
        invoice: "", paymentType: result.paymentType,
        paidAt, pass: 2, orphan: false,
      });
    }
  }

  return NextResponse.json({ staged, total: staged.length });
}

export async function POST(req: NextRequest) {
  try {
    return await syncPayments(req);
  } catch (error) {
    console.error("[sync-payments]", error);
    const message = error instanceof Error ? error.message : "Claude payment audit failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
