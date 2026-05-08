// POST /api/send-email
// Sends an email from soloxsnaps@gmail.com via the Gmail API.
// Body: { to, subject, body }

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

function buildRawMessage(to: string, subject: string, body: string, fromEmail: string): string {
  const lines = [
    `From: Chris Solorzano <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ];
  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { to: string; subject: string; body: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { to, subject, body: emailBody } = body;
  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }

  const raw = buildRawMessage(to, subject, emailBody, tokens.email);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "Gmail send failed", detail: err }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
