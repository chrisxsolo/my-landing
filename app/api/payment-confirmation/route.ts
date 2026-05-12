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
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

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

function buildHtml(opts: {
  name: string;
  sessionType: string | null;
  dateInMind: string | null;
  sessionDate: string | null;
  amount: string;
  method: string;
  invoice: string;
  guideUrl: string;
  customMessage?: string;
}) {
  const { name, sessionType, dateInMind, sessionDate, amount, method, invoice, guideUrl, customMessage } = opts;
  const safeName    = escapeHtml(name);
  const safeGuide   = escapeHtml(guideUrl);

  const sessionRow  = sessionType
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Session</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">${escapeHtml(sessionType)}</td>
       </tr>`
    : "";

  const confirmedDate = sessionDate
    ? new Date(sessionDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : null;

  const dateRow = (confirmedDate || dateInMind)
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Date</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;font-weight:${confirmedDate ? "700" : "400"};">${escapeHtml(confirmedDate ?? dateInMind ?? "")}</td>
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
    If you have any questions before shoot day, just reply to this email — I'm always happy to help. See you soon!
  </p>

  <!-- Footer -->
  <p style="font-size:13px;line-height:1.6;color:#6a716f;border-top:1px solid rgba(17,21,19,0.1);padding-top:20px;margin:0;">
    <strong style="color:#111513;">Chris · soloxsnaps</strong><br>
    <a href="https://soloxsnaps.com" style="color:#6a716f;text-decoration:none;">soloxsnaps.com</a>
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

  const html = buildHtml({
    name:          inq.name,
    sessionType:   inq.session_type,
    dateInMind:    inq.date_in_mind,
    sessionDate:   inq.session_date,
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
