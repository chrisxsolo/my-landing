// POST /api/vault/update-rules
//
// Takes new rules from the admin UI and merges them into the Supabase-backed
// Email Rules note that powers draft generation on the website.
//
// Body: { new_rules: string[] }
// Response: { updated: true, note_path: string }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const RULES_FOLDER = "09 AI Instructions";
const RULES_TITLE = "Email Rules";
const RULES_NOTE_PATH = `${RULES_FOLDER}/${RULES_TITLE}.md`;

function buildMergeSystem(today: string): string {
  return `You are a knowledge base editor for a photography business. Your job is to maintain a clean, well-structured markdown note of AI email writing rules.

Each rule in the note is timestamped in the format [YYYY-MM-DD] at the start of the line (e.g. "- [2026-05-11] always mention the travel fee upfront").
New rules being integrated today are dated ${today}.

Editing rules:
- If a new rule CONTRADICTS or SUPERSEDES an existing rule: DELETE the old rule, ADD the new one with today's date [${today}]
- When two rules conflict, ALWAYS prefer the one with the NEWER date, recency is the single source of truth
- If a new rule is essentially the same as an existing one: KEEP the existing rule unchanged (do not re-date it)
- If a new rule is genuinely new: ADD it under the most relevant ## section with today's date [${today}]
- NEVER keep two rules that say opposite or conflicting things
- Preserve all YAML frontmatter exactly as-is (the --- block at the top)
- Update the "updated" frontmatter field to ${today}
- Preserve the existing ## section structure
- If a new rule doesn't fit any existing section, add it under ## Learned Rules
- Output ONLY the updated markdown note, no explanation, no preamble`;
}

async function readCurrentRules() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("id, content")
    .eq("folder", RULES_FOLDER)
    .eq("title", RULES_TITLE)
    .single();

  if (error) throw error;
  return { id: data.id as string, content: data.content as string };
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { new_rules }: { new_rules: string[] } = await req.json();
  if (!new_rules?.length) return NextResponse.json({ updated: false, reason: "no rules" });

  const { id, content: currentNote } = await readCurrentRules();
  const today = new Date().toISOString().slice(0, 10);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1600,
    system: buildMergeSystem(today),
    messages: [{
      role: "user",
      content: `Here is the current Email Writer Rules note:

---
${currentNote}
---

Here are the new rules to integrate (replace conflicts, add new ones, remove outdated ones):

${new_rules.map(rule => `- [${today}] ${rule}`).join("\n")}

Output the updated note. Same markdown format. No preamble.`,
    }],
  });

  const updatedNote = response.content
    .filter(block => block.type === "text")
    .map(block => (block as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("vault_notes")
    .update({ content: updatedNote })
    .eq("id", id);

  if (error) {
    console.error("[vault/update-rules] supabase write error", error);
    return NextResponse.json({ error: "Failed to update cloud rules note" }, { status: 500 });
  }

  return NextResponse.json({ updated: true, note_path: RULES_NOTE_PATH, new_note: updatedNote });
}
