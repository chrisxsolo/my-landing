// ─────────────────────────────────────────────────────────────────────────────
// POST /api/draft-reply
//
// Admin-only endpoint. Three modes:
//
// 1. Fresh draft
//    Body: { name, email, phone?, session_type?, date_in_mind?, message }
//    Response: { draft: "Hi Ryan, ..." }
//
// 2. Refinement
//    Body: { ...same, previous_draft, feedback }
//    Response: { draft: "Hi Ryan, ..." }  (revised)
//
// 3. Analyze & learn
//    Body: { name, email, message, ai_draft, actual_sent }
//    Response: { rules: ["be more direct", "skip the weather mention", ...] }
//    Claude compares the AI draft vs what Chris actually sent and extracts
//    concrete style rules to save for future drafts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function fetchAvailability(): Promise<string> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/availability`, { cache: "no-store" });
    if (!res.ok) return "Availability data unavailable.";
    const json = await res.json();
    return json.quick_read ?? "Availability data unavailable.";
  } catch {
    return "Availability data unavailable — tell them to check soloxsnaps.com/availability for open dates.";
  }
}

async function fetchReplyStyle(): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "reply_style")
      .single();
    return data?.value?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 }
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, email, session_type, date_in_mind, message, phone, previous_draft, feedback, ai_draft, actual_sent, thread_context } = body;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "name, email, and message are required." },
      { status: 400 }
    );
  }

  const isAnalyze    = Boolean(ai_draft && actual_sent);
  const isRefinement = !isAnalyze && Boolean(previous_draft && feedback);

  // ── Mode 3: Analyze & learn ──────────────────────────────────────────────
  if (isAnalyze) {
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: `You are a writing-style analyst. Your job is to compare two email drafts and produce a short, concrete list of style rules that capture how the final version differs from the draft. Each rule should be a single actionable instruction (e.g. "skip the opening weather comment", "be more direct — cut the warm-up sentences", "always mention the turnaround time"). No fluff, no praise, no explanation — just the rules, one per line, starting with a dash.`,
        messages: [
          {
            role: "user",
            content: `Here is the AI-generated draft:

---
${ai_draft}
---

Here is what Chris actually sent instead:

---
${actual_sent}
---

List the concrete style rules Claude should follow in future drafts based on the differences. Output only the rules, one per line starting with a dash, nothing else.`,
          },
        ],
      });

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      // Parse dash-prefixed lines into an array of rule strings
      const rules = raw
        .split("\n")
        .map((line) => line.replace(/^[-–•*]\s*/, "").trim())
        .filter((line) => line.length > 0);

      return NextResponse.json({ rules });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Claude analyze error:", msg);
      return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
    }
  }

  // ── Modes 1 & 2: Fresh draft or refinement ───────────────────────────────

  // Fetch both in parallel
  const [availability, replyStyle] = await Promise.all([
    fetchAvailability(),
    fetchReplyStyle(),
  ]);

  const baseInstructions = `You are Chris Solorzano, a Bay Area graduation and family photographer. You run soloxsnaps.com.

Your tone is warm, personal, and direct — not overly formal, not salesy. You sound like a real person who genuinely cares about making their shoot great. Keep replies concise (3–5 short paragraphs max).

Always:
- Use the client's first name naturally
- Acknowledge what they want specifically (session type, date, etc.)
- Mention 2–3 specific open dates from the availability data when relevant (pick ones closest to their requested date if they gave one, otherwise the next soonest)
- End with a clear next step: they should reply to confirm a date or ask questions
- Sign as "Chris"
- Start directly with "Hi [Name]," — no subject line, no "Dear"
- Plain text only — no markdown, no bold, no asterisks, no bullet points
- Do not mention pricing unless they asked about it`;

  const styleSection = replyStyle
    ? `\n\nAdditional style instructions from Chris (follow these closely, they override defaults where they conflict):\n${replyStyle}`
    : "";

  const systemPrompt = baseInstructions + styleSection;

  const threadSection = thread_context
    ? `\n\nFull email conversation history with this client (oldest first — use this for context, don't repeat what's already been said):\n\n${thread_context}`
    : "";

  const userPrompt = isRefinement
    ? `You wrote this draft reply for a client inquiry:

---
${previous_draft}
---

Chris reviewed it and wants this changed: "${feedback}"

Rewrite the reply incorporating that feedback. Keep everything else the same unless it conflicts with the requested change. Output only the revised reply, nothing else.`
    : `Draft a reply to this client inquiry:

Name: ${name}
Email: ${email}${phone ? `\nPhone: ${phone}` : ""}${session_type ? `\nSession type: ${session_type}` : ""}${date_in_mind ? `\nDate they have in mind: ${date_in_mind}` : ""}

Their message:
${message}

Current availability:
${availability}${threadSection}

Write the reply now.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const draft = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ draft });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Claude draft-reply error:", msg);
    return NextResponse.json(
      { error: `Draft failed: ${msg}` },
      { status: 500 }
    );
  }
}
