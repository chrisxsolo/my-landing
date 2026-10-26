// Fills portfolio_images.width/height for rows that have none, so galleries can
// keep every photo's real aspect ratio. Reads a small Supabase-transformed copy
// of each image (not the 25MB+ original); only the ratio is used by galleries.
//
// USAGE: node scripts/backfill-portfolio-dimensions.mjs [--dry-run]
// Requires env (auto-loaded from .env.local): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const PROBE_WIDTH = 1000;
const DRY_RUN = process.argv.includes("--dry-run");

function loadEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function probeUrl(publicUrl) {
  // .../storage/v1/object/public/<bucket>/<path> → .../storage/v1/render/image/public/...
  if (!publicUrl.includes("/storage/v1/object/public/")) return publicUrl;
  const url = publicUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return `${url}?width=${PROBE_WIDTH}&resize=contain&quality=40`;
}

async function measure(publicUrl) {
  const res = await fetch(probeUrl(publicUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  if (!meta.width || !meta.height) throw new Error("no dimensions");
  // EXIF orientations 5–8 rotate the image a quarter turn.
  const rotated = (meta.orientation ?? 1) >= 5;
  return rotated ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
}

async function main() {
  loadEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from("portfolio_images").select("id,image_url").is("width", null);
  if (error) throw error;
  console.log(`${data.length} photos without dimensions${DRY_RUN ? " (dry run)" : ""}`);

  let done = 0;
  for (const row of data) {
    try {
      const dims = await measure(row.image_url);
      if (!DRY_RUN) {
        const { error: updateError } = await supabase.from("portfolio_images").update(dims).eq("id", row.id);
        if (updateError) throw updateError;
      }
      done += 1;
      console.log(`#${row.id} ${dims.width}x${dims.height}`);
    } catch (err) {
      console.error(`#${row.id} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Measured ${done}/${data.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
