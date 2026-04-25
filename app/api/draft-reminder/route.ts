// ─────────────────────────────────────────────────────────────────────────────
// POST /api/draft-reminder
//
// Generates a day-before session reminder email draft.
// Uses the inquiry's session_date + email history to pull time & location.
//
// Body:     { inquiry_id }
// Response: { subject, draft }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { inquiry_id: string | number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id } = body;
  if (!inquiry_id) return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("*")
    .eq("id", inquiry_id)
    .single();

  if (!inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });

  // Format the session date as a readable string
  const sessionDateReadable = inq.session_date
    ? new Date(inq.session_date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : inq.date_in_mind ?? "tomorrow";

  // ── Fetch email thread for time + location context ────────────────────────
  let emailContext = "";
  const tokens = await getValidTokens();
  if (tokens) {
    const auth = `Bearer ${tokens.access_token}`;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(`from:${inq.email} OR to:${inq.email}`)}&maxResults=8`,
      { headers: { Authorization: auth } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json() as { messages?: { id: string }[] };
      const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 6);
      const bodies = await Promise.all(ids.map(async id => {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
            { headers: { Authorization: auth } }
          );
          if (!r.ok) return "";
          const msg = await r.json() as { payload?: MimePart };
          return extractText(msg.payload ?? {}).slice(0, 700);
        } catch { return ""; }
      }));
      emailContext = bodies.filter(Boolean).map((b, i) => `--- Email ${i + 1} ---\n${b}`).join("\n\n");
    }
  }

  // ── Ask Claude to write the reminder ─────────────────────────────────────
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 400,
    system: `You are writing a casual, warm day-before reminder text from Chris (a photographer at soloxsnaps) to a photography client.

Tone: friendly, excited, personal — like a text from a friend.
Length: short (4–6 sentences max).
Format: plain text, no bullet points, no markdown.

From the email history, extract:
- Session time (if mentioned, e.g. "6pm", "7:00 PM–8:00 PM")
- Meeting location (if mentioned)

Include in the message:
1. Hey [first name]! Just wanted to reach out...
2. Looking forward to our session tomorrow (include day name + time if known)
3. Meeting spot / location if confirmed
4. "If anything comes up, feel free to text or call me at [PHONE NUMBER]" — use the literal placeholder [PHONE NUMBER]
5. Short excited sign-off

Do NOT make up details not found in the emails. If time or location is unknown, say you'll be in touch or ask them to confirm.`,
    messages: [{
      role: "user",
      content: [
        `Client first name: ${inq.name.split(" ")[0]}`,
        `Session date: ${sessionDateReadable}`,
        `Original inquiry: ${inq.message}`,
        emailContext ? `\nEmail thread:\n${emailContext}` : "",
      ].filter(Boolean).join("\n"),
    }],
  });

  const draft = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  const subject = `See you tomorrow! 🎓`;

  return NextResponse.json({ subject, draft });
}
