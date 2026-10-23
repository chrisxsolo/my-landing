// Session facts from the client's email conversation (spec §7.4 Section 1).
//
//   POST  read the client's Gmail conversation live and extract facts
//   GET   has the conversation moved since the last extraction? (metadata only)
//
// Gmail tokens stay server-side — nothing in either response carries a token,
// a raw email body, or a message beyond the short excerpt that evidences a
// single extracted fact.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { getValidTokens } from "@/lib/gmailTokens";
import { getConnectedAccountEmails } from "@/lib/inquiryReconcileGmail";
import { checkForNewMessages, runEmailFactExtraction } from "@/lib/contentEngine/emailFacts/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GMAIL_NOT_CONNECTED = "Gmail is not connected — connect it in Settings first";

async function gmailAuth() {
  const tokens = await getValidTokens();
  if (!tokens) return null;
  const auth = `Bearer ${tokens.access_token}`;
  return { auth, connectedEmails: await getConnectedAccountEmails(auth, tokens.email) };
}

function sessionIdFrom(id: string): string | null {
  return isUuid(id) ? id.toLowerCase() : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id } = await params;
  const sessionId = sessionIdFrom(id);
  if (!sessionId) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { threadId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {}; // no body is the ordinary case — let the server pick the thread
  }
  const threadId = typeof body.threadId === "string" && body.threadId ? body.threadId : null;

  const gmail = await gmailAuth();
  if (!gmail) return NextResponse.json({ error: GMAIL_NOT_CONNECTED }, { status: 400 });

  try {
    const result = await runEmailFactExtraction({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
      auth: gmail.auth,
      connectedEmails: gmail.connectedEmails,
      sessionId,
      threadId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "fact extraction failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (/session not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    // Ids and the failure only — a client's correspondence never reaches a log.
    console.error(`[email-facts] extraction failed for session ${sessionId}: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id } = await params;
  const sessionId = sessionIdFrom(id);
  if (!sessionId) return NextResponse.json({ error: "session id must be a uuid" }, { status: 400 });

  const gmail = await gmailAuth();
  if (!gmail) return NextResponse.json({ outcome: "unavailable" });

  try {
    return NextResponse.json(await checkForNewMessages({
      client: createSupabaseAdminClient(), auth: gmail.auth, sessionId,
    }));
  } catch {
    // Best-effort indicator: the workspace works fine without it.
    return NextResponse.json({ outcome: "unavailable" });
  }
}
