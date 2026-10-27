// Reads every row of a query, page by page.
//
// PostgREST returns at most `max-rows` (1000 on this project) per request and
// says nothing when it cuts a result short. A caller that treats one page as
// the whole table quietly loses photos once the library grows past that.
//
// The caller must order the query by a unique column (or end with `id`), or
// pages can overlap and skip rows. Paging advances by the rows actually
// returned and stops only on an empty page, so a server cap lower than
// `pageRows` still reads everything.

export const SUPABASE_PAGE_ROWS = 1000;
/** A runaway guard: 500 pages is 500k rows, far past any real library. */
const MAX_PAGES = 500;

type PageQuery = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Every row `page(from, to)` yields. Throws on the first failed page, so a
 * partial read is never mistaken for the full set.
 */
export async function fetchAllPages<T = Record<string, unknown>>(
  page: (from: number, to: number) => PageQuery,
  label: string,
  pageRows = SUPABASE_PAGE_ROWS,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (let n = 0; n < MAX_PAGES; n += 1) {
    const { data, error } = await page(from, from + pageRows - 1);
    if (error) throw new Error(`could not load ${label} (rows from ${from}): ${error.message}`);
    const rows = (data ?? []) as T[];
    if (rows.length === 0) return out;
    out.push(...rows);
    from += rows.length;
  }
  throw new Error(`could not load ${label}: more than ${MAX_PAGES} pages`);
}
