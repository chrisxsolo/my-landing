// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sync-payments
//
// Two-pass payment sync with full Gmail access:
//
// Pass 1 — Known payment senders: Searches Pixieset, Venmo, Zelle, PayPal,
//           Cash App notification emails and extracts client info via Claude.
//           Records EVERY payment (deposit 1, deposit 2, etc.) in `payments`.
//           paid_at = actual email Date header (not sync time).
//           Orphan contacts (no matching inquiry) also get a payment row.
//
// Pass 2 — Per-client sweep: For every unpaid inquiry, searches ALL of Gmail
//           for emails to/from that client and asks Claude if any contains
//           payment evidence. Catches anything Pass 1 misses.
//
// Returns: { synced: [...], total: number }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { parsePaymentSyncMonth, withGmailMonthFilter } from "@/lib/paymentSyncShared";

export const dynamic = "force-dynamic";

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
async function fetchMessage(id: string, auth: string): Promise<{ content: string; sentAt: string }> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return { content: "", sentAt: "" };
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

    return { content, sentAt };
  } catch { return { content: "", sentAt: "" }; }
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

// Dedup key: same person + same amount (case-insensitive, trimmed)
function paymentKey(name: string, email: string, amount: string): string {
  return `${(email || name).toLowerCase().trim()}::${amount.toLowerCase().trim()}`;
}

// Search Gmail for emails to/from clientEmail and ask Claude for the session date.
// Returns a YYYY-MM-DD string, or null if not found.
async function detectSessionDate(
  clientEmail: string,
  clientName: string,
  dateInMind: string | null,
  auth: string,
  anthropic: Anthropic
): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(`from:${clientEmail} OR to:${clientEmail}`)}&maxResults=20`,
      { headers: { Authorization: auth } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json() as { messages?: { id: string }[] };
    const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 15);
    if (!ids.length) return null;

    const bodies = await Promise.all(ids.map(async id => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: auth } }
        );
        if (!r.ok) return "";
        const msg = await r.json() as GmailMessage;
        const { text, html } = extractContent(msg.payload ?? {});
        return (text || stripHtml(html) || msg.snippet || "").slice(0, 2000);
      } catch { return ""; }
    }));

    const emailContext = bodies
      .filter(Boolean)
      .map((b, i) => `--- Email ${i + 1} ---\n${b}`)
      .join("\n\n");
    if (!emailContext) return null;

    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 150,
      system: `Extract the confirmed or agreed photography session date from these emails. Today is ${today}. Current year is ${currentYear}.
