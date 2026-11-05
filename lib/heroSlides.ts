// Which homepage hero slides should have their image in the DOM.
//
// The server HTML carries only the first slide (preloaded, high priority) so
// it owns the page's early bandwidth. After that, only the slide a visitor is
// about to see is fetched: the one after the current slide, which is what
// autoplay, the "next" arrow, and the swipe gesture all reach for. Everything
// else stays unmounted until it is selected, so the carousel never competes
// with the rest of the page for the connection.

export function wrapSlideIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

/** Slides to keep mounted once `current` is showing: itself and the next one. */
export function slidesToMount(current: number, total: number): number[] {
  if (total <= 0) return [];
  const shown = wrapSlideIndex(current, total);
  const next = wrapSlideIndex(shown + 1, total);
  return next === shown ? [shown] : [shown, next];
}

/** Adds `indices` to the mounted set without re-rendering when nothing changed. */
export function addMountedSlides(mounted: readonly number[], indices: readonly number[]): readonly number[] {
  const additions = indices.filter((index) => !mounted.includes(index));
  return additions.length ? [...mounted, ...additions] : mounted;
}
