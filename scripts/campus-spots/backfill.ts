// Backfill /grad-guide/campus-spots: fills spots that have no photo from
// photos already public for that school (Portfolio + Content Engine), using
// the exact sync the app runs. Safe to re-run: spots that show a photo are
// never touched, and an earlier automatic pick stays while it is still public.
//
// Dry run (default) — prints the report, writes nothing:
//   npx tsx --env-file=.env.local scripts/campus-spots/backfill.ts
// Apply:
//   npx tsx --env-file=.env.local scripts/campus-spots/backfill.ts --apply
//
// Writes go straight to the database, so the public page's data cache keeps
// its old copy for up to an hour — press Revalidate in the admin afterwards
// (the worker tick's own sweep revalidates whenever it changes something).
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { syncCampusSpotPhotos } from "@/lib/campusSpotFill/sync";

const apply = process.argv.includes("--apply");

async function main() {
  const report = await syncCampusSpotPhotos(createSupabaseAdminClient(), { apply });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(apply ? "APPLIED" : "DRY RUN — nothing written");
  console.log(`\nCampus spots on the page:     ${report.totalSpots}`);
  console.log(`Already showing a photo:      ${report.withPhoto}`);
  console.log(`Missing a photo:              ${report.missing}`);
  console.log(`Automatic photos kept:        ${report.kept.length}`);
  console.log(`${apply ? "Filled now" : "Would fill"}:                   ${report.claimed.length}`);
  if (report.lostRaces) console.log(`Taken by another sync first:  ${report.lostRaces}`);

  for (const c of report.claimed) console.log(`  + ${c.schoolSlug} → ${c.spotKey}  [${c.evidence}: ${c.detail}]  ${c.imageUrl}`);
  for (const k of report.kept) console.log(`  = ${k.schoolSlug} → ${k.spotKey}  [${k.evidence}]  ${k.imageUrl}`);
  for (const r of report.released) console.log(`  - ${r.row.schoolSlug} → ${r.row.spotKey}  (${r.reason})`);

  console.log(`\nStill missing, no confident match (${report.unmatched.length}):`);
  for (const u of report.unmatched) console.log(`  ${u.spot}: ${u.reason}`);
  if (report.notMatchable.length) {
    console.log(`\nMissing, and no spot definition in lib/schoolSpots.ts (${report.notMatchable.length}):`);
    for (const name of report.notMatchable) console.log(`  ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
