// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sync-payments
//
// Scans Gmail for Pixieset payment notification emails, uses Claude to extract
// client info from the HTML email body, and marks matching inquiries as paid.
//
// Returns: { synced: [{ name, email, amount, method }], total: number }
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

// Extract text from MIME, preferring plain text but falling back to HTML (stripped)
function extractContent(part: MimePart): { text: string; html: string } {
  let text = "";
  let html  = "";

  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !text) {
      text = decodeBody(p.body.data);
    } else if (p.mimeType === "text/html" && p.body?.data && !html) {
      html = decodeBody(p.body.data);
    }
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return { text, html };
}

// Strip HTML tags and collapse whitespace for Claude to read
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
  clientEmail: string;
  clientName:  string;
  amount:      string;
  method:      string;
  invoice:     string;
};

// Use Claude to reliably extract payment info from the email content
async function extractWithClaude(emailContent: string, anthropic: Anthropic): Promise<PaymentInfo | null> {
  try {
    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `Extract payment info from this Pixieset invoice notification email.
Respond ONLY with valid JSON, no markdown:
{"clientEmail":"","clientName":"","amount":"","method":"","invoice":""}
Use empty string if a field is not found. clientEmail must be a valid email address.`,
      messages: [{ role: "user", content: emailContent.slice(0, 3000) }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    // Strip any accidental markdown fences
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/,"");
    const parsed = JSON.parse(jsonStr) as PaymentInfo;
    if (!parsed.clientEmail?.includes("@")) return null;
    return parsed;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const auth = `Bearer ${tokens.access_token}`;

  // ── 1. Search Gmail for Pixieset payment emails ───────────────────────────
  const query = `subject:"Payment on the way" "invoice"`;
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
    `?q=${encodeURIComponent(query)}&maxResults=50`,
    { headers: { Authorization: auth } }
  );

  if (!searchRes.ok) {
    return NextResponse.json({ error: "Gmail search failed" }, { status: 500 });
  }

  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const messageIds = (searchData.messages ?? []).map(m => m.id);

  if (!messageIds.length) {
    return NextResponse.json({ synced: [], total: 0, message: "No Pixieset payment emails found in Gmail." });
  }

  // ── 2. Fetch full message content (text + HTML) ───────────────────────────
  const rawEmails = await Promise.all(
    messageIds.map(async id => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: auth } }
        );
        if (!res.ok) return null;
        const msg = await res.json() as { payload?: MimePart; snippet?: string };
        const { text, html } = extractContent(msg.payload ?? {});
        // Prefer plain text; fall back to HTML-stripped; last resort: snippet
        const content = text || stripHtml(html) || msg.snippet || "";
        return content || null;
      } catch { return null; }
    })
  );

  // ── 3. Use Claude to extract payment info from each email ─────────────────
  const anthropic = new Anthropic();

  const payments: PaymentInfo[] = [];
  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < rawEmails.length; i += 5) {
    const batch = rawEmails.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(content => content ? extractWithClaude(content, anthropic) : null)
    );
    results.forEach(r => { if (r) payments.push(r); });
  }

  if (!payments.length) {
    return NextResponse.json({
      synced: [], total: 0,
      message: `Found ${messageIds.length} email${messageIds.length === 1 ? "" : "s"} but could not extract payment info. Check that the emails contain client name and email.`,
    });
  }

  // Deduplicate by client email (most recent payment wins, already first in list)
  const seen = new Set<string>();
  const unique = payments.filter(p => {
    const key = p.clientEmail.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── 4. Match to inquiries and update ─────────────────────────────────────
  const supabase = createSupabaseServerClient();
  const emails = unique.map(p => p.clientEmail.toLowerCase());

  // Fetch all inquiries whose email matches — include session_date for auto-blocking
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, email, payment_status, session_date")
    .in("email", emails);

  const synced: { name: string; email: string; amount: string; method: string; invoice: string; alreadyPaid: boolean; dateBooked?: string }[] = [];

  await Promise.all(
    unique.map(async payment => {
      const clientEmail = payment.clientEmail.toLowerCase();
      const matching = (inquiries ?? []).filter(
        inq => inq.email.toLowerCase() === clientEmail
      );
      if (!matching.length) return; // no inquiry found for this client

      const alreadyPaid = matching.every(inq => inq.payment_status === "paid");
      const note = [
        `Pixieset: ${payment.amount}`,
        payment.method  && `via ${payment.method}`,
        payment.invoice && `Invoice ${payment.invoice}`,
      ].filter(Boolean).join(" · ");

      await supabase
        .from("inquiries")
        .update({
          payment_status:      "paid",
          payment_note:        note,
          payment_detected_at: new Date().toISOString(),
          booking_confirmed:   true,
        })
        .in("id", matching.map(inq => inq.id));

      // Auto-block the session date on the availability calendar for new payments
      let dateBooked: string | undefined;
      if (!alreadyPaid) {
        const sessionDate = matching.find(inq => inq.session_date)?.session_date;
        if (sessionDate) {
          await supabase
            .from("availability")
            .upsert(
              { date: sessionDate, status: "booked", note: payment.clientName },
              { onConflict: "date" }
            );
          dateBooked = sessionDate;
        }
      }

      synced.push({
        name:       payment.clientName,
        email:      payment.clientEmail,
        amount:     payment.amount,
        method:     payment.method,
        invoice:    payment.invoice,
        alreadyPaid,
        dateBooked,
      });
    })
  );

  return NextResponse.json({ synced, total: synced.length });
}
