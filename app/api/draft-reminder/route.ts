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
import OpenAI from "openai";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };

function stripSignoff(text: string): string {
  return text
    .replace(/\n+[-–]?\s*Chris\s*$/i, "")
    .replace(/\n+(?:best|thanks|cheers|warm regards|regards|sincerely)[,.]?\s*\n+chris\s*$/i, "")
    .trimEnd();
}

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

  // ── Ask GPT to write the reminder ────────────────────────────────────────
  const openai = new OpenAI();
  const res = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content: `You are writing a short, direct day-before reminder from Chris (photographer at soloxsnaps) to a photography client.

Tone: direct, simple, genuine — not overly flowery or salesy.
Length: 3–4 sentences max. Keep it tight.
Format: plain text, no bullet points, no markdown.

From the email history, extract:
- Session time (if mentioned, e.g. "6:30pm")
- Meeting location / meeting point (if mentioned)

Write the message in this exact structure:
1. "Hey [first name]! Just wanted to reach out and say I'm excited for tomorrow."
2. "We'll meet at [time] in front of [location]." — only include what you found. If time or location unknown, say you'll confirm details soon.
3. "Feel free to text or call me if anything comes up at (408) 722-7680."
4. "Can't wait to capture this milestone for you!"

Do NOT describe how beautiful the location is. Do NOT add extra filler sentences. Keep it short and real.`,
      },
      {
        role: "user",
        content: [
          `Client first name: ${inq.name.split(" ")[0]}`,
          `Session date: ${sessionDateReadable}`,
          `Original inquiry: ${inq.message}`,
          emailContext ? `\nEmail thread:\n${emailContext}` : "",
        ].filter(Boolean).join("\n"),
      },
    ],
  });

  const draft = stripSignoff((res.choices[0]?.message?.content ?? "").trim());
  const subject = `See you tomorrow! 🎓`;

  return NextResponse.json({ subject, draft });
}
