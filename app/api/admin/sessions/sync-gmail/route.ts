import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { CLIENT_SESSION_TABLE, type ClientSessionRow, toAdminClientSessionDTO } from "@/lib/clientSessions";

export const dynamic = "force-dynamic";

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };

function decodeBody(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return decodeURIComponent(
      Array.from(atob(padded))
        .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
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

async function fetchEmailContext(clientEmail: string): Promise<string> {
  const tokens = await getValidTokens();
  if (!tokens) {
    console.log("[sync-gmail] no tokens found");
    return "";
  }

  const auth = `Bearer ${tokens.access_token}`;
  const query = `from:${clientEmail} OR to:${clientEmail}`;
  console.log("[sync-gmail] searching threads for:", clientEmail);

  // Use threads endpoint — same as conversation view which reliably finds emails
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=10`,
    { headers: { Authorization: auth } },
  );
  console.log("[sync-gmail] thread search status:", searchRes.status);

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    console.log("[sync-gmail] thread search error:", errText.slice(0, 300));
    return "";
  }

  const searchData = await searchRes.json() as { threads?: { id: string }[] };
  const threadIds = (searchData.threads ?? []).map(t => t.id);
  console.log("[sync-gmail] threads found:", threadIds.length);

  if (!threadIds.length) return "";

  // Fetch each thread with full format to get message bodies
  const bodies: string[] = [];
  for (const threadId of threadIds.slice(0, 5)) {
    try {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        { headers: { Authorization: auth } },
      );
      if (!r.ok) continue;
      const thread = await r.json() as { messages?: { payload?: MimePart; snippet?: string }[] };
      for (const msg of thread.messages ?? []) {
        const text = (extractBestText(msg.payload ?? {}) || msg.snippet || "").slice(0, 1500);
        if (text) bodies.push(text);
      }
    } catch { continue; }
  }

  const context = bodies.filter(Boolean).map((b, i) => `--- Email ${i + 1} ---\n${b}`).join("\n\n");
  console.log("[sync-gmail] email context length:", context.length, "from", bodies.length, "messages");
  return context;
}

type ExtractedDetails = {
  sessionTime: string | null;
  location: string | null;
  meetingPoint: string | null;
  sessionDate: string | null;
};

async function extractDetailsFromEmails(
  clientName: string,
  clientEmail: string,
  emailContext: string,
): Promise<ExtractedDetails> {
  const anthropic = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: `You are helping extract photography session booking details from an email thread between a photographer and their client. Today is ${today}.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "sessionDate": "YYYY-MM-DD — the date of the photo session. Look for specific dates like 'May 15', 'Saturday the 17th', 'June 3rd'. Convert to YYYY-MM-DD. null if no date mentioned.",
  "sessionTime": "The meeting time, e.g. '4pm', '4:00pm', '3:30pm-4:30pm'. null if not mentioned.",
  "location": "The general location or campus for the shoot, e.g. 'SJSU', 'UC Berkeley', 'Legion of Honor'. null if not mentioned.",
  "meetingPoint": "The specific meeting spot, e.g. 'front of Clark Hall', 'Tower Hall steps'. null if not mentioned."
}

Be generous — extract any date or time that seems to be about the photo session, even if not 100% confirmed. If you see a date and time discussed, include them.`,
    messages: [{
      role: "user",
      content: `Client: ${clientName} (${clientEmail})

Email thread:
${emailContext}`,
    }],
  });

  const raw = res.content[0]?.type === "text" ? res.content[0].text.trim() : "{}";
  console.log("[sync-gmail] claude raw response:", raw);
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(text) as ExtractedDetails;
  } catch {
    console.log("[sync-gmail] JSON parse failed for:", text);
    return { sessionTime: null, location: null, meetingPoint: null, sessionDate: null };
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { session_id: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { session_id } = body;
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: session, error: fetchErr } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("*")
    .eq("id", session_id)
    .single<ClientSessionRow>();

  if (fetchErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: "Gmail not connected. Connect Gmail in Studio Dashboard first." }, { status: 400 });
  }

  const emailContext = await fetchEmailContext(session.client_email);
  if (!emailContext) {
    return NextResponse.json({ error: "No Gmail emails found for this client's email address. Make sure Gmail is connected in Studio Dashboard." }, { status: 400 });
  }

  const extracted = await extractDetailsFromEmails(
    session.client_name ?? session.client_email,
    session.client_email,
    emailContext,
  );

  console.log("[sync-gmail] extracted for", session.client_email, extracted);

  const updates: Record<string, unknown> = {};
  const filled: string[] = [];

  // Build session_date timestamp — combine date + time if both present
  if (extracted.sessionDate) {
    let isoDate = extracted.sessionDate;
    if (extracted.sessionTime) {
      // Parse time like "4:00pm", "4pm", "16:00" into hours/minutes
      const timeMatch = extracted.sessionTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2] ?? "0", 10);
        const meridiem = timeMatch[3]?.toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        isoDate = `${extracted.sessionDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
      }
    }
    updates.session_date = isoDate;
    filled.push(extracted.sessionTime ? "date & time" : "date");
  }

  if (extracted.location) {
    updates.location = extracted.location;
    filled.push("location");
  }

  if (extracted.meetingPoint) {
    updates.meeting_point = extracted.meetingPoint;
    filled.push("meeting point");
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      session: toAdminClientSessionDTO(session),
      extracted,
      message: "Gmail was read but no session details (date, time, location) were found in the emails.",
    });
  }

  const { data: updated, error: updateErr } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update(updates)
    .eq("id", session_id)
    .select("*")
    .single<ClientSessionRow>();

  if (updateErr) throw updateErr;

  return NextResponse.json({
    session: toAdminClientSessionDTO(updated),
    extracted,
    message: `Synced from Gmail: ${filled.join(", ")} updated.`,
  });
}
