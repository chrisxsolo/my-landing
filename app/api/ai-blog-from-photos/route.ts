// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-blog-from-photos
//
// Accepts multipart form data:
//   - images: File[] (10–30 photos)
//   - sites: comma-separated string e.g. "journal,professional"
//
// Flow:
//   1. Encode all images as base64
//   2. Ask Claude Vision to score each image (1–10) and pick the best 10
//   3. Ask Claude to write a blog post (title, slug, body, meta_description)
//      based on the selected images
//   4. Upload selected images to Supabase Storage (blog/ folder)
//   5. Insert the blog_posts row + sync to image_library
//   6. Return { id, slug, title }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildJournalImageLibraryRows } from "@/lib/imageLibraryShared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function mediaType(file: File): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const t = file.type.toLowerCase();
  if (t === "image/png") return "image/png";
  if (t === "image/webp") return "image/webp";
  if (t === "image/gif") return "image/gif";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("images") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }

  const sitesRaw = (formData.get("sites") as string | null) ?? "journal";
  const sites = sitesRaw.split(",").map(s => s.trim()).filter(Boolean);
  if (sites.length === 0) sites.push("journal");
  const category = (sites.includes("professional") ? "professional" : "journal") as "professional" | "journal";

  const client = new Anthropic({ apiKey });

  // ── Step 1: Score all images ──────────────────────────────────────────────
  // Send all images to Claude with a request to rank them
  const MAX_SCORE_IMAGES = 30;
  const imagesToScore = files.slice(0, MAX_SCORE_IMAGES);

  const base64Images = await Promise.all(imagesToScore.map(fileToBase64));

  const scoreContent: Anthropic.ImageBlockParam[] = base64Images.map((b64, i) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType(imagesToScore[i]),
      data: b64,
    },
  }));

  let selectedIndices: number[] = [];

  try {
    const scoreRes = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: `You are a photography editor selecting the best images for a blog post.
You will receive a set of photos and must choose the best ones based on:
- Technical quality (sharpness, exposure, focus)
- Composition and visual interest
- Emotional impact and expression
- Variety (don't pick duplicates or near-identical shots)
- Storytelling value

Output ONLY a JSON array of 0-based indices of the best photos to include, selecting at most 10.
The first index in your array will be used as the cover photo — choose the single strongest image first.
Example: [2, 0, 5, 1, 8, 3]
Output nothing else — just the JSON array.`,
      messages: [
        {
          role: "user",
          content: [
            ...scoreContent,
            {
              type: "text" as const,
              text: `I have ${imagesToScore.length} photos from a photography session. Select the best ones (up to 10) for a blog post. Return a JSON array of 0-based indices, best image first (it becomes the cover). Only the JSON array, nothing else.`,
            },
          ],
        },
      ],
    });

    const raw = scoreRes.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    const parsed = JSON.parse(raw.match(/\[[\d,\s]+\]/)?.[0] ?? raw);
    if (Array.isArray(parsed)) {
      selectedIndices = (parsed as number[])
        .filter(i => typeof i === "number" && i >= 0 && i < imagesToScore.length)
        .slice(0, 10);
    }
  } catch (err) {
    console.error("[ai-blog] scoring error:", err);
    // Fallback: just use the first 10
    selectedIndices = Array.from({ length: Math.min(10, imagesToScore.length) }, (_, i) => i);
  }

  if (selectedIndices.length === 0) {
    selectedIndices = Array.from({ length: Math.min(10, imagesToScore.length) }, (_, i) => i);
  }

  const selectedFiles = selectedIndices.map(i => imagesToScore[i]);
  const selectedBase64 = selectedIndices.map(i => base64Images[i]);

  // ── Step 2: Generate blog post copy ──────────────────────────────────────
  const writeContent: Anthropic.ImageBlockParam[] = selectedBase64.map((b64, i) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType(selectedFiles[i]),
      data: b64,
    },
  }));

  type BlogCopy = { title: string; body: string; meta_description: string };
  let copy: BlogCopy = { title: "", body: "", meta_description: "" };

  try {
    const writeRes = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: `You are the voice of Chris Solorzano, a Bay Area portrait and graduation photographer running soloxsnaps.com.
Write a warm, personal, story-driven blog post (journal entry style) based on the photos provided.

Tone: genuine, calm, personal — like notes from the session written the evening after.
Style: conversational but polished. Concrete details. No generic filler phrases like "magical moments" or "forever memories."
Length: 3–5 short paragraphs. Each paragraph separated by a blank line.

Output valid JSON with exactly these keys:
{
  "title": "session title, e.g. 'Golden Hour at SJSU — Mia's Grad Shoot'",
  "body": "the full blog post body, paragraphs separated by \\n\\n",
  "meta_description": "1–2 sentence SEO description under 160 chars"
}

Infer location, mood, season, and subject from the photos. Be specific about what you see.
Output ONLY the JSON object — no markdown, no preamble.`,
      messages: [
        {
          role: "user",
          content: [
            ...writeContent,
            {
              type: "text" as const,
              text: "Write a blog post for these session photos. Return only the JSON object.",
            },
          ],
        },
      ],
    });

    const raw = writeRes.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      copy = JSON.parse(jsonMatch[0]) as BlogCopy;
    }
  } catch (err) {
    console.error("[ai-blog] write error:", err);
    return NextResponse.json({ error: "Failed to generate blog copy" }, { status: 500 });
  }

  if (!copy.title || !copy.body) {
    return NextResponse.json({ error: "Claude returned incomplete blog copy" }, { status: 500 });
  }

  // ── Step 3: Upload selected images to Supabase Storage ───────────────────
  const supabase = createSupabaseServerClient();
  const ts = Date.now();

  async function uploadToStorage(file: File, index: number): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `blog/${ts}_${index}.${ext}`;
    const buf = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from("grad-photos")
      .upload(path, buf, { upsert: true, contentType: file.type || "image/jpeg" });
    if (error) {
      console.error("[ai-blog] upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("grad-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  // Upload AI-selected images first (they become the post cover + gallery),
  // then upload the remaining user-selected images so they all land in the library.
  const remainingFiles = files.filter((_, i) => !selectedIndices.includes(i));

  const [selectedUploadResults, remainingUploadResults] = await Promise.all([
    Promise.all(selectedFiles.map((file, i) => uploadToStorage(file, i))),
    Promise.all(remainingFiles.map((file, i) => uploadToStorage(file, selectedFiles.length + i))),
  ]);

  const successUrls = selectedUploadResults.filter((u): u is string => u !== null);
  if (successUrls.length === 0) {
    return NextResponse.json({ error: "All image uploads failed" }, { status: 500 });
  }

  const cover_image_url = successUrls[0];
  const extra_image_urls = successUrls.slice(1);
  const allUploadedUrls = [
    ...successUrls,
    ...remainingUploadResults.filter((u): u is string => u !== null),
  ];

  // ── Step 4: Insert blog post ──────────────────────────────────────────────
  const slug = slugify(copy.title);
  const payload = {
    title: copy.title,
    body: copy.body,
    slug,
    category,
    sites,
    cover_image_url,
    extra_image_urls,
    meta_description: copy.meta_description,
    published_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("blog_posts")
    .insert(payload)
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "Database insert failed: " + (insertError?.message ?? "unknown") },
      { status: 500 }
    );
  }

  // ── Step 5: Sync ALL uploaded photos to image library ────────────────────
  // cover + AI-gallery go in as cover/gallery roles; remaining user-selected
  // photos go in as gallery too so they're all available in the library.
  try {
    const rows = buildJournalImageLibraryRows({
      postId: inserted.id,
      postSlug: slug,
      postTitle: copy.title,
      coverImageUrl: cover_image_url,
      extraImageUrls: allUploadedUrls.slice(1), // everything except the cover
    });
    if (rows.length) {
      await supabase
        .from("image_library")
        .upsert(rows, { onConflict: "source_post_id,source_role,image_url", ignoreDuplicates: true });
    }
  } catch (err) {
    console.error("[ai-blog] image_library sync error:", err);
  }

  return NextResponse.json({
    id: inserted.id,
    slug,
    title: copy.title,
    cover_image_url,
    photo_count: allUploadedUrls.length,
  });
}
