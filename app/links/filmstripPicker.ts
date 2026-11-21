// Picks the photos for the drifting "Recent work" strip on /links: portrait
// orientation only (the frames are 3:4), and dealt round-robin across
// categories so one kind of session never fills the whole strip. Input order
// (featured first, then admin sort order) is preserved within each category.

export type FilmstripSource = {
  id: number;
  image_url: string;
  alt: string;
  category_slug: string;
  width?: number | null;
  height?: number | null;
};

export const FILMSTRIP_SIZE = 8;

function isPortrait(image: FilmstripSource): boolean {
  if (!image.width || !image.height) return true;
  return image.height >= image.width;
}

export function pickFilmstripImages<T extends FilmstripSource>(
  images: readonly T[],
  count: number = FILMSTRIP_SIZE,
): T[] {
  const seen = new Set<string>();
  const byCategory = new Map<string, T[]>();

  for (const image of images) {
    if (!image.image_url || seen.has(image.image_url) || !isPortrait(image)) continue;
    seen.add(image.image_url);
    byCategory.set(image.category_slug, [...(byCategory.get(image.category_slug) ?? []), image]);
  }

  const queues = [...byCategory.values()];
  const longest = Math.max(0, ...queues.map((queue) => queue.length));
  const dealt: T[] = [];
  for (let round = 0; round < longest; round++) {
    for (const queue of queues) {
      if (queue[round]) dealt.push(queue[round]);
    }
  }
  return dealt.slice(0, count);
}
