// ─────────────────────────────────────────────────────────────────────────────
// One-off: AI-vision backfill of portfolio_images.alt (+ title)
// ─────────────────────────────────────────────────────────────────────────────
// Almost every portfolio image stores a camera filename ("DSC01766") as its alt,
// which getPhotoAlt() rejects and replaces with one generic per-category string —
// so every photo in a category renders the SAME alt. This script looks at each
// photo and writes a unique, descriptive alt to the DB for Chris to review.
//
// Mirrors the single-image pattern in
//   app/api/admin/portfolio-image-description/route.ts
// (claude-opus-4-7 vision → JSON {title, alt}), batched across the whole table.
//
// USAGE (env from .env.local is auto-loaded; or run with node --env-file=.env.local):
//   node scripts/backfill-portfolio-alt.mjs --dry-run --limit 5   # preview → CSV, no writes
//   node scripts/backfill-portfolio-alt.mjs --only grads --limit 20
//   node scripts/backfill-portfolio-alt.mjs                        # full run, filename-alts only
//   node scripts/backfill-portfolio-alt.mjs --all                  # also re-do good alts
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const TABLE = "portfolio_images";
const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 200;
const CONCURRENCY = 3;
const TITLE_MAX = 72;
const ALT_MAX = 125;

// portfolio_categories slugs are inconsistent in the DB; normalize like the app.
const SLUG_ALIASES = { family: "families", graduation: "grads", portraits: "families" };
const CATEGORY_NOUN = {
  grads: "graduation portrait",
  families: "family portrait",
  couples: "couples portrait",
};

// ── tiny .env.local loader (only fills vars not already set) ──────────────────
function loadDotEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parseArgs(argv) {
  const args = { dryRun: false, all: false, limit: null, only: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=")[1]);
    else if (arg === "--only") args.only = argv[++i];
    else if (arg.startsWith("--only=")) args.only = arg.split("=")[1];
  }
  return args;
}

function normalizeSlug(slug) {
  if (!slug) return "portfolio";
  return SLUG_ALIASES[slug] ?? slug;
}

// Mirrors isFilenameLikeText in lib/photoMetadata.ts.
function isFilenameLike(value) {
  const text = value?.trim();
  if (!text) return true;
  return /\.(jpe?g|png|webp|heic|avif)$/i.test(text) || /^DSC\d+/i.test(text) || /^IMG[_-]?\d+/i.test(text);
}

function trimTo(value, max) {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 20 ? lastSpace : max).trim();
}

function parseAiJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

// Fetch and downscale to a vision-friendly JPEG. Portfolio originals can be
// 25–32 MB, which blows past Anthropic's 10 MB image cap, so we EXIF-rotate and
// resize to fit within MAX_EDGE before encoding (also cuts token cost). Mirrors
// the ladder approach in lib/contentEngine/modelImages.ts.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;

async function fetchImageBlock(url) {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const encoded = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: encoded.toString("base64") },
  };
}

async function describeImage(anthropic, image) {
  const block = await fetchImageBlock(image.image_url);
  if (!block) return null;

  const noun = CATEGORY_NOUN[normalizeSlug(image.category_slug)] ?? "portrait";
  const system =
    `Write concise, unique SEO image metadata for soloxsnaps, a Bay Area photographer. ` +
    `This image is from a ${noun} session. Return only JSON with "title" and "alt". ` +
    `Title under 70 characters, alt under 125 characters. Describe what is actually visible ` +
    `(who is in frame, pose, setting, light, attire) so the alt is unique to this photo. ` +
    `Be descriptive and natural, never keyword-stuffed. Mention it is a Bay Area ${noun}.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [
      { role: "user", content: [block, { type: "text", text: "Look at this photo and write the JSON metadata." }] },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const parsed = parseAiJson(text);
  if (!parsed.alt) return null;
  return {
    title: parsed.title ? trimTo(String(parsed.title), TITLE_MAX) : null,
    alt: trimTo(String(parsed.alt), ALT_MAX),
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

// Simple fixed-size worker pool over `items`.
async function runPool(items, worker) {
  let cursor = 0;
  const next = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, next));
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  let query = supabase.from(TABLE).select("id,category_slug,alt,image_url").order("id");
  if (args.only) query = query.eq("category_slug", args.only);
  const { data: rows, error } = await query;
  if (error) throw error;

  let targets = (rows ?? []).filter((row) => row.image_url);
  if (!args.all) targets = targets.filter((row) => isFilenameLike(row.alt));
  if (args.limit) targets = targets.slice(0, args.limit);

  console.log(
    `[alt] ${targets.length} image(s) to process` +
      `${args.only ? ` (only=${args.only})` : ""}${args.all ? " (--all)" : " (filename-like alts only)"}` +
      `${args.dryRun ? " — DRY RUN" : ""}`,
  );
  if (targets.length === 0) return;

  const report = [["id", "category_slug", "old_alt", "new_title", "new_alt", "status"]];
  let done = 0;
  let updated = 0;
  let skipped = 0;

  await runPool(targets, async (row) => {
    try {
      const result = await describeImage(anthropic, row);
      if (!result) {
        skipped += 1;
        report.push([row.id, row.category_slug, row.alt, "", "", "skipped-no-result"]);
        return;
      }
      if (!args.dryRun) {
        const { error: updateError } = await supabase
          .from(TABLE)
          .update({ title: result.title ?? undefined, alt: result.alt })
          .eq("id", row.id);
        if (updateError) throw updateError;
        updated += 1;
      }
      report.push([row.id, row.category_slug, row.alt, result.title ?? "", result.alt, args.dryRun ? "preview" : "updated"]);
    } catch (err) {
      skipped += 1;
      report.push([row.id, row.category_slug, row.alt, "", "", `error:${err?.message ?? err}`]);
      console.error(`[alt] id=${row.id} failed:`, err?.message ?? err);
    } finally {
      done += 1;
      if (done % 10 === 0) console.log(`[alt] ${done}/${targets.length}…`);
    }
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.resolve(process.cwd(), "scripts", `portfolio-alt-report-${stamp}.csv`);
  fs.writeFileSync(reportPath, report.map((cells) => cells.map(csvCell).join(",")).join("\n"));

  console.log(`[alt] done — ${updated} updated, ${skipped} skipped, ${targets.length} total`);
  console.log(`[alt] report → ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
