// Retry a failed generation type on an existing package (claim allows
// pending|failed), then dump the drafts for review. One-off companion to
// backfill-guide-placements.ts.
// Run: npx tsx --env-file=.env.local scripts/backfill-guide-retry.ts

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { generateContentType } from "@/lib/contentEngine/generateContent";

const PACKAGE_ID = "3bc5d077-d78a-4fdf-aafc-5917dc42913c"; // Tara
const TYPE = "school_page_photo";

async function main() {
  const client = createSupabaseAdminClient();
  const callModel = createAnthropicCaller(process.env.ANTHROPIC_API_KEY!);

  const result = await generateContentType({ client, callModel, packageId: PACKAGE_ID, contentType: TYPE });
  console.log(`${TYPE}: ${result.outcome}${result.error ? ` — ${result.error}` : ""} (${result.itemIds.length} items)`);

  const { data: items } = await client.from("session_content_items")
    .select("id,content_type,status,payload").eq("package_id", PACKAGE_ID);
  for (const item of items ?? []) {
    const payload = item.payload as Record<string, unknown>;
    const { data: photo } = await client.from("session_photos")
      .select("original_filename,alt_text,quality_score")
      .eq("id", payload.session_photo_id as string).maybeSingle();
    console.log(`\n[${item.content_type}] ${item.id} (${item.status})`);
    console.log("  payload:", JSON.stringify(payload));
    if (photo) console.log(`  photo: ${photo.original_filename} q${photo.quality_score} — ${photo.alt_text}`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
