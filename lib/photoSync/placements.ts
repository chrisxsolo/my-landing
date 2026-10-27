// "Where this photo appears": every place on the public site that references
// one photo, lined up so the admin can remove or replace it in ONE place
// without touching the others. Pure — placementLoad.ts gathers the rows,
// placementActions.ts performs the edits. Nothing here invents a destination:
// every type below is a table or setting that already shows photos.
import type { EditableSettingKey } from "@/lib/siteSettingsShared";
import type { LocationGuideType } from "@/lib/locations/guideCoverage";
import { pagePath, parsePageKey } from "@/lib/pagePhotos/pageKeys";
import { DISTRIBUTION_EDITORS } from "@/lib/photoSync/distribution";

export type PlacementType =
  | "portfolio" | "page" | "campus-spot" | "guide" | "journal"
  | "site-slot" | "hero-carousel" | "featured-session" | "bay-area-location" | "case-study";

export const PLACEMENT_TYPE_LABELS: Record<PlacementType, string> = {
  portfolio: "Portfolio", page: "Curated page", "campus-spot": "Campus spot", guide: "Location guide",
  journal: "Journal post", "site-slot": "Site photo slot", "hero-carousel": "Homepage hero carousel",
  "featured-session": "Homepage featured session", "bay-area-location": "Bay Area location", "case-study": "Case study",
};

/** What placementActions.ts needs to edit exactly one placement. */
export type PlacementTarget =
  | { kind: "portfolio"; portfolioId: number }
  | { kind: "page"; pageKey: string; explicitId: string | null }
  | { kind: "campus-spot"; spotId: number }
  | { kind: "campus-spot-tag"; schoolSlug: string; spotKey: string }
  | { kind: "campus-spot-auto"; schoolSlug: string; spotKey: string }
  | { kind: "guide"; guide: LocationGuideType; rowId: string }
  | { kind: "journal"; postId: number; role: "cover" | "gallery" }
  | { kind: "site-slot"; key: EditableSettingKey }
  | { kind: "hero-carousel"; portfolioId: number }
  | { kind: "bay-area-location"; locationId: number }
  | { kind: "case-study"; caseStudyId: number; field: "cover" | "preview" };

export interface Placement {
  id: string;
  type: PlacementType;
  name: string;
  detail: string | null;
  published: boolean;
  publicPath: string | null;
  editorHref: string;
  /** manual = a person chose this photo here; automatic = a sync or matcher did. */
  origin: "manual" | "automatic";
  /** outdated = the placement still exists but the photo should no longer be shown. */
  state: "active" | "outdated";
  stateReason: string | null;
  canRemove: boolean;
  canReplace: boolean;
  target: PlacementTarget;
}

export interface PlacementFacts {
  url: string;
  /** Why the photo is blocked from public use (excluded, permission lost…), else null. */
  blockedReason: string | null;
  portfolio: { id: number; published: boolean; category: string; heroCarousel: boolean }[];
  /** Curated pages the photo is shown on, plus explicit school placements. */
  pages: { key: string; label: string; shown: boolean; pinned: boolean; explicitId: string | null }[];
  campusSpots: { spotId: number | null; schoolSlug: string; spotKey: string; spotName: string; origin: "manual" | "tag" | "auto" }[];
  guides: { guide: LocationGuideType; rowId: string; slug: string; name: string; published: boolean; featured: boolean }[];
  journal: { postId: number; slug: string; title: string; role: "cover" | "gallery"; published: boolean }[];
  siteSlots: EditableSettingKey[];
  /** Homepage featured-session slots whose pinned post has this photo as its cover. */
  featuredSessions: { key: EditableSettingKey; postSlug: string }[];
  locations: { id: number; title: string; active: boolean }[];
  caseStudies: { id: number; title: string; field: "cover" | "preview"; active: boolean }[];
}

export const PLACEMENT_EDITORS = {
  ...DISTRIBUTION_EDITORS,
  blog: "/admin?tab=blog",
  home: "/admin?tab=home",
  caseStudies: "/admin?tab=caseStudies",
  couplesGuide: "/admin?tab=couplesLocations",
  familyGuide: "/admin?tab=familyGuide",
  portraitGuide: "/admin?tab=portraitLocations",
} as const;

