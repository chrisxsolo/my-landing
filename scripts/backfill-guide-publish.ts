// Phase 2 of the 2026-07-17 backfill: approve the reviewed draft items from
// backfill-guide-placements.ts and publish them through the engine's real
// publish flow (derivatives → transactional RPC → revalidation). Revalidation
// runs as a no-op here (no admin cookie outside Vercel) — the affected school
// pages are ISR-backed hourly and the campus-spots page fetches client-side,
// so content appears without a manual revalidate.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-guide-publish.ts

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applyStatusAction } from "@/lib/contentEngine/itemTransitions";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";

// Reviewed 2026-07-17: every item is a q9-10 photo whose analysis clearly
// matches its destination.
const ITEM_IDS = [
  // Tara — /grads/sf-state gallery (Legion of Honor session, SFSU sash)
  "d7db3ef6-654f-48e7-a128-50229a8659f6",
  "02a76306-2bf1-43fe-85dc-e65a54e3de4c",
  "03651a14-c711-4afc-8bf2-8974082ab43c",
  "f59e021e-b938-4722-9f76-e4e374902e96",
];

async function main() {
  const client = createSupabaseAdminClient();
  const deferredPaths = new Set<string>();

  for (const itemId of ITEM_IDS) {
    const approval = await applyStatusAction({ client, itemId, action: "approve" });
    if (approval.outcome !== "done") {
      console.error(`approve ${itemId}: ${approval.outcome} — skipping publish`);
      continue;
    }
    const result = await publishApprovedItem({
      client, itemId,
      revalidate: (path) => { deferredPaths.add(path); },
    });
    if (result.status === "published") {
      console.log(`published ${itemId} → ${result.targetType} ${result.targetId}`);
    } else {
      console.error(`publish ${itemId}: ${result.status} — ${"reason" in result ? result.reason : result.error}`);
    }
  }
  console.log("\npaths refreshed by hourly ISR:", [...deferredPaths].join(", "));
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
