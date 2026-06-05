// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/blog-seo
//
// Body: { postId: number }
//
// Reads the blog post, sends its title + body + cover/extra images to Claude
// Vision, and writes back unique SEO metadata:
//   - meta_description, meta_keywords
//   - cover_image_alt, extra_image_alts (aligned to extra_image_urls)
// Returns the generated values.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchImageBlock } from "@/lib/visionImage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cap how many extra images we send to Vision to keep token use and latency sane.
const MAX_EXTRA_IMAGES = 8;
const META_DESCRIPTION_MAX = 155;

type RequestBody = { postId?: unknown };
type BlogRow = {
  title: string;
  body: string;
  cover_image_url: string | null;
  extra_image_urls: string[] | null;
};
type SeoResult = {
  meta_description: string;
  meta_keywords: string;
  cover_image_alt: string;
  extra_image_alts: string[];
};

function readPostId(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("postId must be a positive integer.");
  }
  return parsed;
}

function trimTo(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return v.length <= max ? v : v.slice(0, max).trim();
}

const SYSTEM_PROMPT = `You write SEO metadata for soloxsnaps, a Bay Area graduation and portrait photographer (soloxsnaps.com).
You receive a blog post (title + body) and its photos. The first image is the cover; any following images are extras, in order.
Write metadata that is unique and grounded in what is actually visible in the photos and described in the post — never keyword-stuffed.

Return ONLY a JSON object with these keys:
{
  "meta_description": "compelling 1-2 sentence search snippet, under 155 characters",
  "meta_keywords": "6-12 comma-separated keywords/phrases (schools, locations, session type, Bay Area grad photography terms)",
  "cover_image_alt": "descriptive alt text for the cover photo, under 125 characters",
  "extra_image_alts": ["alt text for each extra photo, in the same order, under 125 chars each"]
}
extra_image_alts must have exactly one entry per extra photo provided (an empty array if none). Output only the JSON object.`;

async function generateSeo(row: BlogRow, extraCount: number): Promise<SeoResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured.");

  const urls = [row.cover_image_url, ...(row.extra_image_urls ?? []).slice(0, extraCount)];
  const imageBlocks = (await Promise.all(urls.map(fetchImageBlock))).filter(
    (b): b is Anthropic.ImageBlockParam => b !== null,
  );

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Blog post to optimize. There ${extraCount === 1 ? "is" : "are"} ${extraCount} extra photo(s) after the cover.\n\nTitle: ${row.title}\n\nBody:\n${row.body}`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  const altsRaw = Array.isArray(parsed.extra_image_alts) ? parsed.extra_image_alts : [];
  return {
    meta_description: trimTo(parsed.meta_description, META_DESCRIPTION_MAX),
    meta_keywords: trimTo(parsed.meta_keywords, 300),
    cover_image_alt: trimTo(parsed.cover_image_alt, 125),
    extra_image_alts: altsRaw.slice(0, extraCount).map((a) => trimTo(a, 125)),
  };
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = (await req.json()) as RequestBody;
    const postId = readPostId(body.postId);

    const supabase = createSupabaseServerClient();
    const { data: row, error: fetchError } = await supabase
      .from("blog_posts")
      .select("title, body, cover_image_url, extra_image_urls")
      .eq("id", postId)
      .single();
    if (fetchError || !row) throw new Error("Post not found.");

    const extraCount = Math.min((row.extra_image_urls ?? []).length, MAX_EXTRA_IMAGES);
    const seo = await generateSeo(row as BlogRow, extraCount);
    if (!seo) throw new Error("AI returned no usable metadata.");

    const update: Record<string, unknown> = {
      meta_description: seo.meta_description || null,
      meta_keywords: seo.meta_keywords || null,
      cover_image_alt: seo.cover_image_alt || null,
    };
    if (seo.extra_image_alts.length > 0) update.extra_image_alts = seo.extra_image_alts;

    const { error: updateError } = await supabase.from("blog_posts").update(update).eq("id", postId);
    if (updateError) throw updateError;

    return NextResponse.json({ seo });
  } catch (err) {
    console.error("[admin/blog-seo] POST", err);
    const message = err instanceof Error ? err.message : "Failed to generate blog SEO.";
    const status = message.endsWith("must be a positive integer.") ? 400 : message === "Post not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
