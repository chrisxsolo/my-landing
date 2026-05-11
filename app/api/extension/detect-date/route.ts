import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const EXTENSION_SECRET = process.env.CRON_SECRET ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-extension-secret, content-type",
};

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
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractBestText(part: MimePart): string {
  let plain = ""; let html = "";
  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !plain) plain = decodeBody(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html) html = decodeBody(p.body.data);
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return plain || stripHtml(html);
}

function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-extension-secret");
  if (!token || token !== EXTENSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const { inquiry_id } = await req.json();
  if (!inquiry_id) return NextResponse.json({ error: "inquiry_id required" }, { status: 400, headers: CORS });

  const supabase = createSupabaseServerClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("name, email, date_in_mind, message")
    .eq("id", inquiry_id)
    .single();

  if (!inq) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();

  // Scan Gmail thread for confirmed date + time
  let emailContext = "";
  const tokens = await getValidTokens();
  if (tokens) {
    const auth = `Bearer ${tokens.access_token}`;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`from:${inq.email} OR to:${inq.email}`)}&maxResults=20`,
      { headers: { Authorization: auth } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json() as { messages?: { id: string }[] };
      const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 15);
      const bodies = await Promise.all(ids.map(async id => {
        try {
          const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: { Authorization: auth } });
          if (!r.ok) return "";
          const msg = await r.json() as { payload?: MimePart; snippet?: string };
          return (extractBestText(msg.payload ?? {}) || msg.snippet || "").slice(0, 2000);
        } catch { return ""; }
      }));
      emailContext = bodies.filter(Boolean).map((b, i) => `--- Email ${i + 1} ---\n${b}`).join("\n\n");
    }
  }

  if (emailContext) {
    const anthropic = new Anthropic();
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: `You extract confirmed photography session details from email conversations. Today is ${today}. Current year is ${currentYear}.

Extract:
1. Date: the most recently confirmed/agreed session date
2. Time: confirmed session time (e.g. "10:00 AM", "6:30 PM", "golden hour"). null if not mentioned.
3. Location: the school or specific location mentioned (e.g. "UC Berkeley", "SJSU", "San Jose State", "SF State", "USF", "Cal", "East Bay"). Return the raw name as mentioned. null if not found.

Rules:
- Confirmation language: "works great", "sounds good", "perfect", "see you then", "confirmed"
- If month+day given without year, use ${currentYear}. Only use ${currentYear + 1} if date has already passed.

Respond ONLY with valid JSON:
{"date":"YYYY-MM-DD","readable":"e.g. Saturday, May 31, 2026","time":"e.g. 10:00 AM","location":"e.g. UC Berkeley","confidence":"high|medium|low"}
If no date found: {"date":null,"readable":null,"time":null,"location":null,"confidence":"low"}`,
      messages: [{ role: "user", content: `Client: ${inq.name}\nOriginal request: ${inq.date_in_mind ?? "not specified"}\n\nEmail thread:\n${emailContext}` }],
    });

    try {
      const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
      const result = JSON.parse(extractJson(raw)) as { date: string | null; readable: string | null; time: string | null; location: string | null; confidence: string };
      if (result.date) {
        return NextResponse.json({ ...result, source: "email" }, { headers: CORS });
      }
    } catch { /* fall through */ }
  }

  // Fallback: parse date_in_mind from inquiry
  if (inq.date_in_mind) {
    return NextResponse.json({
      date: null,
      readable: inq.date_in_mind,
      time: null,
      confidence: "low",
      source: "inquiry",
    }, { headers: CORS });
  }

  return NextResponse.json({ date: null, readable: null, time: null, confidence: "low", source: "none" }, { headers: CORS });
}
