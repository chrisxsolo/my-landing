// Adaptive batching constants + pure helpers (spec §8.1 step 2): <=4 photos
// per request, a combined encoded-bytes cap, and a quality/dimension ladder
// the analysis service walks until a batch fits. The UI calls this "batch
// processing"; each route call processes one batch to stay under maxDuration.
export const MAX_PHOTOS_PER_BATCH = 4;
export const MAX_BATCH_IMAGE_BYTES = 4 * 1024 * 1024; // combined encoded payload cap

export interface EncodeStep {
  maxDimension: number;
  quality: number;
}

export const ANALYSIS_ENCODE_LADDER: readonly EncodeStep[] = [
  { maxDimension: 1600, quality: 78 },
  { maxDimension: 1400, quality: 68 },
  { maxDimension: 1200, quality: 60 },
  { maxDimension: 1000, quality: 52 },
];

export function chunkForAnalysis<T>(items: T[], maxPerBatch = MAX_PHOTOS_PER_BATCH): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerBatch) {
    batches.push(items.slice(i, i + maxPerBatch));
  }
  return batches;
}

export function ladderStep(step: number): EncodeStep {
  const clamped = Math.min(Math.max(step, 0), ANALYSIS_ENCODE_LADDER.length - 1);
  return ANALYSIS_ENCODE_LADDER[clamped];
}

export function totalBytes(buffers: Buffer[]): number {
  return buffers.reduce((sum, b) => sum + b.length, 0);
}
