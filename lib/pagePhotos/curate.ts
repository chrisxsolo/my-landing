// Orders the photos one page shows. Pure — the same function feeds the public
// page and the admin preview, so what the admin sees is what visitors get.
//
//   1. hidden for this page → dropped (other pages unaffected)
//   2. pinned for this page, in pin order (the hero pin first)
//   3. photos placed on this page explicitly (Content Engine school / guide
//      placements, admin guide uploads), in their own order — unless
//      mixPlacements is on (school pages), where placements instead count as
//      their session's top picks inside the round-robin below
//   4. automatically matched photos: each session's best first (featured,
//      then AI quality score), taken round-robin across sessions so one big
//      shoot can't fill the page with near-identical frames
// Pins only reorder photos that are already eligible; a pin never publishes.

export interface PageCandidate {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  /** Placed on this page on purpose (engine placement / guide upload). */
  explicit: boolean;
  explicitOrder: number;
  featured: boolean;
  quality: number | null;
  sortOrder: number;
  sessionKey: string;
}

export interface CurationRow {
  pageKey: string;
  imageUrl: string;
  mode: "pin" | "hide";
  position: number;
  isHero: boolean;
}

export interface CuratedPage {
  /** Display order; ordered[0] is the hero. */
  ordered: PageCandidate[];
  /** Eligible but past the page's limit. */
  overflow: PageCandidate[];
  hidden: PageCandidate[];
  heroPinned: boolean;
}

// Photos without an AI score (older uploads) rank as solid but not top picks.
const UNSCORED_QUALITY = 6;
// The automatic hero is the first portrait-orientation frame within this many.
const HERO_SEARCH_WINDOW = 8;

function dedupe(candidates: readonly PageCandidate[]): PageCandidate[] {
  const seen = new Set<string>();
  // Explicit placements win a URL tie so their caption/alt survive.
  const sorted = [...candidates].sort((a, b) => Number(b.explicit) - Number(a.explicit));
  return sorted.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

function bySessionRank(a: PageCandidate, b: PageCandidate): number {
  return Number(b.explicit) - Number(a.explicit)
    || Number(b.featured) - Number(a.featured)
    || (b.quality ?? UNSCORED_QUALITY) - (a.quality ?? UNSCORED_QUALITY)
    || a.sortOrder - b.sortOrder
    || a.url.localeCompare(b.url);
}

/** Best-of-each-session first, then second-best of each, and so on. */
export function roundRobinBySession(candidates: readonly PageCandidate[]): PageCandidate[] {
  const groups = new Map<string, PageCandidate[]>();
  for (const c of candidates) groups.set(c.sessionKey, [...(groups.get(c.sessionKey) ?? []), c]);
  const ranked = [...groups.values()]
    .map((group) => [...group].sort(bySessionRank))
    .sort((a, b) => bySessionRank(a[0], b[0]));
  const longest = Math.max(0, ...ranked.map((g) => g.length));
  return Array.from({ length: longest }, (_, round) => ranked.flatMap((g) => (g[round] ? [g[round]] : []))).flat();
}

function isPortrait(c: PageCandidate): boolean {
  return !c.width || !c.height || c.height >= c.width;
}

// Only reorders when nothing is pinned: a pinned photo always keeps its place.
function withPortraitHeroFirst(ordered: PageCandidate[]): PageCandidate[] {
  const index = ordered.slice(0, HERO_SEARCH_WINDOW).findIndex(isPortrait);
  if (index <= 0) return ordered;
  return [ordered[index], ...ordered.slice(0, index), ...ordered.slice(index + 1)];
}

export function curatePage(
  candidates: readonly PageCandidate[],
  curation: readonly CurationRow[],
  options: { limit: number; preferPortraitHero?: boolean; mixPlacements?: boolean },
): CuratedPage {
  const unique = dedupe(candidates);
  const rule = new Map(curation.map((row) => [row.imageUrl, row]));
  const hidden = unique.filter((c) => rule.get(c.url)?.mode === "hide");
  const visible = unique.filter((c) => rule.get(c.url)?.mode !== "hide");

  const pinRank = (c: PageCandidate) => {
    const row = rule.get(c.url) as CurationRow;
    return row.isHero ? Number.NEGATIVE_INFINITY : row.position;
  };
  const pinned = visible.filter((c) => rule.get(c.url)?.mode === "pin").sort((a, b) => pinRank(a) - pinRank(b));
  const rest = visible.filter((c) => !rule.has(c.url));
  const explicit = options.mixPlacements
    ? []
    : rest.filter((c) => c.explicit).sort((a, b) => a.explicitOrder - b.explicitOrder);
  const automatic = roundRobinBySession(options.mixPlacements ? rest : rest.filter((c) => !c.explicit));

  const heroPinned = pinned.some((c) => rule.get(c.url)?.isHero);
  const merged = [...pinned, ...explicit, ...automatic];
  const all = options.preferPortraitHero && pinned.length === 0 ? withPortraitHeroFirst(merged) : merged;
  const limit = Math.max(0, options.limit);
  return { ordered: all.slice(0, limit), overflow: all.slice(limit), hidden, heroPinned };
}
