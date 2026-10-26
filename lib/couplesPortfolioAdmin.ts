// Pure helpers for Admin → Couples Portfolio (/api/admin/couples-portfolio).
// No DB or Next imports, so the validation and reorder math are unit-testable.

export const COUPLES_PORTFOLIO_COLUMNS =
  "id,title,alt,image_url,featured,published,session_label,category_hero,sort_order,width,height,location,created_at";

export type CouplesPortfolioAdminRow = {
  id: number;
  title: string;
  alt: string;
  image_url: string;
  featured: boolean;
  published: boolean;
  session_label: string | null;
  category_hero: boolean;
  sort_order: number;
  width: number | null;
  height: number | null;
  location: string | null;
  created_at: string | null;
};

export type CouplesPortfolioUpdates = Partial<
  Pick<CouplesPortfolioAdminRow, "title" | "alt" | "featured" | "published" | "session_label" | "width" | "height">
>;

const MAX_TITLE = 160;
const MAX_ALT = 300;
const MAX_SESSION = 120;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
}

/** Whitelists and normalizes a PATCH body. Unknown keys are dropped. */
export function validateCouplesPortfolioUpdates(
  input: Record<string, unknown>,
): { ok: true; data: CouplesPortfolioUpdates } | { ok: false; error: string } {
  const data: CouplesPortfolioUpdates = {};
  if ("title" in input) {
    const title = cleanText(input.title, MAX_TITLE);
    if (!title) return { ok: false, error: "Title can't be empty." };
    data.title = title;
  }
  if ("alt" in input) {
    const alt = cleanText(input.alt, MAX_ALT);
    if (!alt) return { ok: false, error: "Alt text can't be empty." };
    data.alt = alt;
  }
  if ("featured" in input) data.featured = input.featured === true;
  if ("published" in input) data.published = input.published === true;
  if ("session_label" in input) data.session_label = cleanText(input.session_label, MAX_SESSION);
  if ("width" in input || "height" in input) {
    const width = positiveInt(input.width);
    const height = positiveInt(input.height);
    if (!width || !height) return { ok: false, error: "Width and height must be positive whole numbers." };
    data.width = width;
    data.height = height;
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to update." };
  return { ok: true, data };
}

/**
 * New sort_order values for a reorder. Reuses the couples rows' existing
 * sort_order values (so other categories' positions are untouched), assigned
 * in the requested order and forced strictly increasing.
 * Returns null when `orderedIds` isn't exactly the current set of ids.
 */
export function planCouplesReorder(
  current: Array<{ id: number; sort_order: number }>,
  orderedIds: number[],
): Array<{ id: number; sort_order: number }> | null {
  const currentIds = new Set(current.map((row) => row.id));
  const requested = new Set(orderedIds);
  if (requested.size !== orderedIds.length || requested.size !== currentIds.size) return null;
  if (orderedIds.some((id) => !currentIds.has(id))) return null;

  const slots = current.map((row) => row.sort_order).sort((a, b) => a - b);
  return orderedIds.reduce<Array<{ id: number; sort_order: number }>>((plan, id, index) => {
    const previous = plan[index - 1]?.sort_order ?? Number.NEGATIVE_INFINITY;
    return [...plan, { id, sort_order: Math.max(slots[index], previous + 1) }];
  }, []);
}

/** Session groups in display order (first appearance in the photo order). */
export function groupBySession<T extends { session_label: string | null }>(rows: T[]): Array<{ label: string; rows: T[] }> {
  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const label = row.session_label ?? "";
    if (!groups.has(label)) {
      order.push(label);
      groups.set(label, []);
    }
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return order.map((label) => ({ label, rows: groups.get(label) ?? [] }));
}
