// ─────────────────────────────────────────────────────────────────────────────
// POST /api/check-payment
//
// Scans Gmail for payment evidence for a given client, then uses Claude to
// decide whether payment has been received.
//
// Body: { inquiry_id, email, name, date_in_mind?, session_date? }
//   session_date: YYYY-MM-DD — if payment found, marks that date as "booked"
//
// Response: { paid, note, session_date_booked }  |  { error }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

// ── Gmail helpers ─────────────────────────────────────────────────────────────

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

function extractText(part: MimePart): string {
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data);
  if (part.parts) {
    for (const child of part.parts) {
      const t = extractText(child);
      if (t) return t;
    }
  }
  return "";
}

async function fetchMessageBody(id: string, auth: string): Promise<string> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return "";
    const msg = await res.json() as { payload?: MimePart };
    return extractText(msg.payload ?? {}).slice(0, 1200);
  } catch { return ""; }
}

// Search Gmail threads matching a query, return up to maxResults message IDs
async function searchMessageIds(query: string, auth: string, maxResults = 5): Promise<string[]> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
    `?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: auth } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { messages?: { id: string }[] };
  return (data.messages ?? []).map(m => m.id);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id, email, name, session_date } = body;
  if (!inquiry_id || !email || !name) {
    return NextResponse.json({ error: "inquiry_id, email, and name are required" }, { status: 400 });
  }

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const auth = `Bearer ${tokens.access_token}`;

  // ── 1. Fetch conversation thread with the client ──────────────────────────
  const clientThreadIds = await searchMessageIds(
    `from:${email} OR to:${email}`, auth, 8
  );

  // ── 2. Search for payment notification emails mentioning the client name ───
  // Venmo, Zelle, PayPal, Cash App, Apple Pay all send confirmation emails
  const firstName = name.split(" ")[0];
  const paymentThreadIds = await searchMessageIds(
    `(from:venmo@venmo.com OR from:service@paypal.com OR from:no-reply@zelle.com ` +
    `OR from:cash@square.com OR from:no-reply@cash.app OR subject:paid OR subject:payment OR subject:deposit) ` +
    `"${firstName}"`,
    auth, 5
  );

  const allIds = [...new Set([...clientThreadIds, ...paymentThreadIds])].slice(0, 10);

  // ── 3. Load message bodies in parallel ────────────────────────────────────
  const bodies = await Promise.all(allIds.map(id => fetchMessageBody(id, auth)));
  const emailContext = bodies
    .map((b, i) => b ? `--- Email ${i + 1} ---\n${b}` : null)
    .filter(Boolean)
    .join("\n\n");

  if (!emailContext) {
    return NextResponse.json({
      paid: false,
      note: "No emails found to analyze.",
      session_date_booked: false,
    });
  }

  // ── 4. Ask Claude to determine payment status ──────────────────────────────
  const anthropic = new Anthropic();
  const claudeRes = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You are a payment detection assistant for a photographer named Chris.
Analyze the provided emails and determine if client "${name}" has paid a deposit or session fee.

Payment evidence includes:
- Venmo/Zelle/PayPal/Cash App/Apple Pay transfer notifications
- Client saying "I sent it", "I paid", "payment sent", "just paid", "deposit sent"
- Bank transfer receipts or payment confirmations
- Amount mentions ($, dollars) in payment context

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "paid": true or false,
  "amount": "e.g. $200" or null,
  "method": "e.g. Venmo" or null,
  "note": "Short 1-sentence summary of what you found, or 'No payment evidence found'"
}`,
    messages: [{
      role: "user",
      content: `Client name: ${name}\nClient email: ${email}\n\nEmails to analyze:\n\n${emailContext}`,
    }],
  });

  let result: { paid: boolean; amount: string | null; method: string | null; note: string };
  try {
    const text = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "{}";
    result = JSON.parse(text);
  } catch {
    result = { paid: false, amount: null, method: null, note: "Could not parse payment status." };
  }

  // ── 5. Update inquiry in database ─────────────────────────────────────────
  const supabase = createSupabaseServerClient();
  const paymentNote = [result.note, result.amount, result.method]
    .filter(Boolean)
    .join(" · ");

  if (result.paid) {
    await supabase.from("inquiries").update({
      payment_status:      "paid",
      payment_note:        paymentNote,
      payment_detected_at: new Date().toISOString(),
      booking_confirmed:   true,
      ...(session_date ? { session_date } : {}),
    }).eq("id", inquiry_id);
  } else {
    // Still record that we checked, even if no payment found
    await supabase.from("inquiries").update({
      payment_note:        paymentNote || "No payment evidence found",
    }).eq("id", inquiry_id);
  }

  // ── 6. Mark availability date as booked if session_date provided ──────────
  let session_date_booked = false;
  if (result.paid && session_date) {
    const { error } = await supabase.from("availability").upsert(
      { date: session_date, status: "booked", note: `Booked — ${name}` },
      { onConflict: "date" }
    );
    session_date_booked = !error;
  }

  return NextResponse.json({
    paid:               result.paid,
    amount:             result.amount,
    method:             result.method,
    note:               paymentNote,
    session_date_booked,
  });
}
