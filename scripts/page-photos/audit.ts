// Page photo audit: runs the exact resolver the public pages use and reports,
// for every school page and location guide, how many photos are matched and
// shown — plus every grads photo that could not be given a school, and every
// photo held back for permission/exclusion. Read-only.
//
// Run: npx tsx --env-file=.env.local scripts/page-photos/audit.ts [--json]

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { buildPagePhotoReport } from "@/lib/pagePhotos/adminView";

async function main() {
  const report = await buildPagePhotoReport(createSupabaseAdminClient());
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (report.errors.length) console.log("READ ERRORS (pool incomplete):", report.errors);

  console.log("\nPAGES  (own = explicit placements · matched = automatic · shown = on the page)");
  for (const page of report.pages) {
    console.log(`  ${page.path.padEnd(52)} own ${String(page.ownCount).padStart(3)}  matched ${String(page.matchedCount).padStart(3)}  shown ${String(page.shownCount).padStart(3)}  hidden ${page.hiddenCount}`);
  }

  console.log("\nSCHOOL SOURCES (grads photos):", report.schoolSources);
  console.log(`\nGRADS PHOTOS WITHOUT A SCHOOL PAGE (${report.unmatchedGrads.length}):`);
  for (const p of report.unmatchedGrads) console.log(`  #${p.portfolioId}  ${p.title.slice(0, 60).padEnd(60)}  ${p.note}`);

  console.log(`\nHELD BACK (${report.heldBack.length}):`);
  for (const p of report.heldBack) console.log(`  #${p.portfolioId}  ${p.title.slice(0, 60).padEnd(60)}  ${p.reason}`);

  console.log("\nSESSIONS NEEDING METADATA:");
  for (const s of report.sessionsNeedingFacts) console.log(`  ${s.sessionId}  ${s.name ?? "(no name)"}  ${s.issue}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
