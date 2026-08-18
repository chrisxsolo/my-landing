// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment-confirmation
//
// Generates a beautiful HTML payment confirmation email for a paid client
// and either previews it or sends it via the photographer's connected Gmail.
//
// Body: { inquiry_id, mode: "preview" | "send" }
// Response (preview): { html: "..." }
// Response (send):    { ok: true }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { buildPaymentConfirmationHtml, wrapPaymentConfirmationShell } from "@/lib/paymentConfirmationEmail";

export const dynamic = "force-dynamic";

function sanitizeHeader(v: string) {
  return v.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded-word for non-ASCII header values (e.g. subjects with emoji). */
function encodeHeader(v: string): string {
  const cleaned = v.replace(/[\r\n]+/g, " ").trim();
  if (!/[^\x20-\x7E]/.test(cleaned)) return cleaned;
  const b64 = btoa(unescape(encodeURIComponent(cleaned)));
  return `=?UTF-8?B?${b64}?=`;
}

/** Parse amount / method / invoice out of the stored payment_note string */
function parseNote(note: string | null) {
  if (!note) return { amount: "", method: "", invoice: "" };
  const amount  = note.match(/\$[\d,.]+/)?.[0] ?? "";
  const method  = note.match(/via ([^·\n]+)/)?.[1]?.trim() ?? "";
  const invoice = note.match(/Invoice (#?\d+)/)?.[1] ?? "";
  return { amount, method, invoice };
}

// ── Gmail email body helpers ──────────────────────────────────────────────────

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

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractBestText(part: MimePart): string {
  let plain = ""; let html = "";
  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !plain)
      plain = decodeBody(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html)
      html = decodeBody(p.body.data);
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return plain || stripHtml(html);
}

function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

/** Normalize any stored/extracted amount into a "$150" / "$150.50" string. */
function formatMoney(raw: string | number | null | undefined): string {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
  const match = text.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) return "";
  const value = Number(match[0]);
  if (!isFinite(value) || value <= 0) return "";
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function formatSessionDate(sessionDate: string): string {
  return new Date(sessionDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

type ThreadDetails = { confirmedDateLabel: string | null; amount: string; method: string };

const THREAD_SCAN_SYSTEM = (today: string, currentYear: number) =>
  `You extract booking facts from the email thread between a photographer (SoloxSnaps) and one client. Today is ${today}. Current year is ${currentYear}.

Confirmed session date:
- Find the ONE date that was most recently agreed upon between the photographer and client
- Prefer dates with confirmation language: "works", "perfect", "see you then", "confirmed", "sounds good", "can't wait"
- A date proposed + positive reply = confirmed
- If multiple dates were discussed, return only the final agreed one
- If only month+day is given, use ${currentYear}. Use ${currentYear + 1} only if the date has already passed.

Deposit actually paid:
- amount: the money this client has already PAID (client says "just sent you $100", a payment confirmation, or the photographer acknowledging "got your $100"). Digits only, e.g. "100" or "100.50".
- method: how they paid — Venmo, Zelle, PayPal, Cash App, Square, Cash — when stated.
- A quoted price, package total, or remaining balance is NOT a payment. Return null for both when no payment amount is clearly stated.

Return ONLY valid JSON, no markdown:
{"date":"YYYY-MM-DD","readable":"Friday, June 20, 2026","amount":"100","method":"Venmo"}
Use null for any field you cannot determine.`;

/** Scan the Gmail thread for the agreed shoot date and the deposit the client
 *  actually paid. Skipped entirely when the caller already has both — a stored
 *  session_date and a ledger amount need no AI pass. */
async function detectThreadDetails(opts: {
  email: string;
  dateInMind: string | null;
  sessionDate: string | null;
  needAmount: boolean;
}): Promise<ThreadDetails> {
  const { email, dateInMind, sessionDate, needAmount } = opts;
  const knownDateLabel = sessionDate ? formatSessionDate(sessionDate) : null;
  const empty: ThreadDetails = { confirmedDateLabel: knownDateLabel ?? dateInMind ?? null, amount: "", method: "" };
  if (knownDateLabel && !needAmount) return empty;

  const tokens = await getValidTokens();
  if (!tokens) return empty;

  const auth = `Bearer ${tokens.access_token}`;
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
    `?q=${encodeURIComponent(`from:${email} OR to:${email}`)}&maxResults=20`,
    { headers: { Authorization: auth } }
  );
  if (!searchRes.ok) return empty;

  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 15);
  if (!ids.length) return empty;

  const bodies = await Promise.all(ids.map(async id => {
    try {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: auth } }
      );
      if (!r.ok) return "";
      const msg = await r.json() as { payload?: MimePart; snippet?: string };
      const text = extractBestText(msg.payload ?? {});
      return (text || msg.snippet || "").slice(0, 2000);
    } catch { return ""; }
  }));

  const emailContext = bodies
    .filter(Boolean)
    .map((b, i) => `--- Email ${i + 1} ---\n${b}`)
    .join("\n\n");

  if (!emailContext) return empty;

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const anthropic = new Anthropic();

  const res = await anthropic.messages.create({
    model:      "claude-haiku-4-5",
    max_tokens: 200,
    system: THREAD_SCAN_SYSTEM(today, currentYear),
    messages: [{
      role: "user",
      content: `Client's original date request: ${dateInMind ?? "not specified"}\n\nEmail thread:\n${emailContext}`,
    }],
  });

  try {
    const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
    const result = JSON.parse(extractJson(raw)) as {
      readable: string | null; amount: string | null; method: string | null;
    };
    return {
      confirmedDateLabel: knownDateLabel ?? result.readable ?? dateInMind ?? null,
      amount: needAmount ? formatMoney(result.amount) : "",
      method: needAmount && typeof result.method === "string" ? result.method.trim().slice(0, 40) : "",
    };
  } catch { /* fall through */ }

  return empty;
}

