// Where one photo can appear on the public site, and why. Pure — safe for
// client components.
//
// Nothing here decides eligibility on its own: every fact comes from the
// systems that already place photos (tagging audit → eligible page keys,
// page curation → shown / overflow / hidden, campus-spot picks, the photo
// pool's permission check). This module only lines those facts up per
// destination so the admin can see them in one place. It never writes.

import { CATEGORY_LABELS, type AuditedPhoto } from "@/lib/photoTagging/types";
import { pagePath, parsePageKey } from "@/lib/pagePhotos/pageKeys";

export type DistributionStatus = "displayed" | "eligible" | "review" | "not-eligible";

export const DISTRIBUTION_STATUS_LABELS: Record<DistributionStatus, string> = {
  displayed: "Currently displayed",
  eligible: "Eligible",
  review: "Awaiting review",
  "not-eligible": "Not eligible",
};

export interface Destination {
  id: string;
  label: string;
  /** Public page, when there is one to open. */
  path: string | null;
  /** The admin editor that controls this destination. */
  editorHref: string;
  status: DistributionStatus;
  reason: string;
}

/** Where the photo stands on a curated public page. */
export type PagePlacement = "shown" | "overflow" | "hidden" | "not-listed";

export interface CampusSpotPick {
  schoolSlug: string;
  spotKey: string;
  spotName: string;
  /** manual = chosen in Campus Spots; tag = spot tag; auto = filled by the sync. */
  origin: "manual" | "tag" | "auto";
}

export interface DistributionInput {
  photo: AuditedPhoto;
  /** From the photo pool: false when the session's marketing permission or exclusion blocks it. */
  permission: { ok: boolean; reason: string | null };
  /** Page key → placement, for every page the photo is eligible for or curated on. */
  placements: Record<string, PagePlacement>;
  /** Human labels for page keys ("Grads · SJSU"). */
  pageLabels: Record<string, string>;
  campusSpot: CampusSpotPick | null;
  /** Whether the photo's school has a campus-spot guide. */
  schoolHasSpots: boolean;
}

export const DISTRIBUTION_EDITORS = {
  portfolio: "/admin?tab=portfolio",
  couplesPortfolio: "/admin?tab=couplesPortfolio",
  pagePhotos: "/admin?tab=pagePhotos",
  campusSpots: "/admin?tab=locations",
  locationLibrary: "/admin/content-engine/locations",
  tagging: "/admin/content-engine/photos",
} as const;

const GUIDE_LABELS: Record<string, string> = { couples: "Couples guide", family: "Family guide", portrait: "Portrait guide" };

function portfolioDestination(photo: AuditedPhoto): Destination {
  const label = `${CATEGORY_LABELS[photo.category ?? ""] ?? "Portfolio"} portfolio`;
  const editorHref = photo.category === "couples" ? DISTRIBUTION_EDITORS.couplesPortfolio : DISTRIBUTION_EDITORS.portfolio;
  const base = { id: "portfolio", label, path: null, editorHref };
  if (photo.source !== "portfolio") {
    return { ...base, status: "not-eligible", reason: "Only in the Content Engine; add it to the Portfolio to show it there." };
  }
  if (!photo.category) return { ...base, status: "review", reason: "No category set, so no portfolio grid can show it." };
  return { ...base, status: "displayed", reason: "Published Portfolio photo in this category." };
}

// Page Photos curates every school page and location guide page.
function pageDestination(key: string, placement: PagePlacement, label: string): Destination {
  const base = { id: `page:${key}`, label, path: pagePath(key), editorHref: DISTRIBUTION_EDITORS.pagePhotos };
  switch (placement) {
    case "shown": return { ...base, status: "displayed", reason: "Shown on this page now." };
    case "overflow": return { ...base, status: "eligible", reason: "Matches this page but is past its photo limit; pin it to show it." };
    case "hidden": return { ...base, status: "not-eligible", reason: "Hidden on this page by you." };
    default: return { ...base, status: "eligible", reason: "Matches this page; the next refresh can show it." };
  }
}

function pageDestinations(input: DistributionInput): Destination[] {
  return Object.entries(input.placements).map(([key, placement]) => {
    const parsed = parsePageKey(key);
    const fallback = parsed ? `${parsed.kind === "grads" ? "Grads" : GUIDE_LABELS[parsed.kind]} · ${parsed.slug}` : key;
    return pageDestination(key, placement, input.pageLabels[key] ?? fallback);
  });
}

/** Facts still missing that keep the photo off pages it could reach. */
function reviewDestinations(photo: AuditedPhoto): Destination[] {
  const out: Destination[] = [];
  const check = (field: string) => photo.checks.find((c) => c.field === field);
  const school = check("school");
  if (photo.category === "grads" && school?.state === "missing") {
    out.push({ id: "review:school", label: "School pages", path: null, editorHref: DISTRIBUTION_EDITORS.tagging,
      status: "review", reason: "Set the university so its school page and campus spots can use it." });
  }
  const location = check("location");
  if (location?.state === "missing") {
    const options = photo.suggestions.filter((s) => s.field === "location");
    out.push({ id: "review:location", label: "Bay Area location pages", path: null, editorHref: DISTRIBUTION_EDITORS.tagging,
      status: options.length > 0 ? "review" : "not-eligible",
      reason: options.length > 1 ? `Confirm the location: ${options.map((s) => s.label).join(" or ")}.`
        : options.length === 1 ? `Confirm the location (${options[0].label}) to add it to that location's pages.`
          : "No confirmed location, so no location page can use it." });
  }
  return out;
}

function campusSpotDestination(input: DistributionInput): Destination | null {
  const { photo, campusSpot } = input;
  if (photo.category !== "grads" || !input.schoolHasSpots) return null;
  const base = { id: "campus-spot", label: "Campus spots", path: "/grad-guide/campus-spots", editorHref: DISTRIBUTION_EDITORS.campusSpots };
  if (campusSpot) {
    const how = campusSpot.origin === "auto" ? "filled automatically" : campusSpot.origin === "tag" ? "from its spot tag" : "chosen by you";
    return { ...base, status: "displayed", reason: `${campusSpot.spotName} (${how}).` };
  }
  const spot = photo.checks.find((c) => c.field === "spot");
  if (spot?.state === "ok") return { ...base, status: "eligible", reason: `Tagged ${spot.value ?? "a spot"}; shows there when that spot has no chosen photo.` };
  if (photo.suggestions.some((s) => s.field === "spot")) return { ...base, status: "review", reason: "A campus spot is suggested; confirm it in tagging." };
  return { ...base, status: "not-eligible", reason: "No evidence ties it to one campus spot." };
}

export function classifyDistribution(input: DistributionInput): Destination[] {
  const { photo } = input;
  if (!photo.published || !photo.url) {
    return [{ id: "private", label: "All public pages", path: null, editorHref: DISTRIBUTION_EDITORS.tagging,
      status: "not-eligible", reason: "Private: not published, so no public page can show it." }];
  }
  if (!input.permission.ok) {
    return [{ id: "permission", label: "All public pages", path: null, editorHref: DISTRIBUTION_EDITORS.tagging,
      status: "not-eligible", reason: `Blocked: ${input.permission.reason ?? "not cleared for marketing"}.` }];
  }
  const spot = campusSpotDestination(input);
  return [portfolioDestination(photo), ...pageDestinations(input), ...(spot ? [spot] : []), ...reviewDestinations(photo)];
}