const GUIDE_EDITOR: Record<LocationGuideType, string> = {
  couples: PLACEMENT_EDITORS.couplesGuide, family: PLACEMENT_EDITORS.familyGuide, portrait: PLACEMENT_EDITORS.portraitGuide,
};
const GUIDE_LABEL: Record<LocationGuideType, string> = { couples: "Couples guide", family: "Family guide", portrait: "Portrait guide" };
const CAMPUS_SPOTS_PATH = "/grad-guide/campus-spots";
const BAY_AREA_LOCATIONS_PATH = "/bay-area-locations";
const PORTFOLIO_PATH = "/portfolio";
const PRICING_PATH = "/pricing";

export function portfolioPath(category: string): string {
  return category === "couples" ? `${PORTFOLIO_PATH}/couples` : `${PORTFOLIO_PATH}?category=${encodeURIComponent(category)}`;
}

type Base = Pick<Placement, "id" | "type" | "name" | "detail" | "published" | "publicPath" | "editorHref" | "origin" | "canRemove" | "canReplace" | "target">;

function finish(base: Base, facts: PlacementFacts, outdated: string | null = null): Placement {
  const reason = facts.blockedReason ?? outdated;
  return { ...base, state: reason ? "outdated" : "active", stateReason: reason };
}

function portfolioPlacements(facts: PlacementFacts): Placement[] {
  return facts.portfolio.flatMap((row) => [
    finish({
      id: `portfolio:${row.id}`, type: "portfolio", name: `${row.category} portfolio`, detail: `Portfolio #${row.id}`,
      published: row.published, publicPath: portfolioPath(row.category),
      editorHref: row.category === "couples" ? PLACEMENT_EDITORS.couplesPortfolio : PLACEMENT_EDITORS.portfolio,
      origin: "manual", canRemove: row.published, canReplace: true, target: { kind: "portfolio", portfolioId: row.id },
    }, facts),
    ...(row.heroCarousel ? [finish({
      id: `hero-carousel:${row.id}`, type: "hero-carousel", name: "Homepage hero carousel", detail: `Portfolio #${row.id}`,
      published: row.published, publicPath: "/", editorHref: PLACEMENT_EDITORS.home, origin: "manual",
      canRemove: true, canReplace: true, target: { kind: "hero-carousel", portfolioId: row.id },
    }, facts, row.published ? null : "the portfolio photo is unpublished")] : []),
  ]);
}

function pagePlacements(facts: PlacementFacts): Placement[] {
  return facts.pages.filter((p) => p.shown || p.explicitId).map((p) => {
    const kind = parsePageKey(p.key)?.kind;
    const manual = p.pinned || p.explicitId !== null;
    return finish({
      id: `page:${p.key}`, type: "page", name: p.label,
      detail: p.explicitId ? "Content Engine school placement" : p.pinned ? "pinned by you" : "matched automatically",
      published: p.shown, publicPath: pagePath(p.key), editorHref: PLACEMENT_EDITORS.pagePhotos,
      origin: manual ? "manual" : "automatic", canRemove: true, canReplace: kind === "grads",
      target: { kind: "page", pageKey: p.key, explicitId: p.explicitId },
    }, facts, p.shown ? null : "placed on this page but not shown (past the page's limit or hidden)");
  });
}

function campusSpotPlacements(facts: PlacementFacts): Placement[] {
  return facts.campusSpots.map((s) => {
    const target: PlacementTarget = s.origin === "manual" && s.spotId !== null
      ? { kind: "campus-spot", spotId: s.spotId }
      : s.origin === "tag" ? { kind: "campus-spot-tag", schoolSlug: s.schoolSlug, spotKey: s.spotKey }
        : { kind: "campus-spot-auto", schoolSlug: s.schoolSlug, spotKey: s.spotKey };
    const how = s.origin === "manual" ? "chosen by you" : s.origin === "tag" ? "from your spot tag" : "filled automatically";
    return finish({
      id: `campus-spot:${s.schoolSlug}:${s.spotKey}:${s.origin}`, type: "campus-spot",
      name: `Campus spot · ${s.spotName}`, detail: `${s.schoolSlug} · ${how}`, published: true,
      publicPath: CAMPUS_SPOTS_PATH, editorHref: PLACEMENT_EDITORS.campusSpots,
      origin: s.origin === "auto" ? "automatic" : "manual", canRemove: true, canReplace: s.origin === "manual", target,
    }, facts);
  });
}

