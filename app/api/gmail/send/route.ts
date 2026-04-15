// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gmail/send
//
// Sends an email via the authenticated Gmail account.
//
// Request body: { to, subject, body, threadId? }
// Response:     { ok: true, messageId }  |  { error }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";

export const dynamic = "force-dynamic";

function buildRawMessage(
  from: string, to: string, subject: string,
  body: string, threadId?: string
): string {
  const lines = [
    `From: Chris Solorzano <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ...(threadId ? [`References: ${threadId}`, `In-Reply-To: ${threadId}`] : []),
    ``,
    body,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(lines)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { to, subject, body: emailBody, threadId } = body;
  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "to, subject, and body are required." }, { status: 400 });
  }

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json(
      { error: "Gmail is not connected. Connect it in the admin Inquiries tab." },
      { status: 401 }
    );
  }

  const raw = buildRawMessage(tokens.email, to, subject, emailBody, threadId);

  const gmailRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
    }
  );

  if (!gmailRes.ok) {
    const err = await gmailRes.json() as { error?: { message?: string } };
    return NextResponse.json({ error: `Send failed: ${err.error?.message ?? "unknown error"}` }, { status: 500 });
  }

  const result = await gmailRes.json() as { id?: string; threadId?: string };
  return NextResponse.json({ ok: true, messageId: result.id ?? "", threadId: result.threadId ?? "" });
}
