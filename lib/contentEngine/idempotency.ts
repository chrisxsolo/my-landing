// Deterministic idempotency key for session_content_items (spec §3.4):
// "session:package:type:destination:photo". Absent optional segments become a
// stable "-" so keys never collide across content shapes. The DB enforces a
// unique constraint on this key.
export interface IdempotencyKeyParts {
  sessionId: string;
  packageId: string;
  contentType: string;
  destination?: string | null;
  photoId?: string | null;
}

const PLACEHOLDER = "-";

function segment(value: string | null | undefined): string {
  if (value == null || value === "") return PLACEHOLDER;
  if (value.includes(":")) {
    throw new Error(`idempotency key segment must not contain the ':' delimiter: "${value}"`);
  }
  return value;
}

export function buildIdempotencyKey(parts: IdempotencyKeyParts): string {
  return [
    segment(parts.sessionId),
    segment(parts.packageId),
    segment(parts.contentType),
    segment(parts.destination),
    segment(parts.photoId),
  ].join(":");
}
