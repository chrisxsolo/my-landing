// ─────────────────────────────────────────────────────────────────────────────
// POST /api/detect-session-date
//
// Extracts the confirmed session date by scanning email thread bodies (plain
// text AND HTML fallback) + the inquiry's date_in_mind as a final fallback.
//
// Body:     { inquiry_id }
// Response: { date, readable, confidence, source: "email"|"inquiry" }
//         | { date: null, reason, debug? }
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

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// Prefer plain text; fall back to HTML stripped to plain
function extractBestText(part: MimePart): string {
  let plain = ""; let html = "";
  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !plain)
      plain = decodeBody(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html)
      html = decodeBody(p.body.data);
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return plain || stripHtml(html);
}

// Claude sometimes wraps JSON in markdown code fences — strip them
function extractJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { inquiry_id: string | number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ date: null, reason: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id } = body;
  if (!inquiry_id) return NextResponse.json({ date: null, reason: "inquiry_id required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("name, email, date_in_mind, message")
    .eq("id", inquiry_id)
    .single();

  if (!inq) return NextResponse.json({ date: null, reason: "Inquiry not found" }, { status: 404 });

  // ── Fetch email thread bodies (plain text + HTML fallback) ────────────────
  let emailContext = "";
  let emailsFound = 0;
  const tokens = await getValidTokens();
  if (tokens) {
    const auth = `Bearer ${tokens.access_token}`;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(`from:${inq.email} OR to:${inq.email}`)}&maxResults=20`,
      { headers: { Authorization: auth } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json() as { messages?: { id: string }[] };
      const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 15);
      emailsFound = ids.length;
      const bodies = await Promise.all(ids.map(async id => {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
            { headers: { Authorization: auth } }
          );
          if (!r.ok) return "";
          const msg = await r.json() as { payload?: MimePart; snippet?: string };
          const text = extractBestText(msg.payload ?? {});
          // snippet as last resort if MIME extraction produces nothing
          return (text || msg.snippet || "").slice(0, 2000);
        } catch { return ""; }
      }));
      emailContext = bodies
        .filter(Boolean)
        .map((b, i) => `--- Email ${i + 1} ---\n${b}`)
        .join("\n\n");
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const anthropic = new Anthropic();

  // ── Pass 1: find any date mentioned in the email thread ───────────────────
  if (emailContext) {
    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 200,
      system: `You extract photography session dates from email conversations. Today is ${today}. Current year is ${currentYear}.

Rules:
- Find ANY specific date mentioned — confirmed, proposed, or suggested
- Prefer the most recently discussed/agreed date
- "June 20", "the 20th", "next Saturday", specific month+day = date references
- If someone says "June 20" without a year, use ${currentYear}. Only use ${currentYear + 1} if the date is already in the past.
- Confirmation language: "works great", "sounds good", "perfect", "see you then", "that works", "confirmed", "looking forward", "I'll be there", "can't wait"
- A date proposed by one person + positive response = confirmed (high confidence)
- A date proposed but not yet replied to = medium confidence
- Return the most specific, most recently discussed date you can find

Respond ONLY with valid JSON — no markdown, no code blocks, no explanation:
{"date":"YYYY-MM-DD","readable":"e.g. Friday, June 20, 2026","confidence":"high|medium|low"}
Only if NO date whatsoever is mentioned in any email: {"date":null,"readable":null,"confidence":"low"}`,
      messages: [{
        role: "user",
        content: `Client: ${inq.name}
Their original date request: ${inq.date_in_mind ?? "not specified"}
Original inquiry: ${inq.message}

Email thread:
${emailContext}`,
      }],
    });

    try {
      const raw  = res.content[0].type === "text" ? res.content[0].text : "{}";
      const result = JSON.parse(extractJson(raw)) as { date: string | null; readable: string | null; confidence: string };
      if (result.date) {
        return NextResponse.json({ ...result, source: "email" });
      }
    } catch { /* fall through */ }
  }

  // ── Pass 2: parse date_in_mind from the inquiry form ─────────────────────
  if (inq.date_in_mind) {
    const res2 = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 150,
      system: `Parse a free-form date string into a structured date. Today is ${today}. Current year is ${currentYear}.
If only month+day given, use ${currentYear}. Only use ${currentYear + 1} if that date has already passed.
Respond ONLY with valid JSON — no markdown, no code blocks:
{"date":"YYYY-MM-DD","readable":"e.g. Friday, June 20, 2026","confidence":"medium"}
If truly unparseable: {"date":null,"readable":null,"confidence":"low"}`,
      messages: [{ role: "user", content: `Date text: "${inq.date_in_mind}"` }],
    });

    try {
      const raw2   = res2.content[0].type === "text" ? res2.content[0].text : "{}";
      const result2 = JSON.parse(extractJson(raw2)) as { date: string | null; readable: string | null; confidence: string };
      if (result2.date) {
        return NextResponse.json({ ...result2, source: "inquiry", confidence: "medium" });
      }
    } catch { /* nothing */ }
  }

  return NextResponse.json({
    date: null, readable: null, confidence: "low",
    reason: emailsFound > 0
      ? `Scanned ${emailsFound} emails but no date found — try the manual date picker`
      : "No emails found for this client in Gmail — use the manual date picker",
  });
}
