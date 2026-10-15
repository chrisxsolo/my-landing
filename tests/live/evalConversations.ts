// ─────────────────────────────────────────────────────────────────────────────
// Live evaluation of multi-turn behaviour.
//
//   AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalConversations.ts
//
// Each case is one turn of a real conversation, carrying only the messages
// that existed before Chris replied. The question is not whether the draft is
// a good email in isolation but whether it is a good NEXT email: does it
// answer the new question without re-selling the date, the location, the price
// and the invoice step that were settled three messages ago?
//
// Chris's real reply is printed alongside for comparison. It is never shown to
// the model. See tests/live/conversationCases.ts for the point-in-time rule.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolveEmailModelConfig, createEmailModelCaller } from "../../lib/ai/emailModel";
import { generateDraft } from "../../lib/ai/emailOperations";
import { estimateUsageCostUsd } from "../../lib/ai/modelPricing";
import { CONVERSATION_CASES, type ConversationCase } from "./conversationCases";

config({ path: ".env.local" });

const OUT_DIR = ".eval-out";

type Finding = { kind: string; detail: string };

/** Deterministic checks for one turn, from the case's own expectations. */
function check(testCase: ConversationCase, draft: string): Finding[] {
  const findings: Finding[] = [];
  const lower = draft.toLowerCase();

  for (const phrase of testCase.expect.mustNotRepeat ?? []) {
    if (lower.includes(phrase.toLowerCase())) {
      findings.push({ kind: "repeats_settled", detail: phrase });
    }
  }
  for (const price of testCase.expect.forbiddenPrices ?? []) {
    if (draft.includes(price)) {
      findings.push({ kind: "stale_price", detail: price });
    }
  }
  for (const keyword of testCase.expect.shouldAddress ?? []) {
    if (!lower.includes(keyword.toLowerCase())) {
      findings.push({ kind: "unaddressed", detail: keyword });
    }
  }
  const words = draft.split(/\s+/).filter(Boolean).length;
  if (testCase.expect.maxWords && words > testCase.expect.maxWords) {
    findings.push({ kind: "too_long", detail: `${words} words, expected at most ${testCase.expect.maxWords}` });
  }
  return findings;
}

async function main(): Promise<void> {
  if (process.env.AI_LIVE_EVAL !== "1") {
    console.log("Live evaluation is off. Re-run with AI_LIVE_EVAL=1 to make real, paid API calls.");
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const modelConfig = resolveEmailModelConfig();
  const call = createEmailModelCaller(apiKey, modelConfig);

  console.log(`Model: ${modelConfig.model} · effort ${modelConfig.effort}`);
  console.log(`${CONVERSATION_CASES.length} conversation turns\n`);

  const usages = [];
  const records = [];

  for (const testCase of CONVERSATION_CASES) {
    const result = await generateDraft({
      inquiry: testCase.inquiry,
      messages: testCase.history,
      availability: testCase.availability,
      threadLoaded: true,
      rules: [],
      latestClientMessage: testCase.latestClientMessage,
      threadText: testCase.history
        .map((m) => `${m.fromMe ? "Chris" : "Client"}: ${m.body}`)
        .join("\n\n"),
      now: new Date(testCase.history.at(-1)!.timestamp as string),
    }, call);

    usages.push(result.usage);
    const findings = check(testCase, result.draft);
    const words = result.draft.split(/\s+/).filter(Boolean).length;

    records.push({
      id: testCase.id,
      stage: testCase.stage,
      words,
      valid: result.validation.valid,
      issues: result.validation.issues,
      findings,
      draft: result.draft,
      chrisActuallyWrote: testCase.chrisActuallyWrote,
    });

    console.log("═".repeat(72));
    console.log(`${testCase.id} · ${testCase.stage}`);
    console.log(`CLIENT: ${testCase.latestClientMessage.slice(0, 150)}`);
    console.log("─".repeat(72));
    console.log("DRAFT:");
    console.log(result.draft);
    console.log("─".repeat(72));
    console.log("CHRIS ACTUALLY WROTE:");
    console.log(testCase.chrisActuallyWrote);
    console.log("─".repeat(72));
    console.log(`  ${words} words (Chris: ${testCase.chrisActuallyWrote.split(/\s+/).length}) · validator ${result.validation.valid ? "PASS" : "FAIL"}`);
    for (const issue of result.validation.issues) {
      console.log(`    [${issue.severity}] ${issue.type}: ${issue.excerpt ?? issue.description}`);
    }
    for (const finding of findings) {
      console.log(`    >> ${finding.kind}: ${finding.detail}`);
    }
    console.log();
  }

  const { totalUsd } = estimateUsageCostUsd(usages);
  const clean = records.filter((r) => r.valid && !r.findings.length).length;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/live-conversations.json`, JSON.stringify({ records }, null, 2));

  console.log("═".repeat(72));
  console.log(`${records.length} turns · ${clean} clean · ${records.length - clean} with findings`);
  console.log(`Measured cost: $${totalUsd.toFixed(4)}`);
  console.log(`Written to ${OUT_DIR}/live-conversations.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
