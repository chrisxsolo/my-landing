// One-off backfill (2026-07-17): sessions published before guide support gained
// their guide/school placements have stale snapshots that skipped those types.
// Creates a SCOPED regeneration package (selected types = only the missing
// school_page_photo + guide_photo, mirroring the Lover's Lane guide-only
// regenerate) and generates drafts via the exact server code path the admin API
// uses. Prints the drafts for review — approving/publishing is a separate phase
// (backfill-guide-publish.ts) so nothing goes live unreviewed.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-guide-placements.ts

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller, DEFAULT_ENGINE_MODEL } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { generateContentType } from "@/lib/contentEngine/generateContent";

const SESSIONS = [
  { id: "79597f62-8dca-492b-9405-6f43a561f369", label: "Tara (grads, sf-state, Legion of Honor)" },
];
const TYPES = ["school_page_photo", "guide_photo"];

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const client = createSupabaseAdminClient();
  const callModel = createAnthropicCaller(apiKey);

  for (const s of SESSIONS) {
    console.log(`\n=== ${s.label} ===`);
    const { data: session, error: sErr } = await client
      .from("photography_sessions").select("*").eq("id", s.id).maybeSingle();
    if (sErr || !session) throw new Error(`session lookup failed: ${sErr?.message}`);

    const snapshot = buildSessionFactsSnapshot(session);
    console.log("snapshot:", JSON.stringify({
      service_type: snapshot.service_type, school_slug: snapshot.school_slug,
      primary_location: snapshot.primary_location,
    }));

    const { data: packageId, error: pErr } = await client.rpc("create_content_package", {
      p_session_id: s.id,
      p_model_name: DEFAULT_ENGINE_MODEL,
      p_prompt_version: PROMPT_VERSION,
      p_selected_types: TYPES,
      p_session_facts: snapshot,
      p_generation_settings: {},
      p_archive_current: true,
      p_copy_items: [],
    });
    if (pErr) throw new Error(`create_content_package failed: ${pErr.message}`);
    console.log("new package:", packageId);

    for (const type of TYPES) {
      const result = await generateContentType({
        client, callModel, packageId: packageId as string, contentType: type,
      });
      console.log(`${type}: ${result.outcome}${result.error ? ` — ${result.error}` : ""} (${result.itemIds.length} items)`);
    }

    // Review dump: draft payloads joined with photo analysis + spot names.
    const { data: items } = await client
      .from("session_content_items")
      .select("id,content_type,status,payload")
      .eq("package_id", packageId as string)
      .order("content_type");
    for (const item of items ?? []) {
      const payload = item.payload as Record<string, unknown>;
      const { data: photo } = await client.from("session_photos")
        .select("original_filename,alt_text,quality_score,description")
        .eq("id", payload.session_photo_id as string).maybeSingle();
      let spotName: string | null = null;
      if (payload.guide === "grad" && typeof payload.location_key === "string") {
        const { data: spot } = await client.from("location_spots")
          .select("name,school_short,image_url").eq("id", Number(payload.location_key)).maybeSingle();
        spotName = spot ? `${spot.school_short} — ${spot.name} (currently ${spot.image_url ? "HAS a photo" : "empty"})` : "UNKNOWN SPOT";
      }
      console.log(`\n[${item.content_type}] item ${item.id} (${item.status})`);
      console.log("  payload:", JSON.stringify(payload));
      if (spotName) console.log("  spot:", spotName);
      if (photo) {
        console.log(`  photo: ${photo.original_filename} q${photo.quality_score}`);
        console.log(`  photo alt: ${photo.alt_text}`);
        console.log(`  photo desc: ${(photo.description ?? "").slice(0, 220)}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