/** Build an HTML MIME email for the Gmail raw API.
 *
 * Two-level encoding:
 *  1. The HTML body inside the MIME message uses STANDARD base64
 *     (btoa, no replacements) as required by RFC 2045.
 *  2. The entire raw MIME string is then base64URL-encoded for the
 *     Gmail messages.send API (+ → -, / → _, no padding).
 */
function buildRawMimeMessage(opts: {
  from: string; to: string; subject: string; html: string;
}): string {
  const { from, to, subject, html } = opts;

  // ── Step 1: standard base64 for the HTML body (NOT base64url) ────────────
  // btoa produces standard base64 (+, /, =). Do NOT replace those chars here.
  const htmlStdBase64 = btoa(unescape(encodeURIComponent(html)));
  // RFC 2045 §6.8 requires lines ≤76 chars
  const htmlWrapped = (htmlStdBase64.match(/.{1,76}/g) ?? []).join("\r\n");

  const headers = [
    `From: Chris Solorzano <${sanitizeHeader(from)}>`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
  ];

  const rawMime = [...headers, "", htmlWrapped].join("\r\n");

  // ── Step 2: base64URL encode the whole MIME message for Gmail API ─────────
  return btoa(unescape(encodeURIComponent(rawMime)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { inquiry_id: string | number; mode: "preview" | "send"; custom_message?: string; edited_html?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id, mode = "preview", custom_message, edited_html } = body;
  if (!inquiry_id) return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });
  if (edited_html !== undefined && (typeof edited_html !== "string" || !edited_html.trim() || edited_html.length > 500_000)) {
    return NextResponse.json({ error: "edited_html must be a non-empty string under 500KB" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("*")
    .eq("id", inquiry_id)
    .single();

  if (!inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  // A timeline-stamped deposit counts as paid — payment_status only flips once
  // the staged payment is approved in the Payments tab, and the confirmation
  // shouldn't be blocked on ledger review.
  if (inq.payment_status !== "paid" && !inq.deposit_paid_at) {
    return NextResponse.json({ error: "Client has not paid yet" }, { status: 400 });
  }

  let html: string;
  if (mode === "send" && edited_html) {
    // WYSIWYG: the admin edited the preview inline, so send exactly that
    // content re-wrapped in the document shell the preview stripped.
    // custom_message is ignored here — the edited preview is the source of truth.
    html = wrapPaymentConfirmationShell(edited_html);
  } else {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://soloxsnaps.com").replace(/\/+$/, "");

    let { amount, method, invoice } = parseNote(inq.payment_note);
    if (!amount) {
      // payment_note is only written at approval time — before that, pull the
      // amount/method from the ledger row or the pending staged payment.
      const { data: ledgerRow } = await supabase
        .from("payments")
        .select("amount, method, invoice")
        .eq("inquiry_id", inq.id)
        .eq("status", "active")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: stagedRow } = ledgerRow ? { data: null } : await supabase
        .from("payments_staging")
        .select("amount, method, invoice")
        .eq("inquiry_id", inq.id)
        .eq("status", "pending")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = ledgerRow ?? stagedRow;
      if (row) {
        amount = formatMoney(row.amount) || amount;
        method = row.method ?? method;
        invoice = row.invoice ?? invoice;
      }
    }

    // Read the thread for the confirmed date and — when the deposit was only
    // ever detected from email, with no ledger or staged row to read it from —
    // the amount the client actually paid.
    const details = await detectThreadDetails({
      email: inq.email,
      dateInMind: inq.date_in_mind,
      sessionDate: inq.session_date,
      needAmount: !amount,
    });
    const confirmedDateLabel = details.confirmedDateLabel;
    if (!amount && details.amount) {
      amount = details.amount;
      method = method || details.method;
    }

    html = buildPaymentConfirmationHtml({
      name:               inq.name,
      sessionType:        inq.session_type,
      confirmedDateLabel,
      amount, method, invoice,
      siteUrl,
      customMessage: custom_message,
    });
  }

  if (mode === "preview") {
    return NextResponse.json({ html });
  }

  // ── Send via Gmail ─────────────────────────────────────────────────────────
  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const subject = `Payment Confirmed`;
  const raw = buildRawMimeMessage({
    from:    tokens.email,
    to:      inq.email,
    subject,
    html,
  });

  const gmailRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ raw }),
    }
  );

  if (!gmailRes.ok) {
    const err = await gmailRes.json() as { error?: { message?: string } };
    return NextResponse.json({ error: `Send failed: ${err.error?.message ?? "unknown error"}` }, { status: 500 });
  }

  // Mark that confirmation was sent. The confirmation IS an outbound reply —
  // clear needs_reply and stamp the outbound state immediately instead of
  // waiting for the next Gmail reconciliation.
  const sentAt = new Date().toISOString();
  await supabase.from("inquiries").update({
    status: "responded",
    confirmation_sent_at: sentAt,
    needs_reply: false,
    last_outbound_at: sentAt,
    last_message_at: sentAt,
    last_message_direction: "outbound",
  }).eq("id", inq.id);

  return NextResponse.json({ ok: true });
}
