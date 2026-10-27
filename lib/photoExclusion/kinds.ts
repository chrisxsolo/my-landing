// Explicit placements an excluded photo can still be live in. Pure — the
// admin UI reads these shapes and the server builds them from rows.
//
// Excluding a photo in the Content Engine removes it from the automatically
// matched pages (school galleries, guide pools, the location library), but a
// photo someone placed by hand — in a journal post's gallery, the portfolio,
// or a couples / family / portrait guide — stays where it was put. Whether an
// exclusion should also pull those is the owner's call (pending), so nothing
// here removes anything: each placement names the existing admin endpoint
// that would, for a person to use one at a time.

export const PLACEMENT_KINDS = [
  "journal", "portfolio", "couples_guide", "family_guide", "portrait_guide", "grad_spot", "location_hero",
] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

export const PLACEMENT_LABELS: Record<PlacementKind, string> = {
  journal: "Journal post",
  portfolio: "Portfolio",
  couples_guide: "Couples location guide",
  family_guide: "Family location guide",
  portrait_guide: "Portrait location guide",
  grad_spot: "Campus spot photo",
  location_hero: "Bay Area location hero",
};

/** An existing admin endpoint that removes one placement. */
export interface PlacementRemoval {
  method: "DELETE" | "PATCH";
  url: string;
  body?: Record<string, unknown>;
}

export interface LivePlacement {
  /** session_photos.id of the excluded photo. */
  photoId: string;
  kind: PlacementKind;
  /** The placement row's id (or slug) in its own table. */
  ref: string;
  /** Where the photo shows, as a person reads it ("Journal post “Spring at Berkeley”"). */
  where: string;
  /** The admin page where the placement is edited by hand. */
  href: string;
  /** How to remove it with an existing endpoint; null when only the editor can (journal galleries). */
  removal: PlacementRemoval | null;
}

export interface PlacementSummary {
  count: number;
  /** "2 in the portfolio, 1 in a journal post" style lines, one per kind. */
  where: string[];
}

const ADMIN_TAB = (tab: string) => `/admin?tab=${tab}`;
const GUIDE_TABS: Record<"couples_guide" | "family_guide" | "portrait_guide", { tab: string; api: string }> = {
  couples_guide: { tab: "couplesLocations", api: "/api/admin/couples-photos" },
  family_guide: { tab: "familyGuide", api: "/api/admin/family-photos" },
  portrait_guide: { tab: "portraitLocations", api: "/api/admin/portrait-photos" },
};

const quote = (s: string | null | undefined, fallback: string) => (s?.trim() ? `“${s.trim()}”` : fallback);

export function journalPlacement(photoId: string, post: { id: number | string; title: string | null }): LivePlacement {
  // The journal gallery code belongs to another agent: only a link, never a removal.
  return {
    photoId, kind: "journal", ref: String(post.id), where: `Journal post ${quote(post.title, `#${post.id}`)}`,
    href: ADMIN_TAB("blog"), removal: null,
  };
}

export function portfolioPlacement(photoId: string, row: { id: number | string; title: string | null }): LivePlacement {
  return {
    photoId, kind: "portfolio", ref: String(row.id), where: `Portfolio image ${quote(row.title, `#${row.id}`)}`,
    href: ADMIN_TAB("portfolio"), removal: { method: "DELETE", url: `/api/admin/portfolio-images?id=${row.id}` },
  };
}

export function guidePlacement(
  photoId: string, kind: keyof typeof GUIDE_TABS, row: { id: string; location_slug: string },
): LivePlacement {
  const { tab, api } = GUIDE_TABS[kind];
  return {
    photoId, kind, ref: row.id, where: `${PLACEMENT_LABELS[kind]} · ${row.location_slug}`,
    href: ADMIN_TAB(tab), removal: { method: "DELETE", url: api, body: { id: row.id } },
  };
}

export function gradSpotPlacement(photoId: string, row: { id: number | string; name: string | null }): LivePlacement {
  // location_spots has one image slot; emptying it is an editor decision, so only a link.
  return {
    photoId, kind: "grad_spot", ref: String(row.id), where: `Campus spot ${quote(row.name, `#${row.id}`)}`,
    href: ADMIN_TAB("locations"), removal: null,
  };
}

export function locationHeroPlacement(photoId: string, row: { id: number | string; title: string | null }): LivePlacement {
  return {
    photoId, kind: "location_hero", ref: String(row.id), where: `Hero of Bay Area location ${quote(row.title, `#${row.id}`)}`,
    href: "/admin/content-engine/locations",
    removal: { method: "PATCH", url: `/api/admin/location-library/${row.id}`, body: { featured_photo_id: null } },
  };
}

/** Counts per kind, in the order of PLACEMENT_KINDS. */
export function summarizePlacements(list: readonly LivePlacement[]): PlacementSummary {
  const where = PLACEMENT_KINDS.flatMap((kind) => {
    const n = list.filter((p) => p.kind === kind).length;
    return n === 0 ? [] : [`${n} in ${PLACEMENT_LABELS[kind].toLowerCase()}${n === 1 ? "" : "s"}`];
  });
  return { count: list.length, where };
}
