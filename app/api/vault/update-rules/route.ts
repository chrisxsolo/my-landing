// POST /api/vault/update-rules
//
// Takes new rules from a training conversation and merges them into
// the Obsidian vault's Email Writer Rules note.
//
// Claude reads the current note + new rules, then rewrites the note:
// - Replacing any rule that conflicts with a new one
// - Adding genuinely new rules
// - Never keeping outdated/contradicted rules
//
// Body: { new_rules: string[] }
// Response: { updated: true, note_path: string }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH
  ?? "/Users/chrissolo/Documents/Photography Business Soloxsnaps";

const RULES_NOTE = path.join(VAULT_PATH, "09 AI Instructions", "Email Rules.md");

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { new_rules }: { new_rules: string[] } = await req.json();
  if (!new_rules?.length) return NextResponse.json({ updated: false, reason: "no rules" });

  const currentNote = fs.readFileSync(RULES_NOTE, "utf-8");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: `You are a knowledge base editor for a photography business. Your job is to maintain a clean, well-structured markdown note of AI email writing rules.

Editing rules:
- If a new rule CONTRADICTS or SUPERSEDES an existing rule, DELETE the old rule and ADD the new one
- If a new rule is essentially the same as an existing one, KEEP the existing wording — no duplicates
- If a new rule is genuinely new, ADD it under the most relevant ## section
- NEVER keep two rules that say opposite or conflicting things — always prefer the newer rule
- Preserve all YAML frontmatter exactly as-is (the --- block at the top)
- Preserve the existing ## section structure
- Update the last_updated frontmatter field to today's date
- If a new rule doesn't fit any existing section, add it under ## Learned Rules
- Output ONLY the updated markdown note — no explanation, no preamble`,
    messages: [{
      role: "user",
      content: `Here is the current Email Writer Rules note:

---
${currentNote}
---

Here are the new rules to integrate (replace conflicts, add new ones, remove outdated ones):

${new_rules.map(r => `- ${r}`).join("\n")}

Output the updated note. Same markdown format. No preamble.`,
    }],
  });

  const updatedNote = response.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  fs.writeFileSync(RULES_NOTE, updatedNote + "\n", "utf-8");

  return NextResponse.json({ updated: true, note_path: RULES_NOTE, new_note: updatedNote });
}
