// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/similar-sent?query=confirmation+deposit
//
// Searches Chris's Sent folder for emails matching a query (e.g. keywords
// that describe the email type: "confirmation deposit contract meeting point").
// Returns up to 3 real sent email bodies to use as tone/style examples when
// polishing a draft.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type MimePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: MimePart[];
};

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

function extractText(part: MimePart): string {
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data);
  if (part.parts) {
    for (const child of part.parts) {
      const t = extractText(child);
      if (t) return t;
    }
  }
  return "";
}

// Strip quoted reply blocks so we only return the top-level sent text
function stripQuotedReply(text: string): string {
  return text
    .replace(/\n?>?\s*On .+wrote:\n[\s\S]*/i, "")
    .replace(/\n-{3,}[\s\S]*/g, "")
    .replace(/\n_{3,}[\s\S]*/g, "")
    .trim();
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const query = req.nextUrl.searchParams.get("query");
  if (!query) return NextResponse.json({ examples: [] });

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ examples: [], error: "Gmail not connected" });

  const auth = `Bearer ${tokens.access_token}`;

  // Search Sent folder for messages matching the query
  const searchQ = encodeURIComponent(`in:sent ${query}`);
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQ}&maxResults=8`,
    { headers: { Authorization: auth } }
  );

  if (!searchRes.ok) return NextResponse.json({ examples: [] });

  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const msgIds = (searchData.messages ?? []).map(m => m.id);
  if (!msgIds.length) return NextResponse.json({ examples: [] });

  // Fetch full bodies for up to 5 candidates, keep first 3 that have real content
  const bodies = await Promise.all(
    msgIds.slice(0, 5).map(async id => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: auth } }
        );
        if (!r.ok) return null;
        const msg = await r.json() as { payload?: MimePart };
        const raw = extractText(msg.payload ?? {});
        const cleaned = stripQuotedReply(raw).slice(0, 1200).trim();
        return cleaned.length > 50 ? cleaned : null;
      } catch { return null; }
    })
  );

  const examples = bodies.filter((b): b is string => b !== null).slice(0, 3);

  return NextResponse.json({ examples });
}
