// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sync-tone-from-sent
//
// Fetches Chris's sent emails from the past 7 days and asks Claude to describe
// the style patterns across them. Observations are stored as PENDING rules for
// approval, never applied directly: a batch of whatever happened to be in Sent
// Mail is weak evidence compared with an email Chris explicitly approved.
//
// One API call per sync. The second call that rewrote the vault note is gone.
//
// Response: { rules, written, skipped, emails_analyzed, message }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchWritingRules, insertWritingRule, recordUsage } from "@/lib/ai/aiEmailStore";
import { classifyRuleIntake } from "@/lib/ai/writingRules";
import { resolveEmailModelConfig } from "@/lib/ai/emailModel";

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

/**
 * Stores observed rules as pending candidates.
 *
 * Previously this asked Claude to rewrite the whole "Email Rules" markdown
 * note with the new rules merged in — a second API call per sync whose output
 * replaced the note wholesale. Dedup and conflict detection are deterministic
 * now (lib/ai/writingRules.ts), so there is no second call and nothing is
 * overwritten.
 *
 * Everything lands as `pending`. These rules are inferred from whatever
 * happened to be in Sent Mail this week, which is weaker evidence than an
 * approved example, so none of it reaches a draft without Chris agreeing.
 */
async function storeObservedRules(observed: string[]): Promise<{
  pending: { id: string; rule: string }[];
  skipped: { rule: string; verdict: string }[];
}> {
  const pending: { id: string; rule: string }[] = [];
  const skipped: { rule: string; verdict: string }[] = [];
  if (!observed.length) return { pending, skipped };

  const existing = await fetchWritingRules();

  for (const rule of observed) {
    const intake = classifyRuleIntake(rule, existing);
    if (intake.verdict !== "new") {
      skipped.push({ rule, verdict: intake.verdict });
      continue;
    }
    const row = await insertWritingRule({
      rule, category: "style", status: "pending", source: "sync-from-sent",
    });
    if (row) {
      pending.push({ id: row.id, rule: row.rule });
      // Added to the in-memory set too, so two near-identical observations in
      // one batch do not both get stored.
      existing.push(row);
    }
  }
  return { pending, skipped };
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
  const modelConfig = resolveEmailModelConfig();

  const analysisRes = await client.messages.create({
    model: modelConfig.model,
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

  const { pending, skipped } = await storeObservedRules(rules);

  await recordUsage({
    operation: "learn",
    model: analysisRes.model,
    input_tokens: analysisRes.usage.input_tokens,
    output_tokens: analysisRes.usage.output_tokens,
    cache_creation_input_tokens: analysisRes.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: analysisRes.usage.cache_read_input_tokens ?? 0,
    duration_ms: 0,
    success: true,
  });

  return NextResponse.json({
    rules: pending.map((row) => row.rule),
    written: pending.length,
    skipped,
    emails_analyzed: emails.length,
    message: pending.length
      ? `${pending.length} rule${pending.length === 1 ? "" : "s"} proposed. Approve them on the AI tab to use them.`
      : "Nothing new to propose from this week's sent mail.",
  });
}
