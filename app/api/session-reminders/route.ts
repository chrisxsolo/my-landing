// POST /api/session-reminders
// Generates all 5 client-experience touchpoint drafts for a session.
// Body:     { inquiry_id }
// Response: { reminders: ReminderDraft[] }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { buildReminderEmail, type ReminderEmailType } from "@/lib/reminderEmail";

export const dynamic = "force-dynamic";

export type ReminderDraft = {
  id: string;
  label: string;
  emoji: string;
  subject: string;
  body: string;
  html: string;
};

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
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
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

async function fetchEmailContext(email: string): Promise<string> {
  const tokens = await getValidTokens();
  if (!tokens) return "";
  const auth = `Bearer ${tokens.access_token}`;
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
    `?q=${encodeURIComponent(`from:${email} OR to:${email}`)}&maxResults=8`,
    { headers: { Authorization: auth } }
  );
  if (!searchRes.ok) return "";
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
      return extractText(msg.payload ?? {}).slice(0, 600);
    } catch { return ""; }
  }));
  return bodies.filter(Boolean).map((b, i) => `--- Email ${i + 1} ---\n${b}`).join("\n\n");
}

async function generateOne(
  anthropic: Anthropic,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 350,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  return stripSignoff(res.content[0].type === "text" ? res.content[0].text.trim() : "");
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
  const { data: inq } = await supabase.from("inquiries").select("*").eq("id", inquiry_id).single();
  if (!inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });

  // Load any saved custom templates from site_settings
  const templateKeys = ["48hr","day-before","morning-of","thank-you","gallery-delivery"]
    .flatMap(id => [`reminder_subject_${id}`, `reminder_instructions_${id}`]);
  const { data: settingsRows } = await supabase.from("site_settings").select("key,value").in("key", templateKeys);
  const settings: Record<string, string> = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value ?? ""]));

  const firstName = inq.name.split(" ")[0];
  const sessionDateReadable = inq.session_date
    ? new Date(inq.session_date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : inq.date_in_mind ?? "your session date";

  // Compute how far away (or past) the session is relative to today
  const todayNoon = new Date();
  todayNoon.setHours(12, 0, 0, 0);
  const todayReadable = todayNoon.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  let sessionTiming = "unknown";
  if (inq.session_date) {
    const sessionNoon = new Date(inq.session_date + "T12:00:00");
    const diffDays = Math.round((sessionNoon.getTime() - todayNoon.getTime()) / 86_400_000);
    if      (diffDays === 0)  sessionTiming = "today";
    else if (diffDays === 1)  sessionTiming = "tomorrow";
    else if (diffDays === -1) sessionTiming = "yesterday";
    else if (diffDays > 1)   sessionTiming = `in ${diffDays} days`;
    else                     sessionTiming = `${Math.abs(diffDays)} days ago`;
  }

  const emailContext = await fetchEmailContext(inq.email);
  const contextBlock = [
    `Client first name: ${firstName}`,
    `Today's date: ${todayReadable}`,
    `Session date: ${sessionDateReadable} (${sessionTiming})`,
    `Session type: ${inq.session_type ?? "photography"}`,
    `Original inquiry: ${inq.message}`,
    emailContext ? `\nEmail thread:\n${emailContext}` : "",
  ].filter(Boolean).join("\n");

  const sharedSystem = `You are writing short, direct messages from Chris (photographer at soloxsnaps) to a photography client.
Tone: genuine, warm but direct — not flowery, not salesy, not corporate.
Length: 3–5 sentences max. Plain text only, no bullet points, no markdown.
Phone: (408) 722-7680. Do not include any sign-off or signature — the email client adds that automatically.
TIMING: The context tells you today's date and exactly how far away the session is. Always use the actual timing — never assume "yesterday" or "tomorrow" if the numbers say otherwise.`;

  const anthropic = new Anthropic();

  const specs: { id: string; label: string; emoji: string; subject: string; systemAddition: string }[] = [
    {
      id: "48hr",
      label: "48-Hour Reminder",
      emoji: "⏰",
      subject: `2 days until your shoot`,
      systemAddition: `Write a 48-hour pre-session heads-up. The context tells you the exact days until the session — use that number naturally (e.g. "in 2 days", "in 3 days"). Cover: (1) excitement for the upcoming shoot, (2) any prep tips from the email thread (what to wear, arrive a bit early, etc.), (3) tell them to text you if anything comes up. Keep it short and easy to read. Always write the message — even if the session is in the past, write it as the 48-hour reminder for that shoot.`,
    },
    {
      id: "day-before",
      label: "Day-Before Check-In",
      emoji: "🌅",
      subject: `See you tomorrow`,
      systemAddition: `Write a day-before reminder. Use the actual session timing from context to confirm the timeframe (e.g. "tomorrow" or "in X days"). Cover: (1) excitement for the upcoming shoot, (2) confirm meeting time and location if found in email thread — if not, say you'll send details shortly, (3) your number if they need anything. 3–4 sentences max.`,
    },
    {
      id: "morning-of",
      label: "Morning-Of Text",
      emoji: "☀️",
      subject: `Morning of your shoot`,
      systemAddition: `Write a brief morning-of message. Super short — 2–3 sentences. Just: hyped for the shoot, confirm meeting spot/time if known from thread, your number. Reads like a text message, not an email. Casual and real. Always write the message — even if the session is in the past, write it as though it applies to that day.`,
    },
    {
      id: "thank-you",
      label: "Post-Session Thank-You",
      emoji: "🙏",
      subject: `Thank you — it was so fun`,
      systemAddition: `Write a post-session thank-you. The context tells you exactly when the session was relative to today — use that timing naturally (e.g. "yesterday", "a few days ago", "earlier this week"). Cover: (1) genuinely loved shooting with them and reference when it was, (2) briefly mention something authentic about the session type or location, (3) let them know you'll be editing and will send a gallery link soon, (4) ask them to tag you on IG @soloxsnaps when they post. Keep it real, not generic.`,
    },
    {
      id: "gallery-delivery",
      label: "Gallery Delivery",
      emoji: "🖼️",
      subject: `Your photos are ready`,
      systemAddition: `Write a gallery delivery message. DO NOT include any gallery link or download instructions — Chris will paste the link separately. Use the session timing from context to naturally reference how long ago the shoot was (e.g. "from your shoot last week", "from a few days ago"). Cover: (1) gallery is ready, (2) a genuine compliment about how the photos turned out, (3) ask them to tag @soloxsnaps on IG when they post. 3 sentences max. Super short and real.`,
    },
  ];

  const reminders = await Promise.all(
    specs.map(async (spec): Promise<ReminderDraft> => {
      const customInstr = settings[`reminder_instructions_${spec.id}`];
      const customSubject = settings[`reminder_subject_${spec.id}`];
      const instructions = customInstr
        ? `${spec.systemAddition}\n\nAdditional style notes from Chris (follow these closely):\n${customInstr}`
        : spec.systemAddition;
      const subject = customSubject || spec.subject;
      const system = `${sharedSystem}\n\n${instructions}`;
      const body = await generateOne(anthropic, system, contextBlock);
      const html = buildReminderEmail(spec.id as ReminderEmailType, firstName, body);
      return { id: spec.id, label: spec.label, emoji: spec.emoji, subject, body, html };
    })
  );

  return NextResponse.json({ reminders, client_name: inq.name, client_email: inq.email });
}
