// GET /api/admin/client-notes?email=...
//
// Searches Gmail for threads with a client email, then uses Claude to extract
// actionable session notes (preferences, constraints, special requests, etc.).

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected — connect Gmail first in Settings" }, { status: 400 });

  const auth = `Bearer ${tokens.access_token}`;

  // Step 1: find threads with this client (1 API call)
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads` +
    `?q=${encodeURIComponent(`from:${email} OR to:${email}`)}` +
    `&maxResults=15`,
    { headers: { Authorization: auth } }
  );

  if (!searchRes.ok) {
    console.error("[client-notes] Gmail search failed", await searchRes.text());
    return NextResponse.json({ error: "Gmail search failed" }, { status: 500 });
  }

  const searchData = await searchRes.json() as { threads?: { id: string }[] };
  const threadIds = (searchData.threads ?? []).map(t => t.id);

  if (!threadIds.length) return NextResponse.json({ notes: "" });

  // Step 2: fetch metadata + snippets for each thread
  const threadResults = await Promise.all(
    threadIds.slice(0, 10).map(async (threadId) => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}` +
          `?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: auth } }
        );
        if (!r.ok) return null;
        return await r.json() as {
          messages: {
            id: string;
            snippet?: string;
            internalDate?: string;
            labelIds?: string[];
            payload?: { headers?: { name: string; value: string }[] };
          }[];
        };
      } catch { return null; }
    })
  );

  // Build snippet list from all messages, oldest first
  const lines: string[] = [];
  const myEmail = tokens.email?.toLowerCase() ?? "";

  for (const thread of threadResults) {
    if (!thread?.messages) continue;
    for (const msg of thread.messages) {
      if (msg.labelIds?.includes("DRAFT")) continue;
      const snippet = msg.snippet?.trim();
      if (!snippet) continue;
      const from = msg.payload?.headers?.find(h => h.name.toLowerCase() === "from")?.value ?? "";
      const subject = msg.payload?.headers?.find(h => h.name.toLowerCase() === "subject")?.value ?? "";
      const isMe = myEmail && from.toLowerCase().includes(myEmail);
      lines.push(`[${isMe ? "Chris" : "Client"}] ${subject ? `(${subject}) ` : ""}${snippet}`);
    }
  }

  if (!lines.length) return NextResponse.json({ notes: "" });

  // Step 3: ask Claude to extract relevant session notes
  const anthropic = new Anthropic();

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You help a photographer (Chris at soloxsnaps.com) extract practical session notes from email snippets with a client. Focus on: session type/details, location preferences, scheduling constraints, special requests, number of people, event context, or anything actionable. Use concise bullet points. If nothing relevant exists, return an empty string. Do not add headers or preamble.`,
      messages: [
        {
          role: "user",
          content: `Extract key session notes from these email snippets with ${email}:\n\n${lines.join("\n")}`,
        },
      ],
    });

    const notes = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[client-notes] Claude error", err);
    return NextResponse.json({ error: "AI request failed — try again" }, { status: 500 });
  }
}
