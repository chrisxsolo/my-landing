// ─────────────────────────────────────────────────────────────────────────────
// One-time import of the legacy "09 AI Instructions / Email Rules" vault note
// into the ai_writing_rules table.
//
// Run:  npx tsx --env-file=.env.local scripts/migrate-email-rules.ts [--apply]
//
// Dry run by default: it prints what it would import, including which rules it
// reads as duplicates or contradictions, and writes nothing. Pass --apply to
// insert.
//
// Everything lands as status='pending'. That is the point of the exercise — the
// note's 76 rules include direct contradictions ("Omit personal greetings such
// as 'Hi Anna,'" against "Open with the client's name as the greeting") and
// one-off factual corrections stored as style rules ('Use "Kaitlyn" not
// "Caitlin"'). Importing them as approved would carry the original problem
// into the new system. Chris approves what he still wants.
//
// The vault note is never modified, so the Obsidian sync keeps working and
// this script is safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { normalizeRule, classifyRuleIntake, type WritingRule } from "../lib/ai/writingRules";
import { PERMANENT_RULES } from "../lib/ai/soloxsnapsWritingProfile";

config({ path: ".env.local" });

const RULES_FOLDER = "09 AI Instructions";
const RULES_TITLE = "Email Rules";

/** Strips the leading bullet and the "[YYYY-MM-DD]" stamp. */
function parseRuleLine(line: string): { text: string; date: string | null } | null {
  const bullet = line.match(/^\s*[-–•*]\s+(.*)$/);
  if (!bullet) return null;

  const body = bullet[1].trim();
  // The note is currently truncated mid-rule by the old LLM merge, leaving a
  // dangling "- [". Anything that short is wreckage, not a rule.
  if (body.length < 12) return null;

  const stamped = body.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.+)$/);
  return stamped
    ? { text: stamped[2].trim(), date: stamped[1] }
    : { text: body, date: null };
}

/** True when a rule merely restates something already permanent in code. */
function isAlreadyPermanent(text: string): boolean {
  const normalized = normalizeRule(text);
  return PERMANENT_RULES.some((permanent) => {
    const permanentWords = new Set(normalizeRule(permanent).split(" ").filter((w) => w.length > 3));
    const ruleWords = new Set(normalized.split(" ").filter((w) => w.length > 3));
    if (!permanentWords.size || !ruleWords.size) return false;
    let shared = 0;
    for (const word of ruleWords) if (permanentWords.has(word)) shared += 1;
    return shared / Math.min(permanentWords.size, ruleWords.size) >= 0.6;
  });
}

/** Heuristic for a rule that is really a one-off correction. */
function looksFactual(text: string): boolean {
  return (
    /\bnot\s+"[^"]+"/i.test(text) ||
    /\buse\s+"[^"]+"\s+not\s+"[^"]+"/i.test(text) ||
    /\bfrom\s+\d{1,2}:\d{2}\s*(?:am|pm)?\s+to\s+\d{1,2}:\d{2}/i.test(text) ||
    /\breplace\s+"[^"]{20,}"\s+with\s+"/i.test(text) ||
    /\$\d/.test(text)
  );
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data: note, error: noteError } = await supabase
    .from("vault_notes")
    .select("content")
    .eq("folder", RULES_FOLDER)
    .eq("title", RULES_TITLE)
    .single();

  if (noteError || !note?.content) {
    console.error("Could not read the Email Rules vault note:", noteError?.message ?? "empty");
    process.exit(1);
  }

  const parsed = (note.content as string)
    .split("\n")
    .map(parseRuleLine)
    .filter((entry): entry is { text: string; date: string | null } => entry !== null);

  console.log(`Parsed ${parsed.length} rule lines from the vault note.\n`);

  const { data: existingRows } = await supabase
    .from("ai_writing_rules")
    .select("id, rule, category, status, source, created_at, superseded_by");

  const existing: WritingRule[] = (existingRows ?? []).map((row) => ({
    id: row.id as string,
    rule: row.rule as string,
    category: row.category as WritingRule["category"],
    status: row.status as WritingRule["status"],
    source: row.source as string,
    createdAt: row.created_at as string,
    supersededBy: row.superseded_by as string | null,
  }));

  const accumulated: WritingRule[] = [...existing];
  const toInsert: { rule: string; category: string; rule_key: string }[] = [];
  const skipped: { text: string; reason: string }[] = [];
  const seenKeys = new Set(existing.map((rule) => normalizeRule(rule.rule)));

  // Newest first, so when two vault rules contradict each other the newer one
  // is the one imported and the older is reported as the conflict.
  const ordered = [...parsed].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  for (const entry of ordered) {
    const key = normalizeRule(entry.text);

    if (seenKeys.has(key)) { skipped.push({ text: entry.text, reason: "duplicate of an existing row" }); continue; }
    if (isAlreadyPermanent(entry.text)) { skipped.push({ text: entry.text, reason: "already a permanent rule in code" }); continue; }

    if (looksFactual(entry.text)) {
      // Kept, but as 'factual' so it can never reach a prompt.
      seenKeys.add(key);
      accumulated.push({
        id: `pending-${toInsert.length}`, rule: entry.text, category: "factual",
        status: "pending", source: "migrated-vault", createdAt: entry.date ?? "",
      });
      toInsert.push({ rule: entry.text, category: "factual", rule_key: key });
      continue;
    }

    const intake = classifyRuleIntake(entry.text, accumulated);
    if (intake.verdict === "duplicate") { skipped.push({ text: entry.text, reason: "near-duplicate of a rule already imported" }); continue; }

    // A conflict is still imported as pending; the conflict is surfaced in the
    // UI when Chris reviews it, which is where the decision belongs.
    if (intake.verdict === "conflict") {
      console.log(`CONFLICT  ${entry.text}`);
      for (const conflict of intake.conflicts ?? []) {
        console.log(`          vs "${conflict.existing.rule}" — ${conflict.reason}`);
      }
    }

    seenKeys.add(key);
    accumulated.push({
      id: `pending-${toInsert.length}`, rule: entry.text, category: "style",
      status: "pending", source: "migrated-vault", createdAt: entry.date ?? "",
    });
    toInsert.push({ rule: entry.text, category: "style", rule_key: key });
  }

  console.log(`\nWould import ${toInsert.length} rules as pending.`);
  console.log(`  style:   ${toInsert.filter((r) => r.category === "style").length}`);
  console.log(`  factual: ${toInsert.filter((r) => r.category === "factual").length} (never sent to Claude)`);
  console.log(`Skipped ${skipped.length}:`);
  for (const entry of skipped) console.log(`  - ${entry.reason}: ${entry.text.slice(0, 80)}`);

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to insert.");
    return;
  }

  const { error: insertError } = await supabase.from("ai_writing_rules").insert(
    toInsert.map((row) => ({
      rule: row.rule,
      category: row.category,
      status: "pending",
      source: "migrated-vault",
      rule_key: row.rule_key,
    })),
  );

  if (insertError) {
    console.error("\nInsert failed:", insertError.message);
    process.exit(1);
  }
  console.log(`\nImported ${toInsert.length} rules as pending. Approve the ones you still want on the AI tab.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
