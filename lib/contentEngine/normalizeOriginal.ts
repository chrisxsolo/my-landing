// In-place downscaling of oversized originals at finalize time. A 61MP camera
// file becomes a ~16MP same-format image (long edge NORMALIZE_MAX_DIMENSION,
// quality NORMALIZE_QUALITY) — still 2x+ the largest published derivative
// (2400px), so nothing public loses quality. EXIF orientation is baked into the
// pixels via .rotate() because sharp strips metadata on re-encode; downstream
// .rotate() calls then no-op. Output is deterministic for identical input, so
// the per-session duplicate hash check keeps working on normalized bytes.
import sharp from "sharp";
import {
  MAX_IMAGE_PIXELS,
  NORMALIZE_TRIGGER_PIXELS,
  NORMALIZE_TRIGGER_BYTES,
  NORMALIZE_MAX_DIMENSION,
  NORMALIZE_QUALITY,
} from "@/lib/contentEngine/uploadConfig";

export interface NormalizeCheckMeta {
  width: number;
  height: number;
  bytes: number;
}

export function needsNormalization(meta: NormalizeCheckMeta): boolean {
  return (
    meta.width * meta.height > NORMALIZE_TRIGGER_PIXELS ||
    meta.bytes > NORMALIZE_TRIGGER_BYTES
  );
}

// format is the sharp-verified format name ('jpeg' | 'png' | 'webp'); the
// output keeps the same format so the issued storage path extension and the
// recorded mime_type stay truthful.
export async function normalizeOriginal(buffer: Buffer, format: string): Promise<Buffer> {
  const pipeline = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({
      width: NORMALIZE_MAX_DIMENSION,
      height: NORMALIZE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  switch (format) {
    case "jpeg":
      return pipeline.jpeg({ quality: NORMALIZE_QUALITY, mozjpeg: true }).toBuffer();
    case "png":
      return pipeline.png().toBuffer();
    case "webp":
      return pipeline.webp({ quality: NORMALIZE_QUALITY }).toBuffer();
    default:
      throw new Error(`unsupported format for normalization: ${format}`);
  }
}
