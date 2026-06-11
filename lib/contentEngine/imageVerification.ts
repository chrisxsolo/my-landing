// Authoritative server-side image verification (spec §4.2 step 4). Computes its
// OWN SHA-256 and validates the bytes with sharp; browser-declared metadata is
// never trusted. limitInputPixels protects against decompression bombs.
import sharp from "sharp";
import { createHash } from "node:crypto";
import {
  MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, ALLOWED_UPLOAD_MIME,
} from "@/lib/contentEngine/uploadConfig";

export class ImageVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageVerificationError";
  }
}

export interface VerifiedImage {
  hash: string;          // server-computed SHA-256 (feeds the unique constraint)
  format: string;        // 'jpeg' | 'png' | 'webp'
  width: number;
  height: number;
  bytes: number;
}

export interface VerifyOptions {
  maxBytes?: number;
  maxPixels?: number;
}

// sharp format names mapped from the allowed MIME list.
const ALLOWED_FORMATS = new Set(
  ALLOWED_UPLOAD_MIME.map((m) => (m === "image/jpeg" ? "jpeg" : m.replace("image/", ""))),
);

export async function verifyImageBuffer(buffer: Buffer, opts: VerifyOptions = {}): Promise<VerifiedImage> {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  const maxPixels = opts.maxPixels ?? MAX_IMAGE_PIXELS;

  if (buffer.length === 0) throw new ImageVerificationError("empty upload");
  if (buffer.length > maxBytes) {
    throw new ImageVerificationError(`file size ${buffer.length} bytes exceeds cap ${maxBytes}`);
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: maxPixels }).metadata();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ImageVerificationError(`not a decodable image (or exceeds pixel limit): ${reason}`);
  }

  const { format, width, height } = meta;
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new ImageVerificationError(`unsupported image format: ${format ?? "unknown"}`);
  }
  if (!width || !height) throw new ImageVerificationError("image has no decodable dimensions");
  if (width * height > maxPixels) {
    throw new ImageVerificationError(`image ${width}x${height} exceeds pixel cap ${maxPixels}`);
  }

  return {
    hash: createHash("sha256").update(buffer).digest("hex"),
    format, width, height, bytes: buffer.length,
  };
}