function guidePlacements(facts: PlacementFacts): Placement[] {
  return facts.guides.map((g) => finish({
    id: `guide:${g.guide}:${g.rowId}`, type: "guide", name: `${GUIDE_LABEL[g.guide]} · ${g.name}`,
    detail: g.featured ? "hero image" : "gallery", published: g.published,
    publicPath: pagePath(`${g.guide}/${g.slug}`), editorHref: GUIDE_EDITOR[g.guide], origin: "manual",
    canRemove: g.published, canReplace: true, target: { kind: "guide", guide: g.guide, rowId: g.rowId },
  }, facts));
}

function journalPlacements(facts: PlacementFacts): Placement[] {
  return facts.journal.map((j) => finish({
    id: `journal:${j.postId}:${j.role}`, type: "journal", name: `Journal · ${j.title}`,
    detail: `${j.role} · ${j.slug}${j.published ? "" : " · unpublished"}`, published: j.published,
    publicPath: `/blog/${j.slug}`, editorHref: PLACEMENT_EDITORS.blog, origin: "manual",
    canRemove: j.role === "gallery", canReplace: true, target: { kind: "journal", postId: j.postId, role: j.role },
  }, facts));
}

function slotPlacements(facts: PlacementFacts): Placement[] {
  const slots = facts.siteSlots.map((key) => finish({
    id: `site-slot:${key}`, type: "site-slot", name: `Site slot · ${key}`, detail: null, published: true,
    publicPath: key.startsWith("pricing_") ? PRICING_PATH : "/", editorHref: PLACEMENT_EDITORS.home, origin: "manual",
    canRemove: true, canReplace: true, target: { kind: "site-slot", key },
  }, facts));
  const featured = facts.featuredSessions.map((f) => finish({
    id: `featured-session:${f.key}`, type: "featured-session", name: "Homepage featured session",
    detail: `cover of ${f.postSlug} — change the post's cover to change it`, published: true, publicPath: "/",
    editorHref: PLACEMENT_EDITORS.home, origin: "manual", canRemove: false, canReplace: false, target: { kind: "site-slot", key: f.key },
  }, facts));
  return [...slots, ...featured];
}

function locationPlacements(facts: PlacementFacts): Placement[] {
  return facts.locations.map((l) => finish({
    id: `bay-area-location:${l.id}`, type: "bay-area-location", name: `Bay Area location · ${l.title}`,
    detail: "featured photo", published: l.active, publicPath: BAY_AREA_LOCATIONS_PATH,
    editorHref: PLACEMENT_EDITORS.locationLibrary, origin: "manual", canRemove: true, canReplace: true,
    target: { kind: "bay-area-location", locationId: l.id },
  }, facts));
}

function caseStudyPlacements(facts: PlacementFacts): Placement[] {
  return facts.caseStudies.map((c) => finish({
    id: `case-study:${c.id}:${c.field}`, type: "case-study", name: `Case study · ${c.title}`,
    detail: c.field === "cover" ? "cover image" : "preview image", published: c.active, publicPath: PORTFOLIO_PATH,
    editorHref: PLACEMENT_EDITORS.caseStudies, origin: "manual", canRemove: c.field === "preview", canReplace: true,
    target: { kind: "case-study", caseStudyId: c.id, field: c.field },
  }, facts));
}

/** Every placement of one photo, most public first. Pure. */
export function buildPlacements(facts: PlacementFacts): Placement[] {
  return [
    ...portfolioPlacements(facts), ...pagePlacements(facts), ...campusSpotPlacements(facts), ...guidePlacements(facts),
    ...journalPlacements(facts), ...slotPlacements(facts), ...locationPlacements(facts), ...caseStudyPlacements(facts),
  ];
}

/** How many public pages show the photo right now (the picker's "used on N pages"). */
export function countLivePages(placements: readonly Placement[]): number {
  return new Set(placements.filter((p) => p.published && p.state === "active").map((p) => p.publicPath ?? p.id)).size;
}
