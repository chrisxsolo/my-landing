// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sync-payments
//
// Three-pass payment sync with full Gmail access:
//
// Pass 1 — Known payment senders: Searches Pixieset, Venmo, Zelle, PayPal,
//           Cash App notification emails and extracts client info via Claude.
//           Records EVERY payment (deposit 1, deposit 2, etc.) in `payments`.
//           Orphan contacts (no matching inquiry) also get a payment row.
//
// Pass 2 — Per-client sweep: For every unpaid inquiry, searches ALL of Gmail
//           for emails to/from that client and asks Claude if any contains
//           payment evidence. Catches anything Pass 1 misses.
//
// Pass 3 — Orphan sweep: Re-scans Pass 1 emails for payers not matched to any
//           inquiry and inserts them as orphan payment rows with whatever name/
//           email/info Claude can extract.
//
// Returns: { synced: [...], total: number }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };

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

async function fetchMessageContent(id: string, auth: string): Promise<string> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return "";
    const msg = await res.json() as { payload?: MimePart; snippet?: string };
    const { text, html } = extractContent(msg.payload ?? {});
    return text || stripHtml(html) || msg.snippet || "";
  } catch { return ""; }
}

// Pass 1 / Pass 3: extract structured payment info from a known payment notification email
async function extractPaymentFromNotification(content: string, anthropic: Anthropic): Promise<PaymentInfo | null> {
  try {
    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
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
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a payment detection assistant for a photographer named Chris.
Analyze these emails and determine if client "${clientName}" has paid a deposit or session fee.

Payment evidence: Venmo/Zelle/PayPal/Cash App transfer confirmations, client saying "I sent it" / "I paid" / "just sent" / "deposit sent", bank receipts, amount mentions in payment context.

If you find multiple payments (e.g. a first deposit and a second/final payment), report only the MOST RECENT one — the caller will query again for others separately.

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

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const auth = `Bearer ${tokens.access_token}`;
  const anthropic = new Anthropic();

  // ── Load all inquiries upfront ────────────────────────────────────────────
  const supabase = createSupabaseServerClient();
  const { data: allInquiries } = await supabase
    .from("inquiries")
    .select("id, name, email, payment_status, session_date, deposit_paid_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const inquiries = allInquiries ?? [];
  const unpaid = inquiries.filter(inq => inq.payment_status !== "paid");

  // Load existing payment keys to avoid inserting duplicates
  const { data: existingPayments } = await supabase
    .from("payments")
    .select("client_name, client_email, amount");
  const existingKeys = new Set<string>(
    (existingPayments ?? []).map(p => paymentKey(p.client_name, p.client_email, p.amount))
  );

  const markedPaid = new Set<number>();

  const synced: {
    name: string; email: string; amount: string; method: string;
    invoice: string; paymentType: string; alreadyPaid: boolean;
    dateBooked?: string; pass: number; orphan: boolean;
  }[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 1 — Known payment sender notification emails
  // ═══════════════════════════════════════════════════════════════════════════

  const [pixiesetIds, venmoIds, zelleIds, paypalIds, cashIds] = await Promise.all([
    searchMessageIds(`subject:"Payment on the way" "invoice"`, auth, 50),
    searchMessageIds(`from:venmo@venmo.com "paid you"`, auth, 50),
    searchMessageIds(`from:no-reply@zelle.com "sent you"`, auth, 50),
    searchMessageIds(`from:service@paypal.com "sent you"`, auth, 50),
    searchMessageIds(`(from:cash@square.com OR from:no-reply@cash.app) "sent you"`, auth, 50),
  ]);

  const pass1Ids = [...new Set([...pixiesetIds, ...venmoIds, ...zelleIds, ...paypalIds, ...cashIds])];
  const pass1Contents = await Promise.all(pass1Ids.map(id => fetchMessageContent(id, auth)));

  const pass1Payments: PaymentInfo[] = [];
  for (let i = 0; i < pass1Contents.length; i += 5) {
    const batch = pass1Contents.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(c => c ? extractPaymentFromNotification(c, anthropic) : null)
    );
    results.forEach(r => { if (r) pass1Payments.push(r); });
  }

  // Match pass 1 payments to inquiries (allow multiple payments per person)
  for (const payment of pass1Payments) {
    const clientEmail = payment.clientEmail?.toLowerCase();
    const clientName  = payment.clientName?.toLowerCase().trim();

    let matching = clientEmail?.includes("@")
      ? inquiries.filter(inq => inq.email?.toLowerCase() === clientEmail)
      : [];

    if (!matching.length && clientName) {
      const nameParts = clientName.split(" ");
      const firstName = nameParts[0];
      const lastName  = nameParts[nameParts.length - 1];
      const hasLastName = nameParts.length >= 2;
      matching = inquiries.filter(inq => {
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

    if (matching.length) {
      // Known inquiry — update payment_status and insert payment row
      const alreadyPaid = matching.every(inq => inq.payment_status === "paid");
      const note = [
        payment.amount && `${payment.method || "Payment"}: ${payment.amount}`,
        payment.invoice && `Invoice ${payment.invoice}`,
      ].filter(Boolean).join(" · ");

      const now = new Date().toISOString();
      const newlyPaidIds = matching.filter(inq => !markedPaid.has(inq.id) && inq.payment_status !== "paid").map(inq => inq.id);
      const allMatchIds  = matching.map(inq => inq.id);

      await supabase.from("inquiries").update({
        payment_status: "paid", payment_note: note,
        payment_detected_at: now, booking_confirmed: true,
      }).in("id", allMatchIds);

      if (newlyPaidIds.length) {
        await supabase.from("inquiries").update({ deposit_paid_at: now }).in("id", newlyPaidIds);
      }

      allMatchIds.forEach(id => markedPaid.add(id));

      if (!alreadyRecorded) {
        existingKeys.add(pKey);
        await supabase.from("payments").insert({
          inquiry_id:   matching[0].id,
          client_name:  payment.clientName,
          client_email: payment.clientEmail,
          amount:       payment.amount,
          method:       payment.method,
          payment_type: payment.paymentType,
          invoice:      payment.invoice,
          note,
          source:       "pass1",
          paid_at:      now,
        });
      }

      let dateBooked: string | undefined;
      if (!alreadyPaid) {
        const sessionDate = matching.find(inq => inq.session_date)?.session_date;
        if (sessionDate) {
          await supabase.from("availability").upsert(
            { date: sessionDate, status: "booked", note: payment.clientName },
            { onConflict: "date" }
          );
          dateBooked = sessionDate;
        }
      }

      synced.push({
        name: payment.clientName, email: payment.clientEmail,
        amount: payment.amount, method: payment.method,
        invoice: payment.invoice, paymentType: payment.paymentType,
        alreadyPaid, dateBooked, pass: 1, orphan: false,
      });
    } else {
      // No matching inquiry — orphan payment (Pass 3 territory, handled below)
      // Store the payment info for Pass 3 processing
      if (!alreadyRecorded && payment.clientName.trim()) {
        existingKeys.add(pKey);
        const now = new Date().toISOString();
        const note = [
          payment.amount && `${payment.method || "Payment"}: ${payment.amount}`,
          payment.invoice && `Invoice ${payment.invoice}`,
        ].filter(Boolean).join(" · ");

        await supabase.from("payments").insert({
          inquiry_id:   null,
          client_name:  payment.clientName,
          client_email: payment.clientEmail,
          amount:       payment.amount,
          method:       payment.method,
          payment_type: payment.paymentType,
          invoice:      payment.invoice,
          note,
          source:       "orphan",
          paid_at:      now,
        });

        synced.push({
          name: payment.clientName, email: payment.clientEmail,
          amount: payment.amount, method: payment.method,
          invoice: payment.invoice, paymentType: payment.paymentType,
          alreadyPaid: false, pass: 1, orphan: true,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 2 — Per-client full Gmail sweep for remaining unpaid inquiries
  // ═══════════════════════════════════════════════════════════════════════════

  const stillUnpaid = unpaid.filter(inq => !markedPaid.has(inq.id));

  for (let i = 0; i < stillUnpaid.length; i += 3) {
    const batch = stillUnpaid.slice(i, i + 3);

    await Promise.all(batch.map(async inq => {
      if (markedPaid.has(inq.id)) return;

      const [threadIds, paymentMentionIds] = await Promise.all([
        searchMessageIds(`from:${inq.email} OR to:${inq.email}`, auth, 10),
        searchMessageIds(
          `"${inq.name}" (paid OR payment OR deposit OR venmo OR zelle OR "cash app" OR sent)`,
          auth, 5
        ),
      ]);

      const ids = [...new Set([...threadIds, ...paymentMentionIds])].slice(0, 12);
      if (!ids.length) return;

      const bodies = await Promise.all(ids.map(id => fetchMessageContent(id, auth)));
      const context = bodies.filter(Boolean).map((b, idx) => `--- Email ${idx + 1} ---\n${b}`).join("\n\n");
      if (!context) return;

      const result = await detectPaymentForClient(inq.name ?? "", inq.email ?? "", context, anthropic);
      if (!result?.paid) return;

      const now = new Date().toISOString();
      const note = [
        result.note,
        result.amount && `${result.amount}`,
        result.method && `via ${result.method}`,
      ].filter(Boolean).join(" · ");

      await supabase.from("inquiries").update({
        payment_status: "paid", payment_note: note,
        payment_detected_at: now, deposit_paid_at: now,
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
          method:       result.method,
          payment_type: result.paymentType,
          invoice:      "",
          note,
          source:       "pass2",
          paid_at:      now,
        });
      }

      let dateBooked: string | undefined;
      if (inq.session_date) {
        await supabase.from("availability").upsert(
          { date: inq.session_date, status: "booked", note: inq.name },
          { onConflict: "date" }
        );
        dateBooked = inq.session_date;
      }

      synced.push({
        name: inq.name ?? "", email: inq.email ?? "",
        amount: result.amount, method: result.method,
        invoice: "", paymentType: result.paymentType,
        alreadyPaid: false, dateBooked, pass: 2, orphan: false,
      });
    }));
  }

  return NextResponse.json({ synced, total: synced.length });
}
