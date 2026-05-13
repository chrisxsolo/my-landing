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

export const dynamic = "force-dynamic";

const CHRIS_PHONE = "(408) 722-7680";

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sanitizeHeader(v: string) {
  return v.replace(/[\r\n]+/g, " ").trim();
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

/** Scan the Gmail thread and return the single most-recently-agreed date.
 *  Returns a formatted readable string like "Friday, June 20, 2026", or null. */
async function detectConfirmedDate(
  email: string,
  dateInMind: string | null,
  sessionDate: string | null,
): Promise<string | null> {
  // If there's already a confirmed session_date set, format and use it
  if (sessionDate) {
    return new Date(sessionDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  const tokens = await getValidTokens();
  if (!tokens) return dateInMind ?? null;

  const auth = `Bearer ${tokens.access_token}`;
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
    `?q=${encodeURIComponent(`from:${email} OR to:${email}`)}&maxResults=20`,
    { headers: { Authorization: auth } }
  );
  if (!searchRes.ok) return dateInMind ?? null;

  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 15);
  if (!ids.length) return dateInMind ?? null;

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

  if (!emailContext) return dateInMind ?? null;

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const anthropic = new Anthropic();

  const res = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 150,
    system: `You extract the single confirmed photography session date from an email thread. Today is ${today}. Current year is ${currentYear}.

Rules:
- Find the ONE date that was most recently agreed upon between the photographer and client
- Prefer dates with confirmation language: "works", "perfect", "see you then", "confirmed", "sounds good", "can't wait"
- A date proposed + positive reply = confirmed
- If multiple dates were discussed, return only the final agreed one
- If only month+day is given, use ${currentYear}. Use ${currentYear + 1} only if the date has already passed.
- Return ONLY valid JSON, no markdown: {"date":"YYYY-MM-DD","readable":"Friday, June 20, 2026"}
- If no date found: {"date":null,"readable":null}`,
    messages: [{
      role: "user",
      content: `Client's original date request: ${dateInMind ?? "not specified"}\n\nEmail thread:\n${emailContext}`,
    }],
  });

  try {
    const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
    const result = JSON.parse(extractJson(raw)) as { date: string | null; readable: string | null };
    if (result.readable) return result.readable;
  } catch { /* fall through */ }

  return dateInMind ?? null;
}

