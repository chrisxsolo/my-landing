// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/message?id=MESSAGE_ID
//
// Fetches the full plain-text body of a single message on demand.
// Called when the user expands a message in the conversation view.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";

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

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 });

  const msg = await res.json() as { payload?: MimePart };
  const body = extractText(msg.payload ?? {});

  return NextResponse.json({ body });
}
