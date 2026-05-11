// POST /api/train-ai
//
// Conversational training endpoint. Chris chats naturally about how he wants
// the AI to behave. Claude extracts concrete style rules, then writes them
// into the Supabase vault_notes table ("09 AI Instructions" / "Email Rules"),
// replacing any conflicting rules so the note stays clean and authoritative.
//
// Body: { messages: {role:"user"|"assistant", content:string}[] }
// Response: { reply: string, saved_to_vault: boolean, new_rules: string[] }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function readCurrentRules(): Promise<{ id: string | null; content: string }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("vault_notes")
      .select("id, content")
      .eq("folder", "09 AI Instructions")
      .eq("title", "Email Rules")
      .single();
    return { id: data?.id ?? null, content: data?.content ?? "" };
  } catch {
    return { id: null, content: "" };
  }
}

async function writeRules(id: string | null, content: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (id) {
    await supabase.from("vault_notes").update({ content }).eq("id", id);
  } else {
    await supabase.from("vault_notes").insert({
      folder: "09 AI Instructions",
      title: "Email Rules",
      content,
    });
  }
}

const EXTRACT_SYSTEM = `You are a helpful assistant that helps Chris Solorzano train an AI email assistant for his photography business (soloxsnaps.com).

Chris will chat with you naturally about how he wants the AI to write emails — what to say, what not to say, corrections, tone preferences, etc.

Your job:
1. Have a natural, friendly conversation. Acknowledge what he said, confirm what you understood.
2. At the end of EVERY response, extract any new instructions as concrete rules.

Always end your response with a JSON block in this exact format (empty array if no new rules):
<rules>
["rule 1", "rule 2"]
</rules>

Rules must be:
- Short and actionable (one sentence)
- Written as instructions for Claude: "Always X", "Never Y", "If Z then W"
- Specific enough to be unambiguous

If Chris is just chatting with no new instruction, return an empty array.

Hard rules already in place (do not re-extract these — they are already saved):
- Never add a sign-off or name at the end of emails — end with the last line of content only
- No em dashes (—) in email output — use commas or rewrite the sentence instead`;

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

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const client = new Anthropic({ apiKey });
  const { id: rulesId, content: currentRules } = await readCurrentRules();

  const contextNote = currentRules
    ? `\n\nCurrent Email Writer Rules (from vault):\n${currentRules}`
    : "\n\nNo rules saved yet.";

  // Step 1: Conversation + rule extraction
  const extractRes = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: EXTRACT_SYSTEM + contextNote,
    messages,
  });

  const raw = extractRes.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const rulesMatch = raw.match(/<rules>\s*(\[[\s\S]*?\])\s*<\/rules>/);
  let newRules: string[] = [];
  if (rulesMatch) {
    try { newRules = JSON.parse(rulesMatch[1]) as string[]; } catch { /* ignore */ }
  }

  const reply = raw.replace(/<rules>[\s\S]*?<\/rules>/, "").trim();

  // Step 2: If there are new rules, merge them into the vault note
  let savedToVault = false;
  if (newRules.length > 0) {
    try {
      const mergeRes = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: MERGE_SYSTEM,
        messages: [{
          role: "user",
          content: `Current Email Writer Rules note:\n\n---\n${currentRules || "(empty)"}\n---\n\nNew rules to integrate (replace conflicts, add new, remove outdated):\n\n${newRules.map(r => `- ${r}`).join("\n")}\n\nOutput the updated note only.`,
        }],
      });

      const updatedNote = mergeRes.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      await writeRules(rulesId, updatedNote);
      savedToVault = true;
    } catch (err) {
      console.error("[train-ai] vault write error", err);
    }
  }

  return NextResponse.json({ reply, new_rules: newRules, saved_to_vault: savedToVault });
}
