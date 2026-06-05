import type Anthropic from "@anthropic-ai/sdk";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

// Fetch a public image URL and return it as a base64 Claude vision block, or null if it can't be used.
export async function fetchImageBlock(url: string | null | undefined): Promise<Anthropic.ImageBlockParam | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const headerType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const media_type = (SUPPORTED_MEDIA_TYPES.includes(headerType as SupportedMediaType)
      ? headerType
      : "image/jpeg") as SupportedMediaType;
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      type: "image",
      source: { type: "base64", media_type, data: buffer.toString("base64") },
    };
  } catch (err) {
    console.error("[visionImage] image fetch failed", err);
    return null;
  }
}
