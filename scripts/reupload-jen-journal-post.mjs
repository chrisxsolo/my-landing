import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const SOURCE_DIR =
  "/Users/chrissolo/Library/CloudStorage/Dropbox/Final Images/Jenn SJSU";
const BUCKET = "grad-photos";
const BLOG_POSTS_TABLE = "blog_posts";
const IMAGE_LIBRARY_TABLE = "image_library";
const SCORE_MAX_PX = 900;
const SCORE_QUALITY = 70;
const UPLOAD_MAX_PX = 2400;
const UPLOAD_QUALITY = 85;
const SCORE_BATCH_SIZE = 30;
const KEEP_COUNT = 10;
const SOURCE_TYPE = "journal";
const COVER_ROLE = "cover";
const GALLERY_ROLE = "gallery";
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function listSourceImages(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(dir, name));
}

function compressImage(srcPath, maxPx, quality) {
  const tmpPath = path.join(
    os.tmpdir(),
    `jen-journal-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
  );

  execFileSync("sips", [
    "--resampleHeightWidthMax",
    String(maxPx),
    "--setProperty",
    "formatOptions",
    String(quality),
    srcPath,
    "--out",
    tmpPath,
    "--setProperty",
    "format",
    "jpeg",
  ]);

  const buffer = fs.readFileSync(tmpPath);
  fs.unlinkSync(tmpPath);
  return buffer;
}

function buildImageBlocks(assets, indices) {
  return indices.map((index) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: assets[index].scoreBase64,
    },
  }));
}

function parseIndexArray(rawText, batchLength, pickCount) {
  const match = rawText.match(/\[[\d,\s]+\]/);
  if (!match) return [];

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((value) => Number.isInteger(value) && value >= 0 && value < batchLength)
    .slice(0, pickCount);
}

async function pickBestIndices(client, assets, absoluteIndices, pickCount) {
  const content = buildImageBlocks(assets, absoluteIndices);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: `You are a photography editor selecting the strongest images for a journal post.
Choose images based on:
- technical quality
- composition
- emotional expression
- variety across poses/backgrounds
- storytelling value

Return ONLY a JSON array of 0-based indices for this batch.
Choose at most ${pickCount} images.
The first index must be the strongest image in the batch because it may become the cover.
Avoid near-duplicates.`,
    messages: [
      {
        role: "user",
        content: [
          ...content,
          {
            type: "text",
            text: `These are Jenn's SJSU graduation photos. Pick the best ${pickCount} images from this batch of ${absoluteIndices.length}. Return only the JSON array.`,
          },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const relative = parseIndexArray(rawText, absoluteIndices.length, pickCount);
  if (relative.length === 0) {
    return absoluteIndices.slice(0, pickCount);
  }

  return relative.map((index) => absoluteIndices[index]);
}

async function selectTopTen(client, assets) {
  const allIndices = assets.map((_, index) => index);
  const firstBatch = allIndices.slice(0, SCORE_BATCH_SIZE);
  let finalists = await pickBestIndices(client, assets, firstBatch, Math.min(KEEP_COUNT, firstBatch.length));

  for (let cursor = SCORE_BATCH_SIZE; cursor < allIndices.length; ) {
    const room = Math.max(SCORE_BATCH_SIZE - finalists.length, 1);
    const challengers = allIndices.slice(cursor, cursor + room);
    cursor += challengers.length;
    finalists = await pickBestIndices(
      client,
      assets,
      finalists.concat(challengers),
      Math.min(KEEP_COUNT, finalists.length + challengers.length),
    );
  }

  return finalists;
}

