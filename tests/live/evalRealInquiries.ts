// ─────────────────────────────────────────────────────────────────────────────
// Opt-in live evaluation against REAL inquiries from the database.
//
//   AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalRealInquiries.ts [split]
//
// split: dev | holdout | regression | all   (default: dev)
//
// The fixture harness (evalDrafts.ts) tests scenarios I invented, which share
// my assumptions about what an inquiry looks like. These are Chris's actual
// clients: vague messages, missing fields, session types filed under the wrong
// dropdown, several questions at once.
//
// Read-only on the database. Nothing is written, nothing is sent. Client
// emails are redacted in the output.
//
// ── Why there are splits ─────────────────────────────────────────────────────
// Tuning a classifier against the same inquiries you measure it on produces a
// number that means nothing. The split is deterministic (even/odd by id over
// the inquiries not used by the first evaluation), so:
//
//   dev        — the half defects may be diagnosed from
//   holdout    — the half that must not inform a single prompt or pattern
//   regression — the 11 the first evaluation used, kept as regressions
//
// Results are written to .eval-out/ so they can be re-read without paying for
// the run twice.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolveEmailModelConfig, createEmailModelCaller } from "../../lib/ai/emailModel";
import { generateDraft } from "../../lib/ai/emailOperations";
import { estimateUsageCostUsd } from "../../lib/ai/modelPricing";
import { fetchAvailabilitySnapshot } from "../../lib/ai/availabilitySnapshot";
import { classifySession } from "../../lib/ai/sessionClassifier";

config({ path: ".env.local" });

const OUT_DIR = ".eval-out";

/** The 11 inquiries the first evaluation drafted against. */
const REGRESSION_IDS = new Set([131, 123, 130, 128, 129, 127, 124, 115, 119, 111, 90]);

type Row = {
  id: number;
  name: string;
  email: string;
  session_type: string | null;
  message: string | null;
  school: string | null;
  people: string | null;
  date_in_mind: string | null;
  preferred_time: string | null;
  location: string | null;
};

type Split = "dev" | "holdout" | "regression" | "all";

