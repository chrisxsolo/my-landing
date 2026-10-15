// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gmail/send
//
// Sends an email via the authenticated Gmail account.
//
// The account's configured signature is appended here. Gmail's web-UI
// signature is NOT added by users.messages.send, so every email this app sent
// previously went out with no signature at all. Because the signature is rich
// HTML, the message is built as multipart/alternative (lib/gmailMime.ts).
//
// Request body: { to, subject, body, threadId?, include_signature? }
// Response:     { ok: true, messageId, threadId, signature_included }  |  { error }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { buildRawMessage } from "@/lib/gmailMime";
import { fetchGmailSignature } from "@/lib/gmailSignature";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { to, subject, body: emailBody, threadId } = body;
  // Opt out for a send that supplies its own sign-off. Defaults to including
  // it, since a client-facing email without one is the bug being fixed.
  const includeSignature = (body as Record<string, unknown>).include_signature !== false;
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

  // Null when there is no signature set, or when the lookup failed. Either way
  // the send proceeds — a signature is not worth losing an email over.
  const signature = includeSignature
    ? await fetchGmailSignature(tokens.access_token)
    : null;

  const raw = buildRawMessage({
    from: tokens.email,
    to,
    subject,
    body: emailBody,
    threadId,
    signature,
  });

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
  return NextResponse.json({
    ok: true,
    messageId: result.id ?? "",
    threadId: result.threadId ?? "",
    signature_included: signature !== null,
  });
}
