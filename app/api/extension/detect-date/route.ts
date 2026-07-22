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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// "2026-07-24" → "July 24th, 2026"
function formatReadable(iso: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(iso);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${month} ${ordinal(Number(m[3]))}, ${m[1]}`;
}

// "July 24th" / "7/24" / "07/24/2026" / "2026-07-24" → ISO date.
// Missing year resolves to the next occurrence of that month+day.
function parseLooseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const iso   = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(text);
  const named = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/.exec(text);

  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else if (slash) {
    month = +slash[1]; day = +slash[2];
    year = slash[3] ? (+slash[3] < 100 ? 2000 + +slash[3] : +slash[3]) : null;
  } else if (named) {
    const idx = MONTHS.findIndex(m => m.toLowerCase().startsWith(named[1].toLowerCase()));
    if (idx >= 0) {
      month = idx + 1; day = +named[2];
      year = named[3] ? +named[3] : null;
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year == null) {
    const now = new Date();
    year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
    .select("name, email, date_in_mind, message, session_type, school, people")
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
          if (!r.ok) return null;
          const msg = await r.json() as { payload?: MimePart; snippet?: string; internalDate?: string };
          const text = (extractBestText(msg.payload ?? {}) || msg.snippet || "").slice(0, 2000);
          return text ? { ts: Number(msg.internalDate ?? 0), text } : null;
        } catch { return null; }
      }));
      const sorted = bodies
        .filter((b): b is { ts: number; text: string } => b != null)
        .sort((a, b) => a.ts - b.ts);
      emailContext = sorted.map((b, i) => {
        const sent = b.ts
          ? new Date(b.ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : "unknown date";
        return `--- Email ${i + 1} of ${sorted.length} (sent ${sent}) ---\n${b.text}`;
      }).join("\n\n");
    }
  }

  if (emailContext) {
    const anthropic = new Anthropic();
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: `You extract confirmed photography session details from email conversations. Today is ${today}. Current year is ${currentYear}.

Extract:
1. Date: the most recently confirmed/agreed session date
2. Time: the session time most recently discussed (e.g. "10:00 AM", "6:30 PM", "golden hour"). Prefer an explicitly confirmed time; if none was confirmed, use the most recently proposed time from either party. Format clock times like "6:00 PM". null only if no time was ever mentioned in any email.
3. Location: the school, park, neighborhood, or specific spot most recently discussed for the shoot (e.g. "UC Berkeley", "SJSU", "Golden Gate Park", "Palace of Fine Arts, San Francisco"). Return a short place name only — never a sentence or a quote from the email. null if not found.
4. Session type: one of "graduation", "family", "extended-family", "couples", "engagement", "proposal", "event", "other" — based on the inquiry and emails. null if unclear.
5. Total fee: the most recently quoted or agreed TOTAL price for the session in dollars, as a plain number (e.g. 350). Include travel fees if they were part of the quoted total. Prefer the photographer's most recent quote or an amount the client agreed to. null if no price was discussed.

Rules:
- Emails are in chronological order — the LAST email is the most recent. When emails disagree, the most recent one wins.
- Confirmation language: "works great", "sounds good", "perfect", "see you then", "confirmed"
- If month+day given without year, use ${currentYear}. Only use ${currentYear + 1} if date has already passed.
- Do NOT invent a price — only extract amounts actually written in the emails.

Respond ONLY with valid JSON:
{"date":"YYYY-MM-DD","readable":"e.g. July 24th, 2026","time":"e.g. 10:00 AM","location":"e.g. UC Berkeley","session_type":"family","total_fee":350,"confidence":"high|medium|low"}
Use null for any field not found, e.g. {"date":null,"readable":null,"time":null,"location":null,"session_type":null,"total_fee":null,"confidence":"low"}`,
      messages: [{ role: "user", content: `Client: ${inq.name}\nInquiry session type: ${inq.session_type ?? "not specified"}\nSchool: ${inq.school ?? "not specified"}\nGroup size: ${inq.people ?? "not specified"}\nOriginal request: ${inq.date_in_mind ?? "not specified"}\nInquiry message: ${inq.message ?? ""}\n\nEmail thread:\n${emailContext}` }],
    });

    try {
      const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
      const result = JSON.parse(extractJson(raw)) as {
        date: string | null; readable: string | null; time: string | null; location: string | null;
        session_type: string | null; total_fee: number | null; confidence: string;
      };
      if (result.date || result.total_fee != null || result.session_type) {
        const iso = parseLooseDate(result.date) ?? parseLooseDate(result.readable);
        if (iso) {
          result.date = iso;
          result.readable = formatReadable(iso);
        }
        return NextResponse.json({ ...result, source: "email" }, { headers: CORS });
      }
    } catch { /* fall through */ }
  }

  // Fallback: parse date_in_mind from inquiry
  if (inq.date_in_mind) {
    const iso = parseLooseDate(inq.date_in_mind);
    return NextResponse.json({
      date: iso,
      readable: iso ? formatReadable(iso) : inq.date_in_mind,
      time: null,
      session_type: inq.session_type ?? null,
      total_fee: null,
      confidence: "low",
      source: "inquiry",
    }, { headers: CORS });
  }

  return NextResponse.json({ date: null, readable: null, time: null, session_type: inq.session_type ?? null, total_fee: null, confidence: "low", source: "none" }, { headers: CORS });
}
