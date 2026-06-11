// Pure derived workflow state for a photography session (spec §6). Consumed by
// every UI surface; never re-derived in components. Rules are evaluated
// top-down, first match wins. Lease expiry is evaluated first: an expired
// processing/publishing claim is treated as interrupted (resumable), not active.
export interface PhotoState {
  excluded: boolean;
  analysis_status: "pending" | "processing" | "completed" | "failed" | "skipped";
  analysis_lease_expires_at: string | null;
}
export interface PackageState {
  status: "generating" | "ready" | "needs_attention" | "failed" | "archived";
}
export interface ItemState {
  status: "draft" | "approved" | "rejected" | "publishing" | "published" | "failed";
  publishing_started_at: string | null;
}

export type SessionEngineState =
  | "failed" | "publishing" | "partially_published" | "published" | "reviewed"
  | "generated" | "analyzing" | "analyzed" | "uploaded" | "empty";

export interface DeriveInput {
  photos: PhotoState[];
  activePackage: PackageState | null;
  activeItems: ItemState[];
  now: Date;
}

// A lease is "expired" when absent or strictly in the past (spec §6).
export function isLeaseExpired(leaseExpiresAt: string | null, now: Date): boolean {
  if (!leaseExpiresAt) return true;
  return new Date(leaseExpiresAt).getTime() <= now.getTime();
}

export function deriveSessionEngineState(input: DeriveInput): SessionEngineState {
  const { photos, activePackage, activeItems, now } = input;
  const liveProcessing = (p: PhotoState) =>
    p.analysis_status === "processing" && !isLeaseExpired(p.analysis_lease_expires_at, now);
  const livePublishing = (i: ItemState) =>
    i.status === "publishing" && !isLeaseExpired(i.publishing_started_at, now);

  const nonExcluded = photos.filter((p) => !p.excluded);
  const nonRejected = activeItems.filter((i) => i.status !== "rejected");
  const published = nonRejected.filter((i) => i.status === "published");
  const otherUnpublished = nonRejected.filter(
    (i) => i.status === "approved" || i.status === "draft"
        || i.status === "publishing" || i.status === "failed",
  );

  // 1. failed
  if (nonExcluded.some((p) => p.analysis_status === "failed")
      || activePackage?.status === "failed"
      || activeItems.some((i) => i.status === "failed")) {
    return "failed";
  }
  // 2. publishing (live lease only)
  if (activeItems.some(livePublishing)) return "publishing";
  // 3. partially_published
  if (published.length >= 1 && otherUnpublished.length >= 1) return "partially_published";
  // 4. published (≥1 published AND every non-rejected item published)
  if (published.length >= 1 && nonRejected.every((i) => i.status === "published")) return "published";
  // 5. reviewed (items exist; all approved/rejected; none published/publishing)
  if (activeItems.length >= 1
      && activeItems.every((i) => i.status === "approved" || i.status === "rejected")) {
    return "reviewed";
  }
  // 6. generated (active package ready/needs_attention with ≥1 draft)
  if ((activePackage?.status === "ready" || activePackage?.status === "needs_attention")
      && activeItems.some((i) => i.status === "draft")) {
    return "generated";
  }
  // 7. analyzing (any non-excluded photo processing with a live lease)
  if (nonExcluded.some(liveProcessing)) return "analyzing";
  // 8. analyzed (≥1 photo; all non-excluded completed or skipped)
  if (photos.length >= 1
      && nonExcluded.every((p) => p.analysis_status === "completed" || p.analysis_status === "skipped")) {
    return "analyzed";
  }
  // 9. uploaded (≥1 photo; analysis incomplete)
  if (photos.length >= 1) return "uploaded";
  // 10. empty
  return "empty";
}
