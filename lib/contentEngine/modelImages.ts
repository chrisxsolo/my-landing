// Downloads private originals and encodes them for a vision request
// (spec §8.1 step 2): EXIF-orient and downscale to the size the model actually
// reads (see modelImageSize.ts), then JPEG-encode.
import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_IMAGE_QUALITY, modelImageLongEdge } from "@/lib/contentEngine/modelImageSize";
import { ORIGINALS_BUCKET, MAX_IMAGE_PIXELS } from "@/lib/contentEngine/uploadConfig";

export async function downloadOriginal(client: SupabaseClient, storagePath: string): Promise<Buffer> {
  const { data, error } = await client.storage.from(ORIGINALS_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`could not download original ${storagePath}: ${error?.message ?? "missing"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function encodeImageForModel(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS });
  const { width = 0, height = 0 } = await image.metadata();
  const edge = modelImageLongEdge(width, height);
  return image
    .rotate() // apply EXIF orientation
    .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: MODEL_IMAGE_QUALITY })
    .toBuffer();
}

export function toImageBlock(encoded: Buffer): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: encoded.toString("base64") },
  };
}
