// POST /api/session-reminders
// Generates all 5 client-experience touchpoint drafts for a session.
// Body:     { inquiry_id }
// Response: { reminders: ReminderDraft[] }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export type ReminderDraft = {
  id: string;
  label: string;
  emoji: string;
  subject: string;
  body: string;
};

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };

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
  return res.content[0].type === "text" ? res.content[0].text.trim() : "";
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

  const firstName = inq.name.split(" ")[0];
  const sessionDateReadable = inq.session_date
    ? new Date(inq.session_date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : inq.date_in_mind ?? "your session date";

  const emailContext = await fetchEmailContext(inq.email);
  const contextBlock = [
    `Client first name: ${firstName}`,
    `Session date: ${sessionDateReadable}`,
    `Session type: ${inq.session_type ?? "photography"}`,
    `Original inquiry: ${inq.message}`,
    emailContext ? `\nEmail thread:\n${emailContext}` : "",
  ].filter(Boolean).join("\n");

  const sharedSystem = `You are writing short, direct messages from Chris (photographer at soloxsnaps) to a photography client.
Tone: genuine, warm but direct — not flowery, not salesy, not corporate.
Length: 3–5 sentences max. Plain text only, no bullet points, no markdown.
Phone: (408) 722-7680. Do not include any sign-off or signature — the email client adds that automatically.`;

  const anthropic = new Anthropic();

  const specs: { id: string; label: string; emoji: string; subject: string; systemAddition: string }[] = [
    {
      id: "48hr",
      label: "48-Hour Reminder",
      emoji: "⏰",
      subject: `2 days until your shoot! 🎓`,
      systemAddition: `Write a 48-hour heads-up. Cover: (1) excitement for the shoot in 2 days, (2) any prep tips you know from the email thread (what to wear, arrive a bit early, etc.), (3) tell them to text you if anything comes up. Keep it short and easy to read.`,
    },
    {
      id: "day-before",
      label: "Day-Before Check-In",
      emoji: "🌅",
      subject: `See you tomorrow! 🎓`,
      systemAddition: `Write a day-before reminder. Cover: (1) excited for tomorrow, (2) confirm meeting time and location if found in email thread — if not found, say you'll send details shortly, (3) your number if they need anything. 3–4 sentences max.`,
    },
    {
      id: "morning-of",
      label: "Morning-Of Text",
      emoji: "☀️",
      subject: `Morning of your shoot ☀️`,
      systemAddition: `Write a brief morning-of message. Super short — 2–3 sentences. Just: hyped for today, confirm meeting spot/time if known from thread, your number. This reads like a text message, not an email. Casual and real.`,
    },
    {
      id: "thank-you",
      label: "Post-Session Thank-You",
      emoji: "🙏",
      subject: `Thank you — it was so fun! 📸`,
      systemAddition: `Write a post-session thank-you. Cover: (1) genuinely loved shooting with them, (2) briefly mention something authentic about the session type or location if you know it, (3) let them know you'll be editing and will send a gallery link soon, (4) ask them to tag you on IG @soloxsnaps when they post. Keep it real, not generic.`,
    },
    {
      id: "gallery-delivery",
      label: "Gallery Delivery",
      emoji: "🖼️",
      subject: `Your photos are ready! 🎉`,
      systemAddition: `Write a gallery delivery message. DO NOT include any gallery link or download instructions — Chris will paste the link separately. Cover: (1) just sent your gallery, (2) loved how they turned out / a genuine compliment about the session, (3) ask them to tag @soloxsnaps on IG when they post. 3 sentences max. Super short and real.`,
    },
  ];

  const reminders = await Promise.all(
    specs.map(async (spec): Promise<ReminderDraft> => {
      const system = `${sharedSystem}\n\n${spec.systemAddition}`;
      const body = await generateOne(anthropic, system, contextBlock);
      return { id: spec.id, label: spec.label, emoji: spec.emoji, subject: spec.subject, body };
    })
  );

  return NextResponse.json({ reminders });
}
