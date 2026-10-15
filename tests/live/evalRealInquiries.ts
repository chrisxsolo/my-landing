// ─────────────────────────────────────────────────────────────────────────────
// Opt-in live evaluation against REAL inquiries from the database.
//
//   AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalRealInquiries.ts
//
// The fixture harness (evalDrafts.ts) tests scenarios I invented, which share
// my assumptions about what an inquiry looks like. These are Chris's actual
// clients: vague messages, missing fields, session types filed under the wrong
// dropdown, several questions at once.
//
// Read-only on the database. Nothing is written, nothing is sent. Client
// emails are redacted in the output since the drafts are for reading, not for
// keeping.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolveEmailModelConfig, createEmailModelCaller } from "../../lib/ai/emailModel";
import { generateDraft } from "../../lib/ai/emailOperations";
import { estimateUsageCostUsd } from "../../lib/ai/modelPricing";
import { fetchAvailabilitySnapshot } from "../../lib/ai/availabilitySnapshot";
import { resolvePlaybookKey } from "../../lib/ai/soloxsnapsWritingProfile";

config({ path: ".env.local" });

/** Spread across session types rather than taking the newest N, which skews grad. */
const PER_TYPE = 2;

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

function redact(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain ?? "?"}`;
}

async function main(): Promise<void> {
  if (process.env.AI_LIVE_EVAL !== "1") {
    console.log("Live evaluation is off. Re-run with AI_LIVE_EVAL=1 to make real, paid API calls.");
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

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

  // Take the most recent few of each session type, so the sample covers the
  // awkward categories instead of 26 graduation inquiries.
  const byType = new Map<string, Row[]>();
  for (const raw of (data ?? []) as Row[]) {
    if (!raw.message || raw.message.trim().length < 40) continue;
    const key = raw.session_type ?? "(none)";
    const bucket = byType.get(key) ?? [];
    if (bucket.length < PER_TYPE) bucket.push(raw);
    byType.set(key, bucket);
  }
  const sample = [...byType.values()].flat();

  const availability = await fetchAvailabilitySnapshot();
  const config_ = resolveEmailModelConfig();
  const call = createEmailModelCaller(apiKey, config_);

  console.log(`Model: ${config_.model} · effort ${config_.effort}`);
  console.log(`${sample.length} real inquiries across ${byType.size} session types`);
  console.log(`Availability: ${availability ? `${availability.available.length} open dates` : "COULD NOT LOAD"}\n`);

  const usages = [];
  let failedValidation = 0;

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

    const resolved = resolvePlaybookKey(row.session_type, row.message);
    console.log("─".repeat(72));
    console.log(`#${row.id} · filed as "${row.session_type}" → resolved "${resolved ?? "UNRESOLVED"}" · ${redact(row.email)}`);
    console.log(`THEY WROTE: ${(row.message ?? "").replace(/\s+/g, " ").slice(0, 180)}`);
    console.log("─".repeat(72));
    console.log(result.draft);
    console.log();
    console.log(`  validator: ${result.validation.valid ? "PASS" : "FAIL"}${result.validation.needsReview ? " (needs review)" : ""}`);
    for (const issue of result.validation.issues) {
      console.log(`    [${issue.severity}] ${issue.type}: ${issue.description}${issue.excerpt ? ` — ${issue.excerpt}` : ""}`);
    }
    for (const warning of result.context.warnings.filter((w) => w.severity === "high")) {
      console.log(`    context [high] ${warning.code}: ${warning.message}`);
    }
    console.log(`    ${result.draft.split(/\s+/).filter(Boolean).length} words · ${result.usage.output_tokens} out\n`);
  }

  const { totalUsd, unknownModels } = estimateUsageCostUsd(usages);
  console.log("═".repeat(72));
  console.log(`${sample.length} drafts · ${sample.length} API calls · ${failedValidation} failed validation`);
  console.log(unknownModels.length
    ? `Cost cannot be estimated: ${unknownModels.join(", ")} not in the rate card.`
    : `Measured cost: $${totalUsd.toFixed(4)} · per draft $${(totalUsd / sample.length).toFixed(5)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
