// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/thread?email=client@example.com
//
// Uses the Gmail THREADS endpoint — a conversation with one client is typically
// 1–3 threads, so this is 2–4 total API calls instead of 20+.
//
// Step 1: search threads by email address (1 call)
// Step 2: fetch each thread with format=metadata (1 call per thread, usually 1–3)
//
// Bodies are NOT included — fetched on demand via /api/gmail/message.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";

export const dynamic = "force-dynamic";

export type GmailMessage = {
  id:        string;
  threadId:  string;
  from:      string;
  fromName:  string;
  to:        string;
  subject:   string;
  date:      string;
  timestamp: number;
  snippet:   string;
  isMe:      boolean;
};

function parseName(from: string): string {
  const m = from.match(/^([^<]+)</);
  return m ? m[1].trim().replace(/^"|"$/g, "") : from.split("@")[0];
}

export async function GET(req: NextRequest) {
  const clientEmail = req.nextUrl.searchParams.get("email");
  if (!clientEmail) return NextResponse.json({ error: "email required" }, { status: 400 });

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ messages: [], myEmail: "", error: "Gmail not connected" });

  const auth = `Bearer ${tokens.access_token}`;

  // ── Step 1: find threads with this exact address (1 API call) ─────────────
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads` +
    `?q=${encodeURIComponent(`from:${clientEmail} OR to:${clientEmail}`)}` +
    `&maxResults=10`,
    { headers: { Authorization: auth } }
  );

  if (!searchRes.ok) return NextResponse.json({ messages: [], myEmail: tokens.email });

  const searchData = await searchRes.json() as { threads?: { id: string }[] };
  const threadIds  = (searchData.threads ?? []).map(t => t.id);

  if (!threadIds.length) return NextResponse.json({ messages: [], myEmail: tokens.email });

  // ── Step 2: fetch each thread with metadata only (1–3 API calls total) ────
  const threadResults = await Promise.all(
    threadIds.map(async threadId => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}` +
          `?format=metadata&metadataHeaders=From,To,Subject,Date`,
          { headers: { Authorization: auth } }
        );
        if (!r.ok) return null;
        return await r.json() as {
          id: string;
          messages: {
            id: string; threadId: string; internalDate?: string; snippet?: string;
            payload?: { headers?: { name: string; value: string }[] };
          }[];
        };
      } catch { return null; }
    })
  );

  // ── Flatten all messages from all threads, dedupe, sort oldest-first ───────
  const seen = new Set<string>();
  const messages: GmailMessage[] = [];

  for (const thread of threadResults) {
    if (!thread) continue;
    for (const msg of thread.messages ?? []) {
      if (seen.has(msg.id)) continue;
      seen.add(msg.id);

      const headers  = msg.payload?.headers ?? [];
      const h = (n: string) =>
        headers.find(x => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      const from = h("From");

      messages.push({
        id:        msg.id,
        threadId:  msg.threadId,
        from,
        fromName:  parseName(from),
        to:        h("To"),
        subject:   h("Subject"),
        date:      h("Date"),
        timestamp: parseInt(msg.internalDate ?? "0"),
        snippet:   msg.snippet ?? "",
        isMe:      from.toLowerCase().includes(tokens.email.toLowerCase()),
      });
    }
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);

  return NextResponse.json({ messages, myEmail: tokens.email });
}
