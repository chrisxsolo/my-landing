// Balanced masonry columns that keep reading order: each photo goes to the
// currently shortest column, so the admin's ordering reads left-to-right,
// top-to-bottom (CSS `columns` would read top-to-bottom per column instead).
// Returns the original indexes per column so callers keep a stable item order.

export type Sized = { width: number; height: number };

export function distributeIntoColumns(items: Sized[], columnCount: number): number[][] {
  const count = Math.max(1, Math.floor(columnCount));
  const columns: number[][] = Array.from({ length: count }, () => []);
  const heights: number[] = Array.from({ length: count }, () => 0);
  items.forEach((item, index) => {
    const ratio = item.width > 0 && item.height > 0 ? item.height / item.width : 1.25;
    const target = heights.indexOf(Math.min(...heights));
    columns[target] = [...columns[target], index];
    heights[target] += ratio;
  });
  return columns;
}
