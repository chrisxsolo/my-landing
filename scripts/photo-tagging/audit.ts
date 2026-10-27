// Photo tagging audit: runs the same rules as the admin (lib/photoTagging) over
// every Portfolio and Content Engine photo and prints the status counts, what
// is missing, and the suggestions on offer. Read-only.
//
// Run: npx tsx --env-file=.env.local scripts/photo-tagging/audit.ts [--json] [--list]
//      --apply-high   also apply every HIGH-confidence suggestion (fills empty fields only)

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { executePlan } from "@/lib/photoTagging/apply";
import { planHighConfidence } from "@/lib/photoTagging/highConfidence";
import { loadAudit, toReport } from "@/lib/photoTagging/library";

async function main() {
  const client = createSupabaseAdminClient();
  const audit = await loadAudit(client);
  const report = toReport(audit);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (report.errors.length) console.log("READ ERRORS (audit incomplete):", report.errors);
  console.log("\nCOUNTS", report.counts);

  const bySource = (source: string) => report.photos.filter((p) => p.source === source);
  for (const source of ["portfolio", "engine"]) {
    const photos = bySource(source);
    const tally = (s: string) => photos.filter((p) => p.status === s).length;
    console.log(`  ${source.padEnd(9)} ${photos.length} photos · full ${tally("full")} · partial ${tally("partial")} · needs ${tally("needs")}`);
  }

  const gaps = new Map<string, number>();
  for (const p of report.photos) {
    for (const c of p.checks.filter((c) => c.state === "missing")) {
      const label = `${p.category ?? "?"} · ${c.field} · ${c.note}`;
      gaps.set(label, (gaps.get(label) ?? 0) + 1);
    }
  }
  console.log("\nMISSING (category · field · why):");
  for (const [label, n] of [...gaps].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${label}`);

  const suggestions = report.photos.flatMap((p) => p.suggestions.map((s) => ({ p, s })));
  console.log(`\nSUGGESTIONS (${suggestions.length}):`);
  for (const { p, s } of suggestions) {
    console.log(`  ${s.confidence.padEnd(6)} ${p.key.padEnd(48)} ${s.field}=${s.label}  (${s.reason})`);
  }

  if (process.argv.includes("--list")) {
    console.log("\nNEEDS TAGGING:");
    for (const p of report.photos.filter((p) => p.status === "needs")) console.log(`  ${p.key.padEnd(48)} ${p.title.slice(0, 60)}`);
  }

  if (process.argv.includes("--apply-high")) {
    if (report.errors.length) throw new Error("audit incomplete — refusing to write tags");
    const result = await executePlan(client, planHighConfidence(audit.entries));
    console.log("\nAPPLIED HIGH-CONFIDENCE:", {
      updated: result.updated, failed: result.failed, kept: result.kept, skipped: result.skipped,
      conflicts: result.conflicts, failures: result.failures,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
