// POST /api/train-ai
//
// Conversational training endpoint. Chris chats naturally; Claude extracts
// concrete style rules and writes them to vault_notes ("09 AI Instructions" / "Email Rules").
//
// Body: { messages: {role:"user"|"assistant", content:string}[], session_id?: string }
// Response: SSE stream of:
//   { type:"text", text: string }        — reply tokens as they arrive
//   { type:"done", new_rules, saved_to_vault, session_id }

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const RULES_FOLDER = "09 AI Instructions";
const RULES_TITLE  = "Email Rules";

async function readCurrentRules(): Promise<{ id: string | null; content: string }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("vault_notes")
      .select("id, content")
      .eq("folder", RULES_FOLDER)
      .eq("title", RULES_TITLE)
      .single();
    return { id: data?.id ?? null, content: data?.content ?? "" };
  } catch (err) {
    console.error("[train-ai] readCurrentRules error", err);
    return { id: null, content: "" };
  }
}

async function writeRules(id: string | null, content: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (id) {
    const { error } = await supabase.from("vault_notes").update({ content }).eq("id", id);
    if (error) console.error("[train-ai] writeRules update error", error);
  } else {
    const { error } = await supabase.from("vault_notes").insert({
      folder: RULES_FOLDER,
      title: RULES_TITLE,
      content,
    });
    if (error) console.error("[train-ai] writeRules insert error", error);
  }
}

async function persistSession(
  sessionId: string | null,
  messages: { role: string; content: string }[]
): Promise<string> {
  const supabase = createSupabaseServerClient();
  if (sessionId) {
    await supabase
      .from("ai_training_sessions")
      .update({ messages })
      .eq("id", sessionId);
    return sessionId;
  }
  const { data } = await supabase
    .from("ai_training_sessions")
    .insert({ messages })
    .select("id")
    .single();
  return String(data?.id ?? "");
}

function buildExtractSystem(currentRules: string): string {
  const rulesSection = currentRules
    ? `\n\nCurrent saved rules (already in vault — do NOT re-extract these verbatim):\n${currentRules}`
    : "\n\nNo rules saved yet.";

  return `You are a helpful assistant that helps Chris Solorzano train an AI email assistant for his photography business (soloxsnaps.com).

Chris will chat with you naturally about how he wants the AI to write emails — what to say, what not to say, corrections, tone preferences, etc.

Your job:
1. Have a natural, friendly conversation. Acknowledge what he said, confirm what you understood.
2. At the end of EVERY response, extract any new instructions as concrete rules — even if Chris is being casual or conversational. If there is ANY implied preference or instruction in what he said, extract it.

Always end your response with a JSON block in this exact format (empty array only if there is truly zero instruction or preference):
<rules>
["rule 1", "rule 2"]
</rules>

Rules must be:
- Short and actionable (one sentence)
- Written as instructions for Claude: "Always X", "Never Y", "If Z then W"
- Specific enough to be unambiguous
- Extracted even from conversational hints (e.g. "I usually keep it short" → "Keep replies concise — 3 sentences or fewer unless the question requires detail")

Hard rules already saved (never re-extract):
- Never add a sign-off or name at the end of emails — end with the last line of content only
- No em dashes (—) in email output — use commas or rewrite the sentence instead${rulesSection}`;
}

const MERGE_SYSTEM = `You are a knowledge base editor for a photography business. Your job is to maintain a clean, well-structured markdown note of AI email writing rules.

Editing rules:
- If a new rule CONTRADICTS or SUPERSEDES an existing rule, DELETE the old rule and ADD the new one
- If a new rule is essentially the same as an existing one, KEEP the existing wording — no duplicates
- If a new rule is genuinely new, ADD it under the most relevant ## section
- NEVER keep two rules that say opposite or conflicting things — always prefer the newer rule
- Preserve all YAML frontmatter exactly as-is (the --- block at the top)
- Preserve the existing ## section structure
- Update the last_updated frontmatter field to today's date
- If a new rule doesn't fit any existing section, add it under ## Learned Rules
- Output ONLY the updated markdown note — no explanation, no preamble`;

// Buffer to safely stream text without accidentally emitting a partial <rules> tag.
// Keeps the last TAIL chars buffered; emits the safe prefix each iteration.
const TAIL_BUFFER = 400;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const encoder = new TextEncoder();
    const errStream = new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "No API key" })}\n\n`));
        c.close();
      },
    });
    return new Response(errStream, { headers: { "Content-Type": "text/event-stream" } });
  }

  const { messages, session_id } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    session_id?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    const encoder = new TextEncoder();
    const errStream = new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "messages array required" })}\n\n`));
        c.close();
      },
    });
    return new Response(errStream, { headers: { "Content-Type": "text/event-stream" } });
  }

  const client = new OpenAI({ apiKey });
  const { id: rulesId, content: currentRules } = await readCurrentRules();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const openaiStream = await client.chat.completions.create({
          model: "gpt-4.1",
          max_tokens: 800,
          stream: true,
          messages: [
            { role: "system", content: buildExtractSystem(currentRules) },
            ...messages,
          ],
        });

        let fullText = "";
        let sentUpTo = 0;

        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            fullText += text;
            // Emit the safe prefix — keep TAIL_BUFFER chars buffered to avoid
            // splitting a <rules> tag across two emit calls.
            const safeEnd = fullText.length - TAIL_BUFFER;
            if (safeEnd > sentUpTo) {
              emit({ type: "text", text: fullText.slice(sentUpTo, safeEnd) });
              sentUpTo = safeEnd;
            }
          }
        }

        // Stream done — emit buffered tail with <rules> block stripped
        const tail = fullText.slice(sentUpTo);
        const cleanTail = tail.split("<rules>")[0];
        if (cleanTail) emit({ type: "text", text: cleanTail });

        // Parse rules
        const rulesMatch = fullText.match(/<rules>\s*(\[[\s\S]*?\])\s*<\/rules>/);
        let newRules: string[] = [];
        if (rulesMatch) {
          try { newRules = JSON.parse(rulesMatch[1]) as string[]; } catch { /* ignore */ }
        }

        const reply = fullText.replace(/<rules>[\s\S]*?<\/rules>/, "").trim();

        // Persist session
        const allMessages = [...messages, { role: "assistant", content: reply }];
        const savedSessionId = await persistSession(session_id ?? null, allMessages).catch(() => "");

        // Merge rules into vault (second Claude call — non-streaming)
        let savedToVault = false;
        if (newRules.length > 0) {
          try {
            const mergeRes = await client.chat.completions.create({
              model: "gpt-4.1",
              max_tokens: 1600,
              messages: [
                { role: "system", content: MERGE_SYSTEM },
                {
                  role: "user",
                  content: `Current Email Writer Rules note:\n\n---\n${currentRules || "(empty)"}\n---\n\nNew rules to integrate (replace conflicts, add new, remove outdated):\n\n${newRules.map(r => `- ${r}`).join("\n")}\n\nOutput the updated note only.`,
                },
              ],
            });

            const updatedNote = (mergeRes.choices[0]?.message?.content ?? "").trim();

            await writeRules(rulesId, updatedNote);
            savedToVault = true;
          } catch (err) {
            console.error("[train-ai] vault write error", err);
          }
        }

        emit({ type: "done", new_rules: newRules, saved_to_vault: savedToVault, session_id: savedSessionId });
      } catch (err) {
        console.error("[train-ai] stream error", err);
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
      "Connection": "keep-alive",
    },
  });
}
