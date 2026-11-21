// The short label above each /links card title. It follows the link's
// destination, not its position, so reordering links in the admin Links tab
// never leaves a card under the wrong label. The first card is always the
// suggested starting point.

const FIRST_CARD_EYEBROW = "Start here";

const EYEBROW_BY_PATH: ReadonlyArray<readonly [pattern: RegExp, eyebrow: string]> = [
  [/^\/contact/, "Booking"],
  [/^\/pricing/, "Pricing"],
  [/^\/availability/, "Calendar"],
  [/-guide(\/|$)/, "Prep guide"],
  [/^\/(portfolio(\/|$))?$|^\/portfolio\//, "Portfolio"],
];

function pathOf(url: string): string | null {
  try {
    return new URL(url, "https://www.soloxsnaps.com").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export function eyebrowForLink(url: string, index: number): string | undefined {
  if (index === 0) return FIRST_CARD_EYEBROW;
  const path = pathOf(url);
  if (path === null) return undefined;
  return EYEBROW_BY_PATH.find(([pattern]) => pattern.test(path))?.[1];
}
