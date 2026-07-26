// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sync-tone-from-sent
//
// Fetches Chris's sent emails from the past 7 days, passes them to Claude
// for tone/style analysis, and merges any extracted rules into the
// "09 AI Instructions / Email Rules" vault note in Supabase.
//
// Response: { rules: string[]; written: number; emails_analyzed: number }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

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

function stripQuotedReply(text: string): string {
  return text
    .replace(/\n?>?\s*On .+wrote:\n[\s\S]*/i, "")
    .replace(/\n-{3,}[\s\S]*/g, "")
    .replace(/\n_{3,}[\s\S]*/g, "")
    .trim();
}

async function mergeRulesToVault(newRules: string[], client: Anthropic): Promise<number> {
  if (newRules.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("vault_notes")
    .select("id, content")
    .eq("folder", "09 AI Instructions")
    .eq("title", "Email Rules")
    .single();

  const existing = data?.content ?? "";

  const mergeSystem = `You are a knowledge base editor for a photography business. Your job is to maintain a clean, well-structured markdown note of AI email writing rules.

Each rule in the note is timestamped in the format [YYYY-MM-DD] at the start of the line.
New rules being integrated today are dated ${today}.

Editing rules:
- If a new rule CONTRADICTS or SUPERSEDES an existing rule: DELETE the old rule, ADD the new one with today's date [${today}]
- When two rules conflict, ALWAYS prefer the one with the NEWER date
- If a new rule is essentially the same as an existing one: KEEP the existing rule unchanged
- If a new rule is genuinely new: ADD it under the most relevant ## section with today's date [${today}]
- NEVER keep two rules that say opposite or conflicting things
- Preserve all YAML frontmatter exactly as-is
- Update the "updated" frontmatter field to ${today}
- Preserve the existing ## section structure
- If a new rule doesn't fit any existing section, add it under ## Learned Rules
- Output ONLY the updated markdown note — no explanation, no preamble`;

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: mergeSystem,
    messages: [{
      role: "user",
      content: `Current Email Rules note:\n\n---\n${existing}\n---\n\nNew rules to integrate (dated ${today}):\n\n${newRules.map(r => `- [${today}] ${r}`).join("\n")}\n\nOutput the updated note only.`,
    }],
  });

  // A truncated or empty rewrite must never replace the full note — that
  // permanently loses every rule after the cut.
  if (res.stop_reason === "max_tokens") {
    throw new Error("Rules merge hit max_tokens — refusing to overwrite the vault note with a truncated rewrite");
  }
  const updated = res.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();
  if (!updated) {
    throw new Error("Rules merge returned no text — refusing to overwrite the vault note");
  }

  if (data?.id) {
    const { error } = await supabase.from("vault_notes").update({ content: updated }).eq("id", data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("vault_notes").insert({
      folder: "09 AI Instructions",
      title: "Email Rules",
      content: updated,
    });
    if (error) throw error;
  }

  return newRules.length;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 503 });

  const auth = `Bearer ${tokens.access_token}`;

  // Search sent mail from the past 7 days
  const searchQ = encodeURIComponent("in:sent newer_than:7d");
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQ}&maxResults=30`,
    { headers: { Authorization: auth } }
  );

  if (!searchRes.ok) return NextResponse.json({ error: "Gmail search failed" }, { status: 502 });

  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const msgIds = (searchData.messages ?? []).map(m => m.id);

  if (!msgIds.length) {
    return NextResponse.json({ rules: [], written: 0, emails_analyzed: 0, message: "No sent emails found in the past 7 days" });
  }

  // Fetch full bodies for up to 15 messages (skip automated/short ones)
  const bodies = await Promise.all(
    msgIds.slice(0, 15).map(async id => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: auth } }
        );
        if (!r.ok) return null;
        const msg = await r.json() as { payload?: MimePart };
        const raw = extractText(msg.payload ?? {});
        const cleaned = stripQuotedReply(raw).slice(0, 1500).trim();
        return cleaned.length > 80 ? cleaned : null;
      } catch { return null; }
    })
  );

  const emails = bodies.filter((b): b is string => b !== null);

  if (!emails.length) {
    return NextResponse.json({ rules: [], written: 0, emails_analyzed: 0, message: "No usable email content found in sent mail" });
  }

  // Ask Claude to extract tone + style rules from these real sent emails
  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const analysisRes = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `You are a writing-style analyst. You will receive a batch of real emails that Chris Solorzano sent to photography clients. Your job is to extract concrete, actionable style rules that describe HOW Chris writes — his tone, structure, word choice, sentence length, what he includes, and what he omits.

Rules must be written as instructions for an AI email writer (e.g. "open with a direct answer, then provide context", "keep replies to 2-3 short paragraphs", "use 'Hey' not 'Hi' for casual replies", "always mention the turnaround time when confirming a session", "avoid filler phrases like 'I hope this finds you well'").

Focus on patterns that appear across multiple emails. Don't extract one-off specifics.

Output only the rules, one per line starting with a dash. No praise, no explanation, no preamble. Today is ${today}.`,
    messages: [{
      role: "user",
      content: `Here are ${emails.length} real emails Chris sent to clients in the past 7 days. Extract style and tone rules from them.\n\n${emails.map((e, i) => `--- Email ${i + 1} ---\n${e}`).join("\n\n")}\n\nList the rules now:`,
    }],
  });

  const raw = analysisRes.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const rules = raw
    .split("\n")
    .filter(line => /^[-–•*]\s/.test(line.trimStart()))
    .map(line => line.replace(/^[-–•*]\s*/, "").trim())
    .filter(line => line.length > 10);

  let written: number;
  try {
    written = await mergeRulesToVault(rules, client);
  } catch (err) {
    console.error("[sync-tone-from-sent] vault merge failed:", err);
    return NextResponse.json(
      { error: "Extracted rules but failed to save them to the vault — nothing was overwritten." },
      { status: 500 },
    );
  }

  return NextResponse.json({ rules, written, emails_analyzed: emails.length });
}
