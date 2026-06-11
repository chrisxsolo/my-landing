// Downloads private originals and encodes them for a vision request
// (spec §8.1 step 2): EXIF-orient, downscale, JPEG-encode, and walk the
// quality/dimension ladder until the combined payload fits the batch cap.
import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANALYSIS_ENCODE_LADDER, MAX_BATCH_IMAGE_BYTES, ladderStep, totalBytes,
} from "@/lib/contentEngine/analysisBatching";
import { ORIGINALS_BUCKET, MAX_IMAGE_PIXELS } from "@/lib/contentEngine/uploadConfig";

export async function downloadOriginal(client: SupabaseClient, storagePath: string): Promise<Buffer> {
  const { data, error } = await client.storage.from(ORIGINALS_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`could not download original ${storagePath}: ${error?.message ?? "missing"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function encodeImageForModel(buffer: Buffer, step: number): Promise<Buffer> {
  const { maxDimension, quality } = ladderStep(step);
  return sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate() // apply EXIF orientation
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

// Encode all images at ladder step 0; if the combined bytes exceed the cap,
// re-encode everything at the next step ("reduces quality/dimensions
// dynamically", spec §8.1 step 2). The last step is used even if still over.
export async function encodeBatchUnderCap(buffers: Buffer[]): Promise<Buffer[]> {
  for (let step = 0; step < ANALYSIS_ENCODE_LADDER.length; step++) {
    const encoded = await Promise.all(buffers.map((b) => encodeImageForModel(b, step)));
    if (totalBytes(encoded) <= MAX_BATCH_IMAGE_BYTES || step === ANALYSIS_ENCODE_LADDER.length - 1) {
      return encoded;
    }
  }
  throw new Error("unreachable: ladder always returns at the last step");
}

export function toImageBlock(encoded: Buffer): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: encoded.toString("base64") },
  };
}
