// ─────────────────────────────────────────────────────────────────────────────
// POST /api/train-ai
//
// Conversational training. Chris chats about how he wants emails written;
// Claude replies and proposes concrete rules.
//
// Body:     { messages: {role, content}[], session_id? }
// Response: SSE of
//   { type:"text", text }                              reply tokens
//   { type:"done", new_rules, pending, session_id }     rules awaiting approval
//
// Two changes from the previous version. It runs on Claude rather than GPT-4.1,
// and proposed rules go into ai_writing_rules as `pending` instead of being
// merged into a markdown note by a second model call. That merge ran at
// max_tokens 1600 against a note longer than that, so it truncated the note on
// every run; the live note still ends mid-rule with a dangling "- [".
//
// Rules proposed here change nothing until approved via POST /api/ai/rules.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveEmailModelConfig } from "@/lib/ai/emailModel";
import { fetchWritingRules, insertWritingRule, recordUsage } from "@/lib/ai/aiEmailStore";
import { classifyRuleIntake, selectPromptRules } from "@/lib/ai/writingRules";
import { PERMANENT_RULES } from "@/lib/ai/soloxsnapsWritingProfile";

export const dynamic = "force-dynamic";

const MAX_TOKENS = 900;

async function persistSession(
  sessionId: string | null,
  messages: { role: string; content: string }[],
): Promise<string> {
  try {
    const supabase = createSupabaseServerClient();
    if (sessionId) {
      await supabase.from("ai_training_sessions").update({ messages }).eq("id", sessionId);
      return sessionId;
    }
    const { data } = await supabase
      .from("ai_training_sessions")
      .insert({ messages })
      .select("id")
      .single();
    return String(data?.id ?? "");
  } catch (err) {
    console.error("[train-ai] persistSession failed:", err);
    return sessionId ?? "";
  }
}

function buildSystem(approvedRules: string[]): string {
  const existing = approvedRules.length
    ? `\n\nRules Chris has already approved. Do not propose these again:\n${approvedRules.map((rule) => `- ${rule}`).join("\n")}`
    : "\n\nNo learned rules are approved yet.";

  return `You help Chris Solorzano train the email assistant for his photography business.

Chris will talk about how he wants emails written. Reply naturally and briefly: confirm what you understood, and ask a question if his preference is ambiguous.

Then propose any new rule his message implies, in a JSON block at the very end of every reply:
<rules>
["rule one", "rule two"]
</rules>
Use an empty array when he expressed no preference.

A rule must be one sentence, phrased as an instruction, and about HOW to write rather than about one client, date, price, or place. Never propose a rule that merely restates a permanent rule below.

These are permanent and always active, so they are never rules to propose:
${PERMANENT_RULES.map((rule) => `- ${rule}`).join("\n")}${existing}`;
}

/** Keeps a partial <rules> tag from being streamed to the client as text. */
const TAIL_BUFFER = 400;

function sseStream(payload: unknown): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return sseStream({ type: "error", message: "ANTHROPIC_API_KEY is not configured." });

  const { messages, session_id } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    session_id?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return sseStream({ type: "error", message: "messages array required" });
  }

  const config = resolveEmailModelConfig();
  const existingRules = await fetchWritingRules();
  const approved = selectPromptRules(existingRules, 40).map((rule) => rule.rule);
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const claudeStream = await client.messages.stream({
          model: config.model,
          max_tokens: MAX_TOKENS,
          output_config: { effort: config.effort },
          system: buildSystem(approved),
          messages,
        });

        let fullText = "";
        let sentUpTo = 0;

        for await (const event of claudeStream) {
          if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
          fullText += event.delta.text;
          const safeEnd = fullText.length - TAIL_BUFFER;
          if (safeEnd > sentUpTo) {
            emit({ type: "text", text: fullText.slice(sentUpTo, safeEnd) });
            sentUpTo = safeEnd;
          }
        }

        const tail = fullText.slice(sentUpTo).split("<rules>")[0];
        if (tail) emit({ type: "text", text: tail });

        const match = fullText.match(/<rules>\s*(\[[\s\S]*?\])\s*<\/rules>/);
        let proposed: string[] = [];
        if (match) {
          try { proposed = JSON.parse(match[1]) as string[]; } catch { /* malformed block, no rules */ }
        }

        const reply = fullText.replace(/<rules>[\s\S]*?<\/rules>/, "").trim();
        const savedSessionId = await persistSession(session_id ?? null, [
          ...messages,
          { role: "assistant", content: reply },
        ]);

        // Only genuinely new rules are stored, and only as pending. A duplicate
        // or a contradiction is reported back rather than appended.
        const pending: { id: string; rule: string }[] = [];
        const skipped: { rule: string; verdict: string }[] = [];

        for (const rule of proposed) {
          if (typeof rule !== "string" || rule.trim().length < 12) continue;
          const intake = classifyRuleIntake(rule, existingRules);
          if (intake.verdict !== "new") {
            skipped.push({ rule, verdict: intake.verdict });
            continue;
          }
          const row = await insertWritingRule({
            rule, category: "style", status: "pending", source: "train-chat",
          });
          if (row) pending.push({ id: row.id, rule: row.rule });
        }

        const usage = await claudeStream.finalMessage();
        await recordUsage({
          operation: "learn",
          model: usage.model,
          input_tokens: usage.usage.input_tokens,
          output_tokens: usage.usage.output_tokens,
          cache_creation_input_tokens: usage.usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usage.usage.cache_read_input_tokens ?? 0,
          duration_ms: 0,
          success: true,
        });

        emit({
          type: "done",
          new_rules: pending.map((row) => row.rule),
          pending,
          skipped,
          session_id: savedSessionId,
        });
      } catch (err) {
        console.error("[train-ai] stream error:", err);
        emit({ type: "error", message: "Something went wrong. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
