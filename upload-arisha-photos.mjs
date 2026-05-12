/**
 * upload-arisha-photos.mjs
 *
 * Uploads 10 curated photos from Arisha's SFSU graduation session
 * to Supabase storage. Blog post ID 4 is already in the database
 * pointing to these exact paths — once uploaded, it's fully live.
 *
 * Run from the project root:
 *   node upload-arisha-photos.mjs
 *
 * Requires Node 18+.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://dmtslzwglpezympptqls.supabase.co";
// Storage RLS allows uploads from any authenticated user — anon JWT works fine here.
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdHNsendnbHBlenltcHB0cWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjI1NjYsImV4cCI6MjA5MDk5ODU2Nn0.LiltVp3XJj8cVZJ9xTzWKT6NF6WFJtnRgihUCd5wAog";
const BUCKET = "grad-photos";

const SOURCE_DIR =
  "/Users/chrissolo/Library/CloudStorage/Dropbox/Final Images/Arisha Khan";

// 10 curated images: source filename → storage destination
const IMAGES = [
  { src: "DSC09375.jpg", dest: "blog/arisha-sfsu-cover.jpg", label: "Cover — champagne pop at Palace of Fine Arts" },
  { src: "DSC08901.jpg", dest: "blog/arisha-sfsu-1.jpg",     label: "SFSU sign — white dress, elegant standing" },
  { src: "DSC08933.jpg", dest: "blog/arisha-sfsu-2.jpg",     label: "SFSU sign — pointing up, celebratory" },
  { src: "DSC08970.jpg", dest: "blog/arisha-sfsu-3.jpg",     label: "SFSU sign — playful one-leg kick" },
  { src: "DSC09021.jpg", dest: "blog/arisha-sfsu-4.jpg",     label: "SFSU sign — full cap & gown, proud" },
  { src: "DSC09052.jpg", dest: "blog/arisha-sfsu-5.jpg",     label: "SFSU sign — holding cap high" },
  { src: "DSC09117.jpg", dest: "blog/arisha-sfsu-6.jpg",     label: "Campus garden — relaxed on rocks" },
  { src: "DSC09202.jpg", dest: "blog/arisha-sfsu-7.jpg",     label: "Campus garden — full gown walking" },
  { src: "DSC09267.jpg", dest: "blog/arisha-sfsu-8.jpg",     label: "Palace of Fine Arts — lake reflection" },
  { src: "DSC09555.jpg", dest: "blog/arisha-sfsu-9.jpg",     label: "Palace of Fine Arts — under the grand arch" },
];

// ─── Upload ───────────────────────────────────────────────────────────────────

function compressImage(srcPath) {
  const tmp = path.join(os.tmpdir(), `upload-${path.basename(srcPath)}`);
  // Resize to max 2400px on longest edge, 85% JPEG quality
  execSync(
    `sips --resampleHeightWidthMax 2400 --setProperty formatOptions 85 "${srcPath}" --out "${tmp}" --setProperty format jpeg`,
    { stdio: "pipe" }
  );
  return tmp;
}

async function uploadImage(supabase, { src, dest, label }) {
  const filePath = path.join(SOURCE_DIR, src);

  if (!fs.existsSync(filePath)) {
    console.log(`  ✗ File not found: ${src}`);
    return false;
  }

  const compressed = compressImage(filePath);
  const fileBuffer = fs.readFileSync(compressed);
  fs.unlinkSync(compressed);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(dest, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.log(`  ✗ ${label}\n    ${error.message}`);
    return false;
  }

  console.log(`  ✓ ${label}`);
  return true;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  console.log("\n📸  Uploading Arisha SFSU graduation photos to Supabase storage\n");
  console.log(`   Source:  ${SOURCE_DIR}`);
  console.log(`   Bucket:  ${BUCKET}/blog/\n`);

  let passed = 0;
  let failed = 0;

  for (const image of IMAGES) {
    process.stdout.write(`  Uploading ${image.dest}... \n`);
    const ok = await uploadImage(supabase, image);
    if (ok) passed++;
    else failed++;
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`  Done: ${passed} uploaded, ${failed} failed`);

  if (failed === 0) {
    console.log(`\n  🎉 Blog post is now live with all images:`);
    console.log(`     https://soloxsnaps.com/blog/sf-state-graduation-photos-arisha\n`);
  } else {
    console.log(`\n  ⚠️  Some uploads failed. Re-run the script to retry.\n`);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