function redact(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain ?? "?"}`;
}

/** Deterministic split, so a re-run never reshuffles dev and holdout. */
function splitOf(id: number, freshIdsAscending: number[]): Split {
  if (REGRESSION_IDS.has(id)) return "regression";
  return freshIdsAscending.indexOf(id) % 2 === 0 ? "dev" : "holdout";
}

async function main(): Promise<void> {
  if (process.env.AI_LIVE_EVAL !== "1") {
    console.log("Live evaluation is off. Re-run with AI_LIVE_EVAL=1 to make real, paid API calls.");
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const wanted = (process.argv[2] ?? "dev") as Split;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("inquiries")
    .select("id, name, email, session_type, message, school, people, date_in_mind, preferred_time, location")
    .not("message", "is", null)
    .order("created_at", { ascending: false });
  if (error) { console.error(error.message); process.exit(1); }

  const eligible = ((data ?? []) as Row[]).filter((r) => (r.message ?? "").trim().length >= 40);
  const freshIds = eligible
    .filter((r) => !REGRESSION_IDS.has(r.id))
    .map((r) => r.id)
    .sort((a, b) => a - b);

  const sample = eligible.filter((r) => wanted === "all" || splitOf(r.id, freshIds) === wanted);

  const availability = await fetchAvailabilitySnapshot();
  const modelConfig = resolveEmailModelConfig();
  const call = createEmailModelCaller(apiKey, modelConfig);

  console.log(`Model: ${modelConfig.model} · effort ${modelConfig.effort}`);
  console.log(`Split "${wanted}": ${sample.length} of ${eligible.length} eligible inquiries`);
  console.log(`Availability: ${availability ? `${availability.available.length} open dates` : "COULD NOT LOAD"}\n`);

  const usages = [];
  const records = [];
  let failedValidation = 0;
  let totalWords = 0;

  for (const row of sample) {
    const result = await generateDraft({
      inquiry: {
        name: row.name,
        email: row.email,
        sessionType: row.session_type,
        message: row.message ?? "",
        dateInMind: row.date_in_mind,
        preferredTime: row.preferred_time,
        location: row.location,
        school: row.school,
        people: row.people,
      },
      messages: [],
      availability,
      threadLoaded: true,
      rules: [],
      latestClientMessage: null,
      threadText: null,
    }, call);

    usages.push(result.usage);
    if (!result.validation.valid) failedValidation += 1;

    const words = result.draft.split(/\s+/).filter(Boolean).length;
    totalWords += words;

    const classification = classifySession(row.session_type, row.message);
    const split = splitOf(row.id, freshIds);

    records.push({
      id: row.id,
      split,
      filed: row.session_type,
      resolved: classification.key,
      ambiguous: classification.ambiguous,
      priced: result.context.pricing.verified,
      basePrices: result.context.pricing.basePrices,
      travelFact: result.context.pricing.travelFact,
      words,
      valid: result.validation.valid,
      needsReview: result.validation.needsReview,
      issues: result.validation.issues,
      warnings: result.context.warnings,
      draft: result.draft,
      theyWrote: (row.message ?? "").replace(/\s+/g, " "),
    });

    console.log("─".repeat(72));
    console.log(`#${row.id} [${split}] filed "${row.session_type}" → ${classification.key ?? "UNRESOLVED"}${classification.ambiguous ? " (AMBIGUOUS)" : ""} · ${redact(row.email)}`);
    console.log(`THEY WROTE: ${(row.message ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
    console.log("─".repeat(72));
    console.log(result.draft);
    console.log();
    console.log(`  validator: ${result.validation.valid ? "PASS" : "FAIL"}${result.validation.needsReview ? " (needs review)" : ""} · ${words} words`);
    for (const issue of result.validation.issues) {
      console.log(`    [${issue.severity}] ${issue.type}: ${issue.description}${issue.excerpt ? ` — ${issue.excerpt}` : ""}`);
    }
    for (const warning of result.context.warnings.filter((w) => w.severity !== "low")) {
      console.log(`    context [${warning.severity}] ${warning.code}`);
    }
    console.log();
  }

  const { totalUsd, unknownModels } = estimateUsageCostUsd(usages);
  const cacheRead = usages.reduce((sum, u) => sum + (u.cache_read_input_tokens ?? 0), 0);
  const cacheWrite = usages.reduce((sum, u) => sum + (u.cache_creation_input_tokens ?? 0), 0);
  const inputTokens = usages.reduce((sum, u) => sum + u.input_tokens, 0);
  const outputTokens = usages.reduce((sum, u) => sum + u.output_tokens, 0);

  const summary = {
    split: wanted,
    model: modelConfig.model,
    drafts: sample.length,
    apiCalls: sample.length,
    failedValidation,
    averageWords: sample.length ? Math.round(totalWords / sample.length) : 0,
    inputTokens, outputTokens, cacheRead, cacheWrite,
    estimatedCostUsd: Number(totalUsd.toFixed(5)),
    perDraftUsd: sample.length ? Number((totalUsd / sample.length).toFixed(6)) : 0,
    unknownModels,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/live-${wanted}.json`, JSON.stringify({ summary, records }, null, 2));

  console.log("═".repeat(72));
  console.log(`${sample.length} drafts · ${sample.length} API calls · ${failedValidation} failed validation · ${summary.averageWords} words average`);
  console.log(`tokens: ${inputTokens} in · ${outputTokens} out · ${cacheWrite} cache write · ${cacheRead} cache read`);
  console.log(unknownModels.length
    ? `Cost cannot be estimated: ${unknownModels.join(", ")} not in the rate card.`
    : `Measured cost: $${totalUsd.toFixed(4)} · per draft $${(totalUsd / Math.max(1, sample.length)).toFixed(5)}`);
  console.log(`Written to ${OUT_DIR}/live-${wanted}.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
