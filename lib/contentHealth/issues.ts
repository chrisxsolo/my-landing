// Turns a ContentHealthReport into the rows the dashboard card shows, each
// linked to the admin editor that fixes it. Pure; shared by the card and tests.
import type { SyncKind } from "@/lib/photoSync/runLog";
import type { TagFilter } from "@/lib/photoTagging/types";
import type { ContentHealthReport, HealthPart } from "@/lib/contentHealth/report";

const PHOTO_TAGGING_PATH = "/admin/content-engine/photos";
/** The Campus Spots tab of the main admin (LocationsTab). */
export const CAMPUS_SPOTS_EDITOR_PATH = "/admin?tab=locations";
export const LOCATION_LIBRARY_PATH = "/admin/content-engine/locations";
export const CONTENT_ENGINE_PATH = "/admin/content-engine";
const PORTFOLIO_EDITOR_PATH = "/admin?tab=portfolio";

/** Where a failed sync or run of one session is fixed. */
export const sessionEditorPath = (sessionId: string) => `${CONTENT_ENGINE_PATH}/${sessionId}`;

export const SYNC_KIND_LABELS: Record<SyncKind, string> = {
  campus_spots: "Campus spots",
  location_library: "Location library",
};

export const SYNC_EDITOR_PATHS: Record<SyncKind, string> = {
  campus_spots: CAMPUS_SPOTS_EDITOR_PATH,
  location_library: LOCATION_LIBRARY_PATH,
};

const taggingHref = (filter: TagFilter) => `${PHOTO_TAGGING_PATH}?filter=${filter}`;

export interface HealthItem {
  key: string;
  label: string;
  /** null when the part could not be read — shown as "unavailable", never as 0. */
  count: number | null;
  /** Extra context, or why the count is unavailable. */
  detail: string | null;
  href: string;
  /** A count to know, not a problem to fix: never shown in warning colors. */
  informational?: boolean;
}

function item<T>(
  key: string, label: string, href: string, part: HealthPart<T>,
  count: (v: T) => number, detail: (v: T) => string | null = () => null,
): HealthItem {
  return part.ok
    ? { key, label, href, count: count(part.value), detail: detail(part.value) }
    : { key, label, href, count: null, detail: part.error };
}

/** One row per tracked issue, in the order the card lists them. */
export function healthItems(report: ContentHealthReport): HealthItem[] {
  const { tagging, campusSpots, locationGuides, jobs, publishedPhotos } = report;
  return [
    { ...item("published-photos", "Published photos", PORTFOLIO_EDITOR_PATH, publishedPhotos, (v) => v.published),
      informational: true },
    item("failed-runs", "Failed content runs (30 days)", CONTENT_ENGINE_PATH, jobs, (v) => v.recentFailures.length),
    item("waiting-runs", "Content runs waiting", CONTENT_ENGINE_PATH, jobs, (v) => v.queued + v.stalled,
      (v) => (v.waitingTooLong > 0 || v.stalled > 0
        ? `${v.waitingTooLong + v.stalled} waiting over 6h or stalled — check the worker`
        : null)),
    item("needs-tagging", "Photos needing tagging", taggingHref("needs"), tagging, (v) => v.needsTagging),
    item("grads-missing-school", "Grads missing school", taggingHref("grads-missing-school"), tagging,
      (v) => v.gradsMissingSchool),
    item("awaiting-location", "Awaiting location confirmation", taggingHref("suggestions"), tagging,
      (v) => v.awaitingLocation),
    item("empty-campus-spots", "Empty campus spots", CAMPUS_SPOTS_EDITOR_PATH, campusSpots, (v) => v.empty,
      (v) => (v.fillable > 0 ? `${v.fillable} fillable by the next sync` : null)),
    item("guides-awaiting-review", "Location guides awaiting review", LOCATION_LIBRARY_PATH, locationGuides,
      (v) => v.awaitingReview),
  ];
}