async function generateCopy(client, assets, selectedIndices) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    system: `You are the voice of Chris Solorzano, a Bay Area graduation photographer writing a journal post for soloxsnaps.com.
Write a warm, personal, specific journal entry about Jenn's SJSU graduation session.

Tone:
- calm
- genuine
- observant
- conversational but polished

Constraints:
- 3 to 5 short paragraphs
- no generic filler
- mention SJSU naturally
- infer concrete visual details from the images

Return valid JSON with exactly these keys:
{
  "title": "string",
  "body": "string",
  "meta_description": "string"
}

Output ONLY the JSON object.`,
    messages: [
      {
        role: "user",
        content: [
          ...buildImageBlocks(assets, selectedIndices),
          {
            type: "text",
            text: "Write the journal post from these selected images. Return only the JSON object.",
          },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Claude did not return a JSON object for blog copy.");
  }

  const parsed = JSON.parse(match[0]);
  if (!parsed.title || !parsed.body || !parsed.meta_description) {
    throw new Error("Claude returned incomplete blog copy.");
  }

  return parsed;
}

async function ensureUniqueSlug(supabase, baseSlug) {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from(BLOG_POSTS_TABLE)
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function uploadSelectedImages(supabase, assets, selectedIndices, slug) {
  const timestamp = Date.now();
  const uploadedUrls = [];

  for (let index = 0; index < selectedIndices.length; index += 1) {
    const asset = assets[selectedIndices[index]];
    const buffer = compressImage(asset.srcPath, UPLOAD_MAX_PX, UPLOAD_QUALITY);
    const storagePath = `blog/${slug}-${timestamp}-${String(index + 1).padStart(2, "0")}.jpg`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload ${path.basename(asset.srcPath)}: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

function buildImageLibraryRows(postId, slug, title, uploadedUrls) {
  return uploadedUrls.map((imageUrl, index) => ({
    title: index === 0 ? `${title} cover` : title,
    alt: index === 0 ? `${title} cover` : title,
    image_url: imageUrl,
    source_type: SOURCE_TYPE,
    source_post_id: postId,
    source_post_slug: slug,
    source_role: index === 0 ? COVER_ROLE : GALLERY_ROLE,
    in_portfolio: false,
  }));
}

async function main() {
  const sourceImages = listSourceImages(SOURCE_DIR);
  if (sourceImages.length === 0) {
    throw new Error(`No supported images found in ${SOURCE_DIR}`);
  }

  const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  console.log(`Found ${sourceImages.length} source images in ${SOURCE_DIR}`);
  console.log("Preparing compressed previews for Claude...");

  const assets = sourceImages.map((srcPath) => ({
    srcPath,
    scoreBase64: compressImage(srcPath, SCORE_MAX_PX, SCORE_QUALITY).toString("base64"),
  }));

  console.log("Selecting the top 10 across the full folder...");
  const selectedIndices = await selectTopTen(anthropic, assets);

  console.log("Generating journal copy...");
  const copy = await generateCopy(anthropic, assets, selectedIndices);
  const slug = await ensureUniqueSlug(supabase, slugify(copy.title));

  console.log("Uploading selected images to Supabase Storage...");
  const uploadedUrls = await uploadSelectedImages(supabase, assets, selectedIndices, slug);
  if (uploadedUrls.length === 0) {
    throw new Error("No images were uploaded.");
  }

  const payload = {
    title: copy.title,
    body: copy.body,
    slug,
    category: SOURCE_TYPE,
    sites: [SOURCE_TYPE],
    cover_image_url: uploadedUrls[0],
    extra_image_urls: uploadedUrls.slice(1),
    meta_description: copy.meta_description,
    published_at: new Date().toISOString(),
  };

  console.log("Creating the journal post...");
  const { data: inserted, error: insertError } = await supabase
    .from(BLOG_POSTS_TABLE)
    .insert(payload)
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to insert blog post: ${insertError?.message ?? "unknown error"}`);
  }

  const libraryRows = buildImageLibraryRows(inserted.id, slug, copy.title, uploadedUrls);
  const { error: libraryError } = await supabase
    .from(IMAGE_LIBRARY_TABLE)
    .upsert(libraryRows, {
      onConflict: "source_post_id,source_role,image_url",
      ignoreDuplicates: true,
    });

  if (libraryError) {
    throw new Error(`Failed to sync image library rows: ${libraryError.message}`);
  }

  console.log("");
  console.log("Journal post created successfully.");
  console.log(`Title: ${copy.title}`);
  console.log(`Slug: ${slug}`);
  console.log(`URL: https://soloxsnaps.com/journal/${slug}`);
  console.log("Selected files:");
  selectedIndices.forEach((assetIndex, order) => {
    console.log(`  ${String(order + 1).padStart(2, "0")}. ${path.basename(assets[assetIndex].srcPath)}`);
  });
}

main().catch((error) => {
  console.error("");
  console.error("Upload failed:");
  console.error(error);
  process.exit(1);
});