Rules:
- Find the most recently discussed/confirmed date.
- If month+day given without year, use ${currentYear}. Only use ${currentYear + 1} if that date is already past.
- Confirmation = one person proposes a date + the other agrees ("sounds good", "perfect", "see you then", "that works", "confirmed").
- Return ONLY valid JSON, no markdown:
{"date":"YYYY-MM-DD"}
If no specific session date is mentioned: {"date":null}`,
      messages: [{
        role: "user",
        content: `Client: ${clientName}\nDate they mentioned: ${dateInMind ?? "not specified"}\n\n${emailContext}`,
      }],
    });

    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "{}";
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonStr) as { date: string | null };
    if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return null;
    return parsed.date;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
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
  // client didn't book, so any matching payment notification is a false positive
  // (e.g. same invoice number belonging to someone else, or a payment that was
  // refunded). Keeps them out of all three passes.
  const SKIP_STATUSES = new Set(["not_interested", "archived", "declined", "cancelled", "ghosted"]);
  const activeInquiries = inquiries.filter(inq => !SKIP_STATUSES.has(inq.status));
  const unpaid = activeInquiries.filter(inq => inq.payment_status !== "paid");

  // Load existing payments for dedup logic
  const { data: existingPaymentRows } = await supabase
    .from("payments")
    .select("client_name, client_email, amount, payment_type, inquiry_id");

  const existingPayments = existingPaymentRows ?? [];
  const existingKeys = new Set<string>(
    existingPayments.map(p => paymentKey(p.client_name, p.client_email, p.amount))
  );

  const markedPaid = new Set<number>();

  const synced: {
    name: string; email: string; amount: string; method: string;
    invoice: string; paymentType: string; paidAt: string;
    alreadyPaid: boolean; dateBooked?: string; pass: number; orphan: boolean;
  }[] = [];

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
  type Pass1Entry = { payment: PaymentInfo; sentAt: string };
  const pass1Entries: Pass1Entry[] = [];
  for (let i = 0; i < pass1Messages.length; i += 5) {
    const batch = pass1Messages.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(m => m.content ? extractPaymentFromNotification(m.content, anthropic) : null)
    );
    results.forEach((r, j) => {
      if (r) pass1Entries.push({ payment: r, sentAt: batch[j].sentAt });
    });
  }

  // Match pass 1 payments to inquiries (allow multiple payments per person)
  for (const { payment, sentAt } of pass1Entries) {
    const clientEmail = payment.clientEmail?.toLowerCase();
    const clientName  = payment.clientName?.toLowerCase().trim();

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

    const pKey = paymentKey(payment.clientName, payment.clientEmail, payment.amount);
    const alreadyRecorded = existingKeys.has(pKey);
    // Use the real email send date; fall back to now only if unavailable
    const paidAt = sentAt || new Date().toISOString();

    if (matching.length) {
      const alreadyPaid = matching.every(inq => inq.payment_status === "paid");
      const note = [
        payment.amount && `${payment.method || "Payment"}: ${payment.amount}`,
        payment.invoice && `Invoice ${payment.invoice}`,
      ].filter(Boolean).join(" · ");

      const now = new Date().toISOString();
      const newlyPaidIds = matching
        .filter(inq => !markedPaid.has(inq.id) && inq.payment_status !== "paid")
        .map(inq => inq.id);
      const allMatchIds = matching.map(inq => inq.id);

      await supabase.from("inquiries").update({
        payment_status: "paid", payment_note: note,
        payment_detected_at: now, booking_confirmed: true,
      }).in("id", allMatchIds);

      if (newlyPaidIds.length) {
        await supabase.from("inquiries").update({ deposit_paid_at: paidAt }).in("id", newlyPaidIds);
      }

      allMatchIds.forEach(id => markedPaid.add(id));

      if (!alreadyRecorded) {
        existingKeys.add(pKey);
        const inq = matching[0];
        const sessionDate: string | null = inq.session_date ?? null;
        await supabase.from("payments").insert({
          inquiry_id:   inq.id,
          client_name:  payment.clientName,
          client_email: payment.clientEmail,
          amount:       payment.amount,
          amount_cents: parseCents(payment.amount),
          method:       payment.method,
          payment_type: payment.paymentType,
          invoice:      payment.invoice,
          note,
          source:       "pass1",
          paid_at:      paidAt,
          session_date: sessionDate,
        });
      }

      let dateBooked: string | undefined;
      const primaryInq = matching[0];

      // Try to auto-detect session date from Gmail if not already set
      let resolvedSessionDate = matching.find(inq => inq.session_date)?.session_date ?? null;
      if (!resolvedSessionDate && payment.clientEmail?.includes("@")) {
        resolvedSessionDate = await detectSessionDate(
          payment.clientEmail, payment.clientName, null, auth, anthropic
        );
        if (resolvedSessionDate) {
          await supabase.from("inquiries")
            .update({ session_date: resolvedSessionDate })
            .in("id", allMatchIds);
        }
      }

      if (!alreadyPaid && resolvedSessionDate) {
        await supabase.from("availability").upsert(
          { date: resolvedSessionDate, status: "booked", note: payment.clientName },
          { onConflict: "date" }
        );
        dateBooked = resolvedSessionDate;
      }

      // Update the payment row's session_date if we just found one
      if (resolvedSessionDate && !alreadyRecorded) {
        await supabase.from("payments")
          .update({ session_date: resolvedSessionDate })
          .eq("inquiry_id", primaryInq.id)
          .eq("client_email", payment.clientEmail);
      }

      synced.push({
        name: payment.clientName, email: payment.clientEmail,
        amount: payment.amount, method: payment.method,
        invoice: payment.invoice, paymentType: payment.paymentType,
        paidAt, alreadyPaid, dateBooked, pass: 1, orphan: false,
      });
    } else {
      // No matching inquiry — orphan payment
      if (!alreadyRecorded && payment.clientName.trim()) {
        existingKeys.add(pKey);
        const note = [
          payment.amount && `${payment.method || "Payment"}: ${payment.amount}`,
          payment.invoice && `Invoice ${payment.invoice}`,
        ].filter(Boolean).join(" · ");

        await supabase.from("payments").insert({
          inquiry_id:   null,
          client_name:  payment.clientName,
          client_email: payment.clientEmail,
          amount:       payment.amount,
          amount_cents: parseCents(payment.amount),
          method:       payment.method,
          payment_type: payment.paymentType,
          invoice:      payment.invoice,
          note,
          source:       "orphan",
          paid_at:      paidAt,
          session_date: null,
        });

        synced.push({
          name: payment.clientName, email: payment.clientEmail,
          amount: payment.amount, method: payment.method,
          invoice: payment.invoice, paymentType: payment.paymentType,
          paidAt, alreadyPaid: false, pass: 1, orphan: true,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 2 — Per-client full Gmail sweep for remaining unpaid inquiries
  // ═══════════════════════════════════════════════════════════════════════════

  const clientSweepInquiries = syncMonth ? activeInquiries : unpaid;
  const stillUnpaid = clientSweepInquiries.filter(inq => !markedPaid.has(inq.id));

  for (const inq of stillUnpaid) {
    if (markedPaid.has(inq.id)) continue;

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
    const now = new Date().toISOString();
    const note = [
      result.note,
      result.amount && `${result.amount}`,
      result.method && `via ${result.method}`,
    ].filter(Boolean).join(" · ");

    await supabase.from("inquiries").update({
      payment_status: "paid", payment_note: note,
      payment_detected_at: now, deposit_paid_at: paidAt,
      booking_confirmed: true,
    }).eq("id", inq.id);

    markedPaid.add(inq.id);

    const pKey = paymentKey(inq.name ?? "", inq.email ?? "", result.amount);
    if (!existingKeys.has(pKey)) {
      existingKeys.add(pKey);
      await supabase.from("payments").insert({
        inquiry_id:   inq.id,
        client_name:  inq.name ?? "",
        client_email: inq.email ?? "",
        amount:       result.amount,
        amount_cents: amountCents,
        method:       result.method,
        payment_type: result.paymentType,
        invoice:      "",
        note,
        source:       "pass2",
        paid_at:      paidAt,
        session_date: inq.session_date ?? null,
      });
    }

    // Auto-detect session date from Gmail if not already set
    let resolvedDate = inq.session_date ?? null;
    if (!resolvedDate && inq.email) {
      resolvedDate = await detectSessionDate(
        inq.email, inq.name ?? "", null, auth, anthropic
      );
      if (resolvedDate) {
        await supabase.from("inquiries")
          .update({ session_date: resolvedDate })
          .eq("id", inq.id);
        // Back-fill the payment row we just inserted
        await supabase.from("payments")
          .update({ session_date: resolvedDate })
          .eq("inquiry_id", inq.id)
          .eq("source", "pass2");
      }
    }

    let dateBooked: string | undefined;
    if (resolvedDate) {
      await supabase.from("availability").upsert(
        { date: resolvedDate, status: "booked", note: inq.name },
        { onConflict: "date" }
      );
      dateBooked = resolvedDate;
    }

    synced.push({
      name: inq.name ?? "", email: inq.email ?? "",
      amount: result.amount, method: result.method,
      invoice: "", paymentType: result.paymentType,
      paidAt, alreadyPaid: false, dateBooked, pass: 2, orphan: false,
    });
  }

  return NextResponse.json({ synced, total: synced.length });
}
