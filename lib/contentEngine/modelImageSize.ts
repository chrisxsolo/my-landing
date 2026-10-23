// How a photo is sized for the vision model. Claude downsamples anything above
// ~1.15 megapixels (or 1568px on the long edge) before it looks at it, so a
// larger upload costs transfer and encode time without adding detail. Encoding
// straight to that size means the model sees exactly what it saw before, with
// a payload a fraction of the size.
export const MODEL_IMAGE_MAX_EDGE = 1568;
export const MODEL_IMAGE_MAX_PIXELS = 1_150_000;
export const MODEL_IMAGE_QUALITY = 80;

/**
 * Long-edge target (px) that keeps an image inside both model limits. Never
 * upscales. Orientation-agnostic: callers resize with fit "inside" a square
 * box of this size, so EXIF rotation doesn't matter.
 */
export function modelImageLongEdge(width: number, height: number): number {
  const longEdge = Math.max(width, height);
  if (longEdge <= 0) return MODEL_IMAGE_MAX_EDGE;
  const pixelBound = Math.floor(longEdge * Math.sqrt(MODEL_IMAGE_MAX_PIXELS / (width * height)));
  return Math.max(1, Math.min(longEdge, MODEL_IMAGE_MAX_EDGE, pixelBound));
}