function buildHtml(opts: {
  name: string;
  sessionType: string | null;
  confirmedDateLabel: string | null;
  amount: string;
  method: string;
  invoice: string;
  guideUrl: string;
  customMessage?: string;
}) {
  const { name, sessionType, confirmedDateLabel, amount, method, invoice, guideUrl, customMessage } = opts;
  const safeName    = escapeHtml(name);
  const safeGuide   = escapeHtml(guideUrl);

  const sessionRow  = sessionType
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Session</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">${escapeHtml(sessionType)}</td>
       </tr>`
    : "";

  const dateRow = confirmedDateLabel
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Date</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;font-weight:700;">${escapeHtml(confirmedDateLabel)}</td>
       </tr>`
    : "";

  const invoiceRow = invoice
    ? `<tr>
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Invoice</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">${escapeHtml(invoice)}</td>
       </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f0;">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:48px 28px;background:#ffffff;color:#111513;">

  <!-- Eyebrow -->
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#059669;margin:0 0 20px;">
    soloxsnaps &nbsp;·&nbsp; Booking Confirmed ✓
  </p>

  <!-- Headline -->
  <h1 style="font-size:34px;line-height:1.05;color:#111513;margin:0 0 16px;font-weight:800;">
    You're all set, ${safeName}! 🎓
  </h1>

  <!-- Intro -->
  <p style="font-size:16px;line-height:1.75;color:#303635;margin:0 0 28px;">
    I received your payment — thank you so much! Your session is officially booked and I can't wait to capture this milestone with you.
  </p>

  <!-- Payment banner -->
  <div style="background:linear-gradient(135deg,#10b981,#047857);border-radius:14px;padding:24px 28px;margin:0 0 28px;">
    <p style="color:rgba(255,255,255,.75);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px;">
      Payment Received
    </p>
    <p style="color:#ffffff;font-size:30px;font-weight:800;margin:0 0 4px;line-height:1;">
      ${escapeHtml(amount || "Deposit")}
    </p>
    ${method ? `<p style="color:rgba(255,255,255,.8);font-size:14px;margin:6px 0 0;">via ${escapeHtml(method)}</p>` : ""}
  </div>

  <!-- Session details -->
  ${(sessionRow || dateRow) ? `
  <div style="border:1px solid rgba(17,21,19,0.1);border-radius:10px;padding:22px 24px;margin:0 0 28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111513;margin:0 0 14px;">
      Session Details
    </p>
    <table style="width:100%;border-collapse:collapse;">
      ${sessionRow}${dateRow}${invoiceRow}
    </table>
  </div>
  ` : ""}

  <!-- Graduation guide CTA -->
  <div style="border:1px solid rgba(17,21,19,0.1);border-radius:10px;padding:24px;background:#f7f8f5;margin:0 0 28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111513;margin:0 0 10px;">
      Prepare for your session
    </p>
    <p style="font-size:15px;line-height:1.7;color:#303635;margin:0 0 20px;">
      My graduation guide covers everything — what to wear, posing tips, how to make the most of golden hour, and all the iconic spots we can hit. Refer back to it any time before shoot day.
    </p>
    <a href="${safeGuide}"
       style="display:inline-block;background:#111513;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 20px;font-size:13px;font-weight:700;letter-spacing:.02em;">
      Open the graduation guide →
    </a>
  </div>

  ${customMessage ? `
  <!-- Custom note from Chris -->
  <div style="border-left:3px solid #10b981;padding:14px 18px;margin:0 0 28px;background:rgba(16,185,129,0.04);">
    <p style="font-size:15px;line-height:1.75;color:#303635;margin:0;white-space:pre-wrap;">${escapeHtml(customMessage)}</p>
  </div>
  ` : ""}

  <!-- Sign-off -->
  <p style="font-size:15px;line-height:1.75;color:#303635;margin:0 0 28px;">
    If you need to reach me before shoot day, feel free to text or call: <strong style="color:#111513;">${CHRIS_PHONE}</strong>. Otherwise just reply to this email — I'm always happy to help. See you soon!
  </p>

  <!-- Footer -->
  <p style="font-size:13px;line-height:1.6;color:#6a716f;border-top:1px solid rgba(17,21,19,0.1);padding-top:20px;margin:0;">
    <strong style="color:#111513;">Chris · soloxsnaps</strong><br>
    <a href="https://soloxsnaps.com" style="color:#6a716f;text-decoration:none;">soloxsnaps.com</a>
    &nbsp;·&nbsp; ${CHRIS_PHONE}
  </p>

</div>
</body>
</html>`;
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
  from: string; to: string; subject: string;
  html: string; threadId?: string;
}): string {
  const { from, to, subject, html, threadId } = opts;

  // ── Step 1: standard base64 for the HTML body (NOT base64url) ────────────
  // btoa produces standard base64 (+, /, =). Do NOT replace those chars here.
  const htmlStdBase64 = btoa(unescape(encodeURIComponent(html)));
  // RFC 2045 §6.8 requires lines ≤76 chars
  const htmlWrapped = (htmlStdBase64.match(/.{1,76}/g) ?? []).join("\r\n");

  const headers = [
    `From: Chris Solorzano <${sanitizeHeader(from)}>`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ...(threadId
      ? [`References: ${sanitizeHeader(threadId)}`, `In-Reply-To: ${sanitizeHeader(threadId)}`]
      : []),
  ];

  const rawMime = [...headers, "", htmlWrapped].join("\r\n");

  // ── Step 2: base64URL encode the whole MIME message for Gmail API ─────────
  return btoa(unescape(encodeURIComponent(rawMime)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { inquiry_id: string | number; mode: "preview" | "send"; thread_id?: string; custom_message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id, mode = "preview", thread_id, custom_message } = body;
  if (!inquiry_id) return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("*")
    .eq("id", inquiry_id)
    .single();

  if (!inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  if (inq.payment_status !== "paid") {
    return NextResponse.json({ error: "Client has not paid yet" }, { status: 400 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://soloxsnaps.com").replace(/\/+$/, "");
  const guideUrl = `${siteUrl}/grad-guide`;

  const { amount, method, invoice } = parseNote(inq.payment_note);

  // Use AI to pick the single confirmed date from the email thread
  const confirmedDateLabel = await detectConfirmedDate(
    inq.email,
    inq.date_in_mind,
    inq.session_date,
  );

  const html = buildHtml({
    name:               inq.name,
    sessionType:        inq.session_type,
    confirmedDateLabel,
    amount, method, invoice,
    guideUrl,
    customMessage: custom_message,
  });

  if (mode === "preview") {
    return NextResponse.json({ html });
  }

  // ── Send via Gmail ─────────────────────────────────────────────────────────
  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const subject = `Your ${inq.session_type ?? "session"} is confirmed! 🎓`;
  const raw = buildRawMimeMessage({
    from:     tokens.email,
    to:       inq.email,
    subject,
    html,
    threadId: thread_id,
  });

  const gmailRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ raw, ...(thread_id ? { threadId: thread_id } : {}) }),
    }
  );

  if (!gmailRes.ok) {
    const err = await gmailRes.json() as { error?: { message?: string } };
    return NextResponse.json({ error: `Send failed: ${err.error?.message ?? "unknown error"}` }, { status: 500 });
  }

  // Mark that confirmation was sent
  await supabase.from("inquiries").update({ status: "responded", confirmation_sent_at: new Date().toISOString() }).eq("id", inq.id);

  return NextResponse.json({ ok: true });
}
