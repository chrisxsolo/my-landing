import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const professionalDataPath = new URL("../lib/professionalData.ts", import.meta.url);
const portfolioPagePath = new URL("../app/(professional)/portfolio/page.tsx", import.meta.url);

// Couples launched as a public service (2026-10-25). Its gallery lives at
// /portfolio/couples; the shared portfolio data only ever serves photos marked
// published, so hiding a photo in Admin → Couples Portfolio removes it everywhere.
test("public portfolio surfaces show couples and never show hidden photos", async () => {
  const [dataSource, portfolioSource] = await Promise.all([
    readFile(professionalDataPath, "utf8"),
    readFile(portfolioPagePath, "utf8"),
  ]);

  assert.match(dataSource, /VISIBLE_PORTFOLIO_SLUGS = \["grads", "families", "couples"\]/);
  assert.match(dataSource, /\.select\(PORTFOLIO_IMAGE_COLUMNS\)\s*\.eq\("published", true\)/);
  assert.match(portfolioSource, /if \(requestedCategory && !selected\) redirect\("\/portfolio"\)/);
  assert.match(portfolioSource, /if \(requestedCategory === COUPLES_CATEGORY_SLUG\) redirect\(COUPLES_PORTFOLIO_PATH\)/);
});
