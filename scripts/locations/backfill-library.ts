// Backfill the Bay Area location library from every existing Content Engine
// session (2026-10-26). Uses the exact sync code the app runs, so it is safe
// to re-run: one row per place, links inserted only if absent, admin removals
// and hand-written content respected.
//
// Dry run (default) — prints what would change, writes nothing:
//   npx tsx --env-file=.env.local scripts/locations/backfill-library.ts
// Apply, then draft AI profiles for the new locations (unlocked fields only):
//   npx tsx --env-file=.env.local scripts/locations/backfill-library.ts --apply --profile
//
// Writes go straight to the database, so the public page's data cache keeps
// its old copy for up to an hour — press Revalidate in the admin afterwards.
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { syncAllSessions } from "@/lib/locationLibrary/sync";
import { generateLocationProfile } from "@/lib/locationLibrary/profile";

const apply = process.argv.includes("--apply");
const profile = process.argv.includes("--profile");

async function main() {
  const client = createSupabaseAdminClient();
  const report = await syncAllSessions(client, { dryRun: !apply });
  console.log(apply ? "APPLIED" : "DRY RUN — nothing written");

  console.log("\nExisting cards matched to places:");
  for (const c of report.claims) console.log(`  ${c.title} → ${c.key}`);
  if (report.claims.length === 0) console.log("  (none)");

  console.log("\nSessions:");
  for (const s of report.sessions) {
    const created = s.createdKeys.length ? ` | new drafts: ${s.createdKeys.join(", ")}` : "";
    const removed = s.removedLinks ? ` | stale links: ${s.removedLinks}` : "";
    console.log(`  ${s.sessionId.slice(0, 8)} [${s.status}] ${s.message}${created}${removed}`);
  }

  const newIds = report.sessions.flatMap((s) => s.createdLocationIds);
  if (!apply || !profile || newIds.length === 0) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing — drafts were created without AI text");
  const callModel = createAnthropicCaller(apiKey);
  console.log("\nAI profiles:");
  for (const id of newIds) {
    const r = await generateLocationProfile(client, callModel, id);
    console.log(`  #${id} [${r.status}] ${r.message}${r.updatedFields.length ? ` (${r.updatedFields.join(", ")})` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
