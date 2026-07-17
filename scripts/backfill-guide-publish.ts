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
// matches its destination (spot names verified against location_spots).
const ITEM_IDS = [
  // Kim — campus spots (grad guide)
  "30bcb7b1-aa9e-4b65-a275-838ac52f4347", // Sather Gate
  "907faded-876e-449a-b8bd-19572b6f0b62", // Doe Library Ledge
  "1e9688d8-2647-42e1-9806-ac0fc88f898a", // The Campanile
  // Kim — /grads/uc-berkeley gallery
  "3907ef3d-6d4c-4eda-906f-22df888e82d5",
  "bac51364-85af-4ccc-a102-a9a2c3616f5d",
  "48bd3e7f-5d21-47d2-aa9b-770d7d0d4589",
  "77ae96e8-7ff5-44e7-b639-a9e433b11e09",
  // Chantal — /grads/stanford gallery
  "f8a3fa57-2ce4-4042-ad6f-30d8577d6fb3",
  "1cad4ca0-f7fe-4c39-929e-052383b614dc",
  "8e6db2c1-0c20-4044-9993-32d36978f9b0",
  "d82ca21b-b668-40fc-a1bb-27562ab5863a",
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
